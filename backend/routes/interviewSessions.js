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
  generateInterviewQuestion,
  resolveInterviewerTurn,
  generateInterviewOpener,
  generateInterviewFinalReport
} = require('../utils/aiEvaluation');
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
const Contest = require('../models/Contest');

const upload = multer({ storage: multer.memoryStorage() });

const buildFallbackQuestions = (interview, count) => {
  const base = `Tell me about your experience with ${interview.topic || 'this topic'} in ${interview.interviewType || 'this role'}.`;
  return Array.from({ length: count }).map((_, idx) => ({
    questionId: null,
    questionText: idx === 0 ? base : `Let’s go deeper: ${base}`,
    isFollowUp: false
  }));
};

const getStaticQuestionList = async (interview, vendorId) => {
  if (interview.questions && interview.questions.length > 0) {
    const populated = [];
    for (const q of interview.questions.sort((a, b) => a.order - b.order)) {
      const question = await InterviewQuestion.findById(q.questionId);
      if (question) {
        populated.push({
          questionId: question._id,
          questionText: question.question,
          isFollowUp: false
        });
      }
    }
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
  const generated = [...previousTexts];
  const items = [];
  for (let i = 0; i < count; i++) {
    const questionText = await generateInterviewQuestion({
      interviewType: interview.interviewType,
      topic: interview.topic,
      difficulty: interview.difficulty,
      description: interview.description,
      title: interview.title,
      previousQuestions: generated
    });
    if (questionText) {
      generated.push(questionText);
      items.push({
        questionId: null,
        questionText,
        isFollowUp: false
      });
    }
  }
  return items;
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
  try {
    const session = await InterviewSession.findById(sessionId);
    const interview = await Interview.findById(interviewId);
    if (!session || !interview || session.status !== 'in_progress') return;

    const staticList = await getStaticQuestionList(interview, session.vendorId);
    const planned = interview.questionCount || 6;
    const knownTexts = new Set(
      [session.currentQuestion?.questionText, ...(session.questionQueue || []).map((q) => q.questionText)]
        .filter(Boolean)
    );

    if (staticList?.length) {
      const toAdd = staticList.filter((q) => !knownTexts.has(q.questionText));
      if (toAdd.length) {
        session.questionQueue.push(...toAdd);
        await session.save();
      }
      return;
    }

    const have = 1 + (session.questionQueue?.length || 0);
    const need = Math.max(0, planned - have);
    if (need <= 0) return;

    const previous = [...knownTexts];
    const batch = await generateAiQuestionBatch(interview, need, previous);
    if (batch.length) {
      session.questionQueue.push(...batch);
      await session.save();
    }
  } catch (err) {
    console.warn('Background question queue fill failed:', err.message);
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
    let enrollment = student.enrolledInterviews.find(
      ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
    );

    if (!enrollment && activeContest) {
      student.enrolledInterviews.push({ interviewId: interview._id, status: 'assigned' });
      enrollment = student.enrolledInterviews[student.enrolledInterviews.length - 1];
      await student.save();
    }

    if (!enrollment) {
      return res.status(403).json({ message: 'Interview not assigned to you' });
    }

    const allowMultipleAttempts = interview.settings?.allowMultipleAttempts === true;

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

    const vendor = await Vendor.findById(interview.vendorId);
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
        vendorId: interview.vendorId,
        interviewType: interview.interviewType,
        topic: interview.topic,
        difficulty: interview.difficulty,
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
      const opener = await generateInterviewOpener({
        interviewTitle: interview.title,
        interviewType: interview.interviewType,
        topic: interview.topic,
        difficulty: interview.difficulty,
        description: interview.description,
        firstQuestionText: session.currentQuestion.questionText
      });
      session.currentQuestion = {
        questionId: session.currentQuestion.questionId || null,
        questionText: opener.displayQuestionText || session.currentQuestion.questionText,
        spokenText: opener.spokenText,
        acknowledgment: opener.acknowledgment || '',
        isFollowUp: false
      };
      await session.save();
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
      currentQuestion: session.currentQuestion,
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

    let question = null;
    if (session.currentQuestion?.questionId) {
      question = await InterviewQuestion.findById(session.currentQuestion.questionId);
    }

    const evaluation = await evaluateInterviewAnswer({
      questionText: session.currentQuestion?.questionText || '',
      interviewType: session.interviewType,
      topic: session.topic,
      difficulty: session.difficulty,
      rubrics: question?.rubrics || [],
      transcript: transcriptForEval
    });

    session.answers.push({
      questionId: session.currentQuestion?.questionId || null,
      questionText: session.currentQuestion?.questionText || '',
      transcript: transcript || '(No verbal response)',
      evaluation,
      isFollowUp: session.currentQuestion?.isFollowUp || false
    });

    const interview = await Interview.findById(session.interviewId);
    const settings = interview?.settings || {};
    const allowFollowUp = settings.allowFollowUps !== false;
    const maxFollowUps = Math.max(1, Number(settings.maxFollowUps) || 6);
    const followUpsUsed = session.answers.filter(a => a.isFollowUp).length;
    const followUpsRemaining = Math.max(0, maxFollowUps - followUpsUsed);
    const nextQueued = session.questionQueue?.[0] || null;
    const recentExchanges = session.answers
      .slice(-3)
      .map((a, i) => `Q${i + 1}: ${a.questionText}\nAnswer: ${a.transcript}`)
      .join('\n\n');

    const turn = await resolveInterviewerTurn({
      evaluation,
      questionText: session.currentQuestion?.questionText || '',
      transcript: transcriptForEval,
      interviewType: session.interviewType,
      topic: session.topic,
      difficulty: session.difficulty,
      nextQueuedQuestionText: nextQueued?.questionText || null,
      followUpsRemaining,
      allowFollowUp,
      isFollowUpQuestion: Boolean(session.currentQuestion?.isFollowUp),
      recentExchanges
    });

    let nextQuestion = null;
    let lastAcknowledgment = turn?.acknowledgment || '';

    if (turn?.shouldFollowUp && turn.followUpQuestion) {
      nextQuestion = {
        questionId: null,
        questionText: turn.displayQuestionText || turn.followUpQuestion,
        spokenText: turn.spokenText,
        acknowledgment: turn.acknowledgment || '',
        isFollowUp: true
      };
    } else if (session.questionQueue.length > 0) {
      const queued = session.questionQueue.shift();
      nextQuestion = {
        questionId: queued.questionId || null,
        questionText: turn?.displayQuestionText || queued.questionText,
        spokenText: turn?.spokenText || queued.questionText,
        acknowledgment: turn?.acknowledgment || '',
        isFollowUp: false
      };
    }

    session.currentQuestion = nextQuestion || { questionText: '', spokenText: '', acknowledgment: '', isFollowUp: false };
    await session.save();

    res.json({
      evaluation,
      acknowledgment: lastAcknowledgment,
      nextQuestion,
      completed: !nextQuestion,
      askedFollowUp: Boolean(nextQuestion?.isFollowUp)
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

    session.submittedAt = new Date();
    const startTime = session.startedAt || session.createdAt || new Date();
    session.timeSpent = Math.floor((session.submittedAt - startTime) / 1000);
    session.status = 'completed';

    const report = await generateInterviewFinalReport(session);
    session.overallScore = report.overallScore;
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
