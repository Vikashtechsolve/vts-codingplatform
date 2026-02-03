const express = require('express');
const multer = require('multer');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const Interview = require('../models/Interview');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { evaluateInterviewAnswer, generateFollowUpQuestion, generateInterviewQuestion } = require('../utils/aiEvaluation');
const { transcribeAudio } = require('../utils/sttService');

const upload = multer({ storage: multer.memoryStorage() });

const buildFallbackQuestions = (interview, count) => {
  const base = `Tell me about your experience with ${interview.topic || 'this topic'} in ${interview.interviewType || 'this role'}.`;
  return Array.from({ length: count }).map((_, idx) => ({
    questionId: null,
    questionText: idx === 0 ? base : `Let’s go deeper: ${base}`,
    isFollowUp: false
  }));
};

const buildQuestionQueue = async (interview, vendorId) => {
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
    return populated;
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

  const generated = [];
  const total = interview.questionCount || 6;
  for (let i = 0; i < total; i++) {
    const questionText = await generateInterviewQuestion({
      interviewType: interview.interviewType,
      topic: interview.topic,
      difficulty: interview.difficulty,
      previousQuestions: generated
    });
    if (questionText) {
      generated.push(questionText);
    }
  }

  if (generated.length === 0) {
    return buildFallbackQuestions(interview, total);
  }

  return generated.map(questionText => ({
    questionId: null,
    questionText,
    isFollowUp: false
  }));
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

    const student = await User.findById(req.user._id);
    const enrollment = student.enrolledInterviews.find(
      ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
    );

    if (!enrollment) {
      return res.status(403).json({ message: 'Interview not assigned to you' });
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
      const queue = await buildQuestionQueue(interview, interview.vendorId);
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
    } else if (!session.currentQuestion || !session.currentQuestion.questionText) {
      const queue = await buildQuestionQueue(interview, interview.vendorId);
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

    const queueLen = session.questionQueue?.length ?? 0;
    const totalQuestions = 1 + queueLen;
    res.json({
      sessionId: session._id,
      currentQuestion: session.currentQuestion,
      timeLimit: interview.duration,
      totalQuestions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:sessionId/transcribe', auth, authorize('student'), upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Audio file is required' });
    }
    const transcript = await transcribeAudio(req.file.buffer, req.file.mimetype);
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

    const transcript = req.body.transcript || '';
    if (!transcript.trim()) {
      return res.status(400).json({ message: 'Transcript is required' });
    }

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
      transcript
    });

    session.answers.push({
      questionId: session.currentQuestion?.questionId || null,
      questionText: session.currentQuestion?.questionText || '',
      transcript,
      evaluation,
      isFollowUp: session.currentQuestion?.isFollowUp || false
    });

    let nextQuestion = null;
    const followUpsUsed = session.answers.filter(a => a.isFollowUp).length;
    if (evaluation.overall < 60) {
      const interview = await Interview.findById(session.interviewId);
      if (interview?.settings?.allowFollowUps && followUpsUsed < (interview.settings.maxFollowUps || 2)) {
        const followUpText = await generateFollowUpQuestion({
          questionText: session.currentQuestion?.questionText || '',
          transcript,
          interviewType: session.interviewType,
          topic: session.topic,
          difficulty: session.difficulty
        });
        if (followUpText) {
          session.questionQueue.unshift({
            questionId: null,
            questionText: followUpText,
            isFollowUp: true
          });
        }
      }
    }

    if (session.questionQueue.length > 0) {
      nextQuestion = session.questionQueue.shift();
    }

    session.currentQuestion = nextQuestion || { questionText: '', isFollowUp: false };
    await session.save();

    res.json({
      evaluation,
      nextQuestion,
      completed: !nextQuestion
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

    const scores = session.answers.map(a => a.evaluation?.overall || 0);
    const overallScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    session.overallScore = overallScore;
    session.readinessPercent = overallScore;

    const strengths = session.answers.flatMap(a => a.evaluation?.strengths || []);
    const weaknesses = session.answers.flatMap(a => a.evaluation?.weaknesses || []);
    session.finalFeedback = {
      strengths: strengths.slice(0, 5),
      improvements: weaknesses.slice(0, 5),
      summary: session.answers[session.answers.length - 1]?.evaluation?.feedback || ''
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
      .populate('studentId', 'name email')
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:sessionId', auth, async (req, res) => {
  try {
    const session = await InterviewSession.findById(req.params.sessionId)
      .populate('interviewId', 'title interviewType topic difficulty duration');
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (req.user.role === 'student' && session.studentId.toString() !== req.user._id.toString()) {
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
