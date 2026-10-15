const express = require('express');
const multer = require('multer');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Interview = require('../models/Interview');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const {
  evaluateInterviewAnswer,
  generateSpokenInterviewQuestions,
  generateInterviewFinalReport
} = require('../utils/aiEvaluation');
const { planNextInterviewTurn } = require('../utils/interviewTurn');
const {
  generateInterviewerReaction,
  pickTransition,
  closingLine,
} = require('../utils/interviewReaction');
const { percentToInterviewPoints, computeSessionMarksTotals } = require('../utils/interviewScoring');
const { transcribeAudio } = require('../utils/sttService');
const { synthesizeSpeech } = require('../utils/ttsService');
const { createTalkingHeadVideo, isTalkingHeadEnabled } = require('../utils/avatarTalkService');
const {
  enforceContestWindowIfApplicable,
  syncParticipantOnInterviewStart,
  markParticipantCompleted,
  getParticipant,
  findPublishedContestByAssessment,
} = require('../utils/contestService');
const {
  assertCanStartScheduledTest,
  resolveScheduleEnrollmentStatus,
} = require('../utils/testSchedule');
const {
  resolveCourseModuleAssessment,
  ensureStudentEnrollmentForCourseAssessment,
} = require('../utils/courseAssessmentAccess');
const Contest = require('../models/Contest');

const pendingEvalJobs = new Map();
const queueFillInFlight = new Set();

const toClientQuestion = (question) => {
  if (!question?.questionText && !question?.spokenText) return null;
  const segments = Array.isArray(question.speechSegments)
    ? question.speechSegments.map((part) => String(part || '').trim()).filter(Boolean)
    : undefined;
  return {
    questionId: question.questionId || null,
    questionText: question.questionText || '',
    spokenText: question.spokenText || question.questionText || '',
    acknowledgment: question.acknowledgment || '',
    isFollowUp: Boolean(question.isFollowUp),
    speechSegments: segments?.length ? segments : undefined,
  };
};

const spokenOpener = (interview, questionText) => {
  const title = interview?.title ? ` for ${interview.title}` : '';
  return `Hi, welcome to your mock interview${title}. I'll ask you a series of questions — answer naturally, and take your time. Let's begin. ${questionText}`;
};

const scoreAnswerInBackground = (sessionId, answerIndex, payload) => {
  const job = (async () => {
    try {
      const evaluation = await evaluateInterviewAnswer(payload);
      const points = percentToInterviewPoints(evaluation?.overall ?? 0, payload.maxPoints);
      const stored = {
        overall: evaluation?.overall ?? 0,
        correctness: evaluation?.correctness ?? 0,
        depth: evaluation?.depth ?? 0,
        structure: evaluation?.structure ?? 0,
        confidence: evaluation?.confidence ?? 0,
        relevance: evaluation?.relevance ?? 0,
        strengths: evaluation?.strengths || [],
        weaknesses: evaluation?.weaknesses || [],
        feedback: evaluation?.feedback || '',
        resources: evaluation?.resources || [],
      };
      await InterviewSession.updateOne(
        { _id: sessionId },
        {
          $set: {
            [`answers.${answerIndex}.evaluation`]: stored,
            [`answers.${answerIndex}.points`]: points,
            [`answers.${answerIndex}.evaluationPending`]: false,
          },
        }
      );
    } catch (err) {
      console.warn('Background interview scoring failed:', err.message);
      await InterviewSession.updateOne(
        { _id: sessionId },
        { $set: { [`answers.${answerIndex}.evaluationPending`]: false } }
      ).catch(() => {});
    }
  })();

  const key = String(sessionId);
  if (!pendingEvalJobs.has(key)) pendingEvalJobs.set(key, new Set());
  const jobs = pendingEvalJobs.get(key);
  jobs.add(job);
  job.finally(() => jobs.delete(job));
  return job;
};

const waitForPendingScores = async (sessionId, timeoutMs = 12000) => {
  const jobs = pendingEvalJobs.get(String(sessionId));
  if (!jobs?.size) return;
  await Promise.race([
    Promise.all([...jobs]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

const upload = multer({ storage: multer.memoryStorage() });

const buildFallbackQuestions = (interview, count) => {
  const topic = interview.topic || 'this topic';
  const type = interview.interviewType || 'this role';
  const templates = [
    `Walk me through a situation where you used ${topic} in ${type}. What did you do, and what would you change now?`,
    `How would you explain ${topic} to someone joining your team next week?`,
    `Describe a realistic problem involving ${topic} that could go wrong at work. How would you notice and handle it?`,
    `When two approaches to ${topic} both look reasonable, how do you decide which one to use?`,
    `Tell me about a time ${topic} work did not go as planned. What did you learn?`,
    `If a teammate disagreed with your approach to ${topic}, how would you work through that?`,
  ];
  return Array.from({ length: count }).map((_, idx) => ({
    questionId: null,
    questionText: templates[idx % templates.length],
    isFollowUp: false
  }));
};

const getStaticQuestionList = async (interview, vendorId) => {
  if (interview.questions && interview.questions.length > 0) {
    const ordered = [...interview.questions].sort((a, b) => (a.order || 0) - (b.order || 0));
    const ids = ordered.map((q) => q.questionId).filter(Boolean);
    const rows = ids.length
      ? await InterviewQuestion.find({ _id: { $in: ids } }).select('question')
      : [];
    const byId = new Map(rows.map((row) => [String(row._id), row]));
    const populated = ordered
      .map((entry) => byId.get(String(entry.questionId)))
      .filter(Boolean)
      .map((question) => ({
        questionId: question._id,
        questionText: question.question,
        isFollowUp: false,
      }));
    if (populated.length > 0) return populated;
  }

  const pool = await InterviewQuestion.find({
    $or: [
      { vendorId },
      { isGlobal: true }
    ],
    interviewType: interview.interviewType,
    topic: interview.topic,
    difficulty: interview.difficulty
  }).limit(interview.questionCount || 6);

  if (pool.length > 0) {
    return pool.map(question => ({
      questionId: question._id,
      questionText: question.question,
      isFollowUp: false
    }));
  }

  return null;
};

const generateAiQuestionBatch = async (interview, count, previousTexts = []) => {
  const texts = await generateSpokenInterviewQuestions({
    interviewType: interview.interviewType,
    topic: interview.topic,
    difficulty: interview.difficulty,
    description: interview.description,
    title: interview.title,
    previousQuestions: previousTexts,
    count
  });
  return texts.map((questionText) => ({
    questionId: null,
    questionText,
    isFollowUp: false
  }));
};

/** Fast path for session start: static list or a single AI question (rest filled in background). */
const buildQuestionQueueForStart = async (interview, vendorId) => {
  const staticList = await getStaticQuestionList(interview, vendorId);
  if (staticList?.length) return staticList;

  const total = interview.questionCount || 6;
  const [first] = await generateAiQuestionBatch(interview, 1);
  if (first) return [first];
  return buildFallbackQuestions(interview, Math.min(1, total));
};

const fillQuestionQueueInBackground = async (sessionId, interviewId) => {
  const key = String(sessionId);
  if (queueFillInFlight.has(key)) return;
  queueFillInFlight.add(key);
  try {
    const session = await InterviewSession.findById(sessionId)
      .select('questionQueue currentQuestion answers status vendorId');
    const interview = await Interview.findById(interviewId);
    if (!session || !interview || session.status !== 'in_progress') return;

    const planned = interview.questionCount || 6;
    const knownTexts = new Set(
      [
        session.currentQuestion?.questionText,
        ...(session.questionQueue || []).map((q) => q.questionText),
        ...(session.answers || []).map((a) => a.questionText),
      ].filter(Boolean)
    );
    const mainAsked = (session.answers || []).filter((a) => !a.isFollowUp).length;
    const currentIsMain = Boolean(session.currentQuestion?.questionText) && !session.currentQuestion?.isFollowUp;
    const queuedMain = (session.questionQueue || []).filter((q) => q?.questionText && !q.isFollowUp).length;
    const have = mainAsked + (currentIsMain ? 1 : 0) + queuedMain;
    const need = Math.max(0, planned - have);
    if (need <= 0) return;

    let batch = [];
    const staticList = await getStaticQuestionList(interview, session.vendorId);
    if (staticList?.length) {
      batch = staticList.filter((q) => !knownTexts.has(q.questionText)).slice(0, need);
    } else {
      batch = await generateAiQuestionBatch(interview, need, [...knownTexts]);
    }
    if (batch.length < need) {
      const pad = buildFallbackQuestions(interview, need - batch.length);
      batch = batch.concat(pad);
    }
    batch = batch.slice(0, need);
    if (!batch.length) return;

    await InterviewSession.updateOne(
      { _id: sessionId, status: 'in_progress' },
      { $push: { questionQueue: { $each: batch } } }
    );
  } catch (err) {
    console.warn('Background question queue fill failed:', err.message);
  } finally {
    queueFillInFlight.delete(key);
  }
};

const buildQuestionQueue = async (interview, vendorId) => {
  const staticList = await getStaticQuestionList(interview, vendorId);
  if (staticList?.length) return staticList;

  const total = interview.questionCount || 6;
  const batch = await generateAiQuestionBatch(interview, total);
  if (batch.length > 0) return batch;
  return buildFallbackQuestions(interview, total);
};

router.post('/start/:interviewId', auth, authorize('student'), async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    if (!interview.isActive) {
      return res.status(400).json({ message: 'Interview is not active' });
    }

    const contestId = req.body?.contestId || req.query?.contestId;
    let activeContest = null;
    try {
      activeContest = await enforceContestWindowIfApplicable(
        contestId,
        'interview',
        interview._id,
        req.user._id
      );
    } catch (contestErr) {
      return res.status(contestErr.status || 403).json({
        message: contestErr.message,
        code: contestErr.code,
      });
    }

    const student = await User.findById(req.user._id);
    const courseCtx = await resolveCourseModuleAssessment(req, 'interview', interview._id);

    let enrollment = student.enrolledInterviews.find(
      ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
    );

    if (courseCtx) {
      await ensureStudentEnrollmentForCourseAssessment(
        student,
        courseCtx,
        'interview',
        interview
      );
      enrollment = student.enrolledInterviews.find(
        (ei) => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
      );
    }

    if (!enrollment && activeContest) {
      student.enrolledInterviews.push({ interviewId: interview._id, status: 'assigned' });
      enrollment = student.enrolledInterviews[student.enrolledInterviews.length - 1];
      await student.save();
    }

    if (!enrollment) {
      return res.status(403).json({ message: 'Interview not assigned to you' });
    }

    const allowMultipleAttempts =
      interview.settings?.allowMultipleAttempts === true || !!courseCtx;

    if (!activeContest) {
      const scheduleEnrollmentStatus = resolveScheduleEnrollmentStatus(enrollment.status, {
        allowRetake: allowMultipleAttempts,
      });
      const scheduleCheck = assertCanStartScheduledTest(interview, scheduleEnrollmentStatus);
      if (!scheduleCheck.ok) {
        return res.status(scheduleCheck.status || 403).json({
          message: scheduleCheck.message,
          code: scheduleCheck.code,
          schedulePhase: scheduleCheck.schedule?.phase,
        });
      }
    }

    if (!allowMultipleAttempts) {
      const completedSession = await InterviewSession.findOne({
        interviewId: interview._id,
        studentId: req.user._id,
        status: 'completed'
      }).sort({ submittedAt: -1 });
      if (completedSession) {
        return res.status(403).json({
          message: 'You have already attempted this interview. Only one attempt is allowed.',
          alreadyAttempted: true,
          lastSessionId: completedSession._id
        });
      }
    }

    // Platform interviews have no vendorId — bill credits to the student's vendor
    const billingVendorId = interview.vendorId || req.user.vendorId;
    const vendor = await Vendor.findById(billingVendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Normalize: DB may have interviewCredits as a number (legacy) or as object — never mutate in place
    let allocated = 0;
    let used = 0;
    if (typeof vendor.interviewCredits === 'number' && Number.isFinite(vendor.interviewCredits)) {
      allocated = vendor.interviewCredits;
      used = 0;
    } else if (vendor.interviewCredits && typeof vendor.interviewCredits === 'object') {
      allocated = Number(vendor.interviewCredits.allocated) || 0;
      used = Number(vendor.interviewCredits.used) || 0;
    }
    const remaining = Math.max(0, allocated - used);

    if (remaining <= 0 && allocated > 0) {
      return res.status(400).json({ message: 'Interview credits exhausted for this vendor' });
    }

    const forceFresh = req.query.fresh === 'true';
    
    let session = await InterviewSession.findOne({
      interviewId: interview._id,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (session && forceFresh) {
      await InterviewSession.deleteOne({ _id: session._id });
      session = null;
    }

    if (!session) {
      const queue = await buildQuestionQueueForStart(interview, interview.vendorId);
      const [currentQuestion, ...remaining] = queue;
      session = new InterviewSession({
        interviewId: interview._id,
        studentId: req.user._id,
        vendorId: billingVendorId,
        interviewType: interview.interviewType,
        topic: interview.topic,
        difficulty: interview.difficulty,
        courseId: courseCtx?.courseId || null,
        moduleId: courseCtx?.moduleId || null,
        currentQuestion: currentQuestion || {
          questionId: null,
          questionText: `Tell me about your experience with ${interview.topic || 'this topic'} in ${interview.interviewType || 'this role'}.`,
          isFollowUp: false
        },
        questionQueue: remaining,
        startedAt: new Date(),
        status: 'in_progress'
      });
      await session.save();
      const staticOnCreate = await getStaticQuestionList(interview, interview.vendorId);
      if (!staticOnCreate?.length || staticOnCreate.length < (interview.questionCount || 6)) {
        setImmediate(() => fillQuestionQueueInBackground(session._id, interview._id));
      }
    } else if (!session.currentQuestion || !session.currentQuestion.questionText) {
      const queue = await buildQuestionQueueForStart(interview, interview.vendorId);
      const [currentQuestion, ...remaining] = queue;
      session.currentQuestion = currentQuestion || {
        questionId: null,
        questionText: `Tell me about your experience with ${interview.topic || 'this topic'} in ${interview.interviewType || 'this role'}.`,
        isFollowUp: false
      };
      session.questionQueue = remaining;
      if (!session.startedAt) {
        session.startedAt = new Date();
      }
      await session.save();
    }

    enrollment.status = 'in_progress';
    enrollment.startedAt = new Date();
    await student.save();

    if (activeContest) {
      await syncParticipantOnInterviewStart(activeContest._id, req.user._id, session._id);
    }

    if (session.currentQuestion?.questionText && !session.currentQuestion?.spokenText) {
      const questionText = session.currentQuestion.questionText;
      const spokenText = spokenOpener(interview, questionText);
      await InterviewSession.updateOne(
        { _id: session._id },
        { $set: { 'currentQuestion.spokenText': spokenText, 'currentQuestion.questionText': questionText } }
      );
      session.currentQuestion.spokenText = spokenText;
      session.currentQuestion.questionText = questionText;
    }

    const planned = interview.questionCount || 6;
    const have = 1 + (session.questionQueue?.length ?? 0);
    if (have < planned) {
      setImmediate(() => fillQuestionQueueInBackground(session._id, interview._id));
    }

    const queueLen = session.questionQueue?.length ?? 0;
    const totalQuestions = interview.questionCount || Math.max(6, 1 + queueLen);
    res.json({
      sessionId: session._id,
      currentQuestion: toClientQuestion(session.currentQuestion),
      upcomingQuestion: toClientQuestion(session.questionQueue?.[0]),
      questionNumber: 1,
      timeLimit: interview.duration,
      totalQuestions,
      readyToJoin: Boolean(
        session.currentQuestion?.spokenText?.trim() || session.currentQuestion?.questionText?.trim()
      )
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:sessionId/speak', auth, authorize('student'), async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      studentId: req.user._id,
      status: 'in_progress'
    });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const text = String(req.body.text || '').trim();
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }
    if (text.length > 4096) {
      return res.status(400).json({ message: 'Text is too long for speech synthesis' });
    }

    const audioBuffer = await synthesizeSpeech(text);
    const wantVideo = req.body.video === true || req.query.video === '1';

    if (wantVideo && isTalkingHeadEnabled()) {
      try {
        const videoBuffer = await createTalkingHeadVideo(audioBuffer, session._id.toString());
        if (videoBuffer?.length > 128) {
          res.set('Content-Type', 'video/mp4');
          res.set('X-Interview-Media', 'talking-video');
          res.set('Cache-Control', 'private, max-age=3600');
          return res.send(videoBuffer);
        }
      } catch (videoErr) {
        console.warn('Talking-head video fallback to audio:', videoErr.message);
      }
    }

    res.set('Content-Type', 'audio/mpeg');
    res.set('X-Interview-Media', 'audio');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ message: 'Speech synthesis failed', error: error.message });
  }
});

router.post('/:sessionId/transcribe', auth, authorize('student'), upload.single('audio'), async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      studentId: req.user._id,
      status: 'in_progress'
    });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Audio file is required' });
    }
    const prompt = String(req.body.prompt || session.currentQuestion?.questionText || '').trim();
    const transcript = await transcribeAudio(req.file.buffer, req.file.mimetype, { prompt });
    res.json({ transcript });
  } catch (error) {
    res.status(500).json({ message: 'Transcription failed', error: error.message });
  }
});

router.post('/:sessionId/answer', auth, authorize('student'), async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      studentId: req.user._id,
      status: 'in_progress'
    });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const transcript = (req.body.transcript || '').trim();
    const transcriptForEval = transcript || '(No verbal response)';
    const isFollowUp = Boolean(session.currentQuestion?.isFollowUp);
    const answerIndex = session.answers.length;

    let question = null;
    if (session.currentQuestion?.questionId) {
      question = await InterviewQuestion.findById(session.currentQuestion.questionId).select('points rubrics');
    }
    const maxPoints = Number(question?.points) > 0 ? Number(question.points) : 10;

    const interview = await Interview.findById(session.interviewId).select('settings questionCount topic');
    const settings = interview?.settings || {};
    const allowFollowUp = settings.allowFollowUps !== false;
    const maxFollowUps = Math.max(1, Number(settings.maxFollowUps) || 6);
    const followUpsUsed = session.answers.filter((a) => a.isFollowUp).length;
    const mainAskedBefore = session.answers.filter((a) => !a.isFollowUp).length;

    const planned = interview?.questionCount || 6;
    const topic = session.topic || interview?.topic || '';
    const currentText = session.currentQuestion?.questionText || '';
    const followUpsRemaining = Math.max(0, maxFollowUps - followUpsUsed);
    const canFollowUp = !isFollowUp && allowFollowUp && followUpsRemaining > 0;
    const mainsAfter = mainAskedBefore + (isFollowUp ? 0 : 1);
    const isLastQuestion = mainsAfter >= planned;
    const recentExchanges = session.answers
      .slice(-2)
      .map((a) => `Q: ${a.questionText}\nA: ${String(a.transcript || '').slice(0, 280)}`)
      .join('\n\n');

    const reaction = await generateInterviewerReaction({
      questionText: currentText,
      transcript: transcriptForEval,
      interviewType: session.interviewType,
      topic,
      difficulty: session.difficulty,
      recentExchanges,
      isFollowUp,
      canFollowUp,
      isLastQuestion,
    });

    // Decide the next spoken turn from the reaction.
    let turn;
    const reAsk = (lead) => ({
      completed: false,
      consumeQueue: false,
      usedFallback: false,
      acknowledgment: reaction.reaction,
      nextQuestion: {
        questionId: session.currentQuestion?.questionId || null,
        questionText: currentText,
        spokenText: `${reaction.reaction} ${lead} ${currentText}`.replace(/\s+/g, ' ').trim(),
        speechSegments: [`${reaction.reaction} ${lead}`.trim(), currentText],
        isFollowUp: true,
      },
    });

    if (canFollowUp && reaction.verdict === 'empty') {
      turn = reAsk("Let me ask that again.");
    } else if (canFollowUp && reaction.verdict === 'off_topic' && !reaction.followUpQuestion) {
      turn = reAsk('So, coming back to the question:');
    } else if (
      canFollowUp
      && (reaction.verdict === 'partial' || reaction.verdict === 'off_topic')
      && reaction.followUpQuestion
    ) {
      turn = {
        completed: false,
        consumeQueue: false,
        usedFallback: false,
        acknowledgment: reaction.reaction,
        nextQuestion: {
          questionId: null,
          questionText: reaction.followUpQuestion,
          spokenText: `${reaction.reaction} ${reaction.followUpQuestion}`.replace(/\s+/g, ' ').trim(),
          speechSegments: [reaction.reaction, reaction.followUpQuestion],
          isFollowUp: true,
        },
      };
    } else {
      const base = planNextInterviewTurn({
        transcript: transcriptForEval,
        isFollowUp,
        allowFollowUp: false,
        followUpsRemaining: 0,
        mainAskedBefore,
        planned,
        queueHead: session.questionQueue?.[0] || null,
        topic,
      });
      const bridge = reaction.transition || pickTransition(mainsAfter);
      turn = {
        ...base,
        acknowledgment: reaction.reaction,
        nextQuestion: base.nextQuestion
          ? {
              ...base.nextQuestion,
              spokenText: `${reaction.reaction} ${bridge} ${base.nextQuestion.questionText}`
                .replace(/\s+/g, ' ')
                .trim(),
              speechSegments: [`${reaction.reaction} ${bridge}`.trim(), base.nextQuestion.questionText],
            }
          : null,
      };
    }

    const closingText = turn.completed ? closingLine(reaction.reaction) : '';

    const answerDoc = {
      questionId: session.currentQuestion?.questionId || null,
      questionText: currentText,
      transcript: transcript || '(No verbal response)',
      evaluation: {},
      points: 0,
      maxPoints,
      isFollowUp,
      evaluationPending: true,
      interviewerReaction: reaction.reaction,
      verdict: reaction.verdict,
    };

    const update = {
      $push: { answers: answerDoc },
      $set: {
        currentQuestion: turn.nextQuestion || {
          questionText: '',
          spokenText: '',
          acknowledgment: '',
          isFollowUp: false,
        },
      },
    };
    if (turn.consumeQueue) update.$pop = { questionQueue: -1 };

    const updated = await InterviewSession.findOneAndUpdate(
      { _id: session._id, status: 'in_progress' },
      update,
      { new: true, projection: { questionQueue: 1 } }
    );
    if (!updated) {
      return res.status(404).json({ message: 'Session not found' });
    }

    scoreAnswerInBackground(session._id, answerIndex, {
      questionText: session.currentQuestion?.questionText || '',
      interviewType: session.interviewType,
      topic: session.topic,
      difficulty: session.difficulty,
      rubrics: question?.rubrics || [],
      transcript: transcriptForEval,
      maxPoints,
    });

    if (turn.usedFallback) {
      setImmediate(() => fillQuestionQueueInBackground(session._id, session.interviewId));
    }

    const questionNumber = turn.nextQuestion?.isFollowUp
      ? Math.max(1, mainsAfter)
      : mainsAfter + (turn.completed ? 0 : 1);

    res.json({
      acknowledgment: turn.acknowledgment,
      nextQuestion: toClientQuestion(turn.nextQuestion),
      upcomingQuestion: toClientQuestion(updated.questionQueue?.[0]),
      completed: turn.completed,
      askedFollowUp: Boolean(turn.nextQuestion?.isFollowUp),
      questionNumber,
      spokenClosing: closingText || null,
      verdict: reaction.verdict,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:sessionId/submit', auth, authorize('student'), async (req, res) => {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.sessionId,
      studentId: req.user._id
    });
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ message: 'Interview already submitted' });
    }

    await waitForPendingScores(session._id);
    const scored = await InterviewSession.findById(session._id);
    if (scored?.answers?.length) {
      session.answers = scored.answers;
      session.markModified('answers');
    }

    session.submittedAt = new Date();
    const startTime = session.startedAt || session.createdAt || new Date();
    session.timeSpent = Math.floor((session.submittedAt - startTime) / 1000);
    session.status = 'completed';

    const report = await generateInterviewFinalReport(session);
    const marksTotals = computeSessionMarksTotals(session.answers);
    session.overallScore = marksTotals.totalMax > 0 ? marksTotals.percent : report.overallScore;
    session.readinessPercent = report.readinessPercent;
    session.finalFeedback = {
      strengths: report.strengths,
      improvements: report.improvements,
      summary: report.summary,
      readinessLabel: report.readinessLabel,
      focusAreas: report.focusAreas
    };

    // Charge 1 credit only if attempt > 5 min (requirement: "if student will attempt for more than 5 min then count reduced")
    if (session.timeSpent > 300 && !session.creditCharged) {
      const vendor = await Vendor.findById(session.vendorId);
      if (vendor) {
        // Normalize: read allocated/used without mutating (interviewCredits may be legacy number)
        let allocated = 0;
        let used = 0;
        if (typeof vendor.interviewCredits === 'number' && Number.isFinite(vendor.interviewCredits)) {
          allocated = vendor.interviewCredits;
          used = 0;
        } else if (vendor.interviewCredits && typeof vendor.interviewCredits === 'object') {
          allocated = Number(vendor.interviewCredits.allocated) || 0;
          used = Number(vendor.interviewCredits.used) || 0;
        }
        const remaining = Math.max(0, allocated - used);

        if (remaining > 0) {
          const nextUsed = used + 1;
          vendor.interviewCredits = {
            allocated,
            used: nextUsed,
            remaining: Math.max(0, allocated - nextUsed)
          };
          await vendor.save();
          session.creditCharged = true;
          session.creditChargedAt = new Date();
        }
      }
    }

    await session.save();

    const student = await User.findById(req.user._id);
    const enrollment = student.enrolledInterviews.find(
      ei => ei.interviewId && ei.interviewId.toString() === session.interviewId.toString()
    );
    if (enrollment) {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
      await student.save();
    }

    const submitContestId = req.body?.contestId || req.query?.contestId;
    if (submitContestId) {
      await markParticipantCompleted(submitContestId, req.user._id, {
        model: 'InterviewSession',
        id: session._id,
      });
    } else {
      const linkedContest = await Contest.findOne({
        assessmentType: 'interview',
        assessmentId: session.interviewId,
        status: 'published',
      });
      if (linkedContest) {
        const linkedParticipant = await getParticipant(linkedContest._id, req.user._id);
        if (linkedParticipant) {
          await markParticipantCompleted(linkedContest._id, req.user._id, {
            model: 'InterviewSession',
            id: session._id,
          });
        }
      }
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/interview/:interviewId', auth, authorize('vendor_admin'), async (req, res) => {
  try {
    const sessions = await InterviewSession.find({
      interviewId: req.params.interviewId,
      vendorId: req.user.vendorId
    })
      .populate('studentId', 'name email enrollmentNumber')
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/student/:studentId', auth, authorize('vendor_admin'), tenantMiddleware, async (req, res) => {
  try {
    const vendorId = req.vendorId || req.user?.vendorId;
    if (!vendorId) {
      return res.status(403).json({ message: 'Vendor context required' });
    }
    const sessions = await InterviewSession.find({
      studentId: req.params.studentId,
      vendorId,
      status: 'completed'
    })
      .populate('interviewId', 'title interviewType topic difficulty duration')
      .sort({ submittedAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:sessionId', auth, async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.sessionId)
      .populate('interviewId', 'title interviewType topic difficulty duration')
      .populate('studentId', 'name email enrollmentNumber');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const studentIdStr = (session.studentId?._id || session.studentId)?.toString();
    if (req.user.role === 'student' && studentIdStr !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'vendor_admin' && session.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(session);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
