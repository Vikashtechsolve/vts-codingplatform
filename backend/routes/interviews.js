const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Interview = require('../models/Interview');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');

router.use(auth);

// Create interview (vendor admin)
router.post('/', [
  authorize('vendor_admin'),
  tenantMiddleware,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('interviewType').trim().notEmpty().withMessage('Interview type is required'),
  body('topic').trim().notEmpty().withMessage('Topic is required'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      interviewType,
      topic,
      difficulty,
      duration,
      questionCount,
      questions,
      startDate,
      endDate,
      settings
    } = req.body;

    // Validate questions (if provided)
    if (questions && questions.length > 0) {
      for (const q of questions) {
        const question = await InterviewQuestion.findOne({
          _id: q.questionId,
          $or: [
            {
              vendorId: req.vendorId,
              $or: [
                { isGlobal: false },
                { isGlobal: { $exists: false } }
              ]
            },
            { isGlobal: true }
          ]
        });
        if (!question) {
          return res.status(400).json({ message: `Question ${q.questionId} not found or not accessible` });
        }
      }
    }

    const interview = new Interview({
      title,
      description,
      vendorId: req.vendorId,
      createdBy: req.user._id,
      interviewType,
      topic,
      difficulty: difficulty || 'beginner',
      duration,
      questionCount: questionCount || 6,
      questions: (questions || []).map((q, index) => ({
        questionId: q.questionId,
        order: q.order || index + 1
      })),
      startDate,
      endDate,
      settings: settings || {}
    });

    await interview.save();
    res.status(201).json(interview);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get interviews (vendor admin)
router.get('/', authorize('vendor_admin'), tenantMiddleware, async (req, res) => {
  try {
    const interviews = await Interview.find({ vendorId: req.vendorId })
      .sort({ createdAt: -1 });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get assigned interviews (student)
router.get('/assigned', authorize('student'), async (req, res) => {
  try {
    const student = await User.findById(req.user._id);
    const interviewIds = (student.enrolledInterviews || [])
      .map(ei => ei.interviewId)
      .filter(id => id != null);

    const interviews = await Interview.find({
      _id: { $in: interviewIds },
      isActive: true
    })
      .select('title description interviewType topic difficulty duration startDate endDate settings')
      .sort({ createdAt: -1 });

    const completedSessions = await InterviewSession.find({
      interviewId: { $in: interviewIds },
      studentId: req.user._id,
      status: 'completed'
    }).sort({ submittedAt: -1 });

    const lastCompletedByInterview = {};
    for (const s of completedSessions) {
      const id = s.interviewId.toString();
      if (!lastCompletedByInterview[id]) lastCompletedByInterview[id] = s;
    }

    const withStatus = interviews.map(interview => {
      const enrollment = student.enrolledInterviews.find(
        ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
      );
      const allowMultipleAttempts = interview.settings?.allowMultipleAttempts === true;
      const lastSession = lastCompletedByInterview[interview._id.toString()];
      const hasCompleted = !!lastSession;
      return {
        ...interview.toObject(),
        enrollmentStatus: enrollment ? enrollment.status : 'assigned',
        assignedAt: enrollment ? enrollment.assignedAt : null,
        allowMultipleAttempts,
        hasCompleted,
        lastSessionId: lastSession ? lastSession._id : null
      };
    });

    res.json(withStatus);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single interview
router.get('/:id', async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    if (req.user.role === 'vendor_admin' && interview.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'student') {
      const student = await User.findById(req.user._id);
      const isEnrolled = student.enrolledInterviews.some(
        ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
      );
      if (!isEnrolled) {
        return res.status(403).json({ message: 'Interview not assigned to you' });
      }
    }

    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update interview
router.put('/:id', authorize('vendor_admin'), tenantMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    const { title, description, duration, questionCount, questions, startDate, endDate, isActive, settings } = req.body;
    if (title) interview.title = title;
    if (description !== undefined) interview.description = description;
    if (duration) interview.duration = duration;
    if (questionCount) interview.questionCount = questionCount;
    if (questions) interview.questions = questions;
    if (startDate) interview.startDate = startDate;
    if (endDate) interview.endDate = endDate;
    if (isActive !== undefined) interview.isActive = isActive;
    if (settings) interview.settings = { ...interview.settings, ...settings };

    await interview.save();
    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete interview
router.delete('/:id', authorize('vendor_admin'), tenantMiddleware, async (req, res) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }
    await Interview.findByIdAndDelete(req.params.id);
    res.json({ message: 'Interview deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign interview to students
router.post('/:id/assign', [
  authorize('vendor_admin'),
  tenantMiddleware,
  body('studentIds').isArray().withMessage('Student IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const interview = await Interview.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    const { studentIds } = req.body;
    const assigned = [];

    for (const studentId of studentIds) {
      const student = await User.findOne({
        _id: studentId,
        vendorId: req.vendorId,
        role: 'student'
      });
      if (!student) continue;

      const alreadyAssigned = student.enrolledInterviews.some(
        ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
      );

      if (!alreadyAssigned) {
        student.enrolledInterviews.push({
          interviewId: interview._id,
          status: 'assigned'
        });
        await student.save();
        assigned.push(studentId);
      }
    }

    res.json({ message: 'Interview assigned successfully', assigned });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
