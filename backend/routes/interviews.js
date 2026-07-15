const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Interview = require('../models/Interview');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewSession = require('../models/InterviewSession');
const User = require('../models/User');
const {
  enrollStudentsInInterview,
  assignInterviewToClassrooms,
} = require('../utils/assignToClassroom');
const {
  validateScheduleInput,
  parseScheduleDateInput,
  attachScheduleToTest,
  resolveScheduleEnrollmentStatus,
} = require('../utils/testSchedule');
const { findPublishedContestByAssessment } = require('../utils/contestService');

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

    const parsedStartDate = parseScheduleDateInput(startDate);
    const parsedEndDate = parseScheduleDateInput(endDate);
    const scheduleError = validateScheduleInput({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

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
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      settings: {
        autoSubmitAtWindowEnd: settings?.autoSubmitAtWindowEnd !== false,
        ...settings,
      }
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
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 30,
      maxLimit: 100,
    });
    const filter = { vendorId: req.vendorId };
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = new RegExp(escaped, 'i');
    }

    const [interviews, total] = await Promise.all([
      Interview.find(filter)
        .select('title interviewType topic difficulty duration isActive createdAt questions')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Interview.countDocuments(filter),
    ]);

    res.json(paginatedResponse({ items: interviews, page, limit, total }));
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

    const withStatus = await Promise.all(interviews.map(async (interview) => {
      const enrollment = student.enrolledInterviews.find(
        ei => ei.interviewId && ei.interviewId.toString() === interview._id.toString()
      );
      const allowMultipleAttempts = interview.settings?.allowMultipleAttempts === true;
      const lastSession = lastCompletedByInterview[interview._id.toString()];
      const hasCompleted = !!lastSession;

      const activeContest = await findPublishedContestByAssessment(
        'interview',
        interview._id,
        student._id
      );

      const basePayload = {
        ...interview.toObject(),
        enrollmentStatus: enrollment ? enrollment.status : 'assigned',
        assignedAt: enrollment ? enrollment.assignedAt : null,
        allowMultipleAttempts,
        hasCompleted,
        lastSessionId: lastSession ? lastSession._id : null,
        ...(activeContest ? { contestId: activeContest._id } : {}),
      };

      return attachScheduleToTest(
        basePayload,
        resolveScheduleEnrollmentStatus(enrollment ? enrollment.status : 'assigned', {
          allowRetake: allowMultipleAttempts,
        }),
        undefined,
        { skipSchedule: Boolean(activeContest) }
      );
    }));

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

    const hasStartDate = Object.prototype.hasOwnProperty.call(req.body, 'startDate');
    const hasEndDate = Object.prototype.hasOwnProperty.call(req.body, 'endDate');
    const parsedStartDate = hasStartDate ? parseScheduleDateInput(startDate) : interview.startDate;
    const parsedEndDate = hasEndDate ? parseScheduleDateInput(endDate) : interview.endDate;
    const scheduleError = validateScheduleInput({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    if (title) interview.title = title;
    if (description !== undefined) interview.description = description;
    if (duration) interview.duration = duration;
    if (questionCount) interview.questionCount = questionCount;
    if (questions) interview.questions = questions;
    if (hasStartDate) interview.startDate = parsedStartDate;
    if (hasEndDate) interview.endDate = parsedEndDate;
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

// Assign interview to students and/or classrooms
router.post('/:id/assign', [
  authorize('vendor_admin'),
  tenantMiddleware,
  body('studentIds').optional().isArray().withMessage('Student IDs must be an array'),
  body('classroomIds').optional().isArray().withMessage('Classroom IDs must be an array'),
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

    const studentIds = req.body.studentIds || [];
    const classroomIds = req.body.classroomIds || [];

    if (studentIds.length === 0 && classroomIds.length === 0) {
      return res.status(400).json({
        message: 'Select at least one student or one classroom',
      });
    }

    let assigned = [];
    let classroomEnrolled = 0;

    if (classroomIds.length > 0) {
      const result = await assignInterviewToClassrooms(
        interview._id,
        classroomIds,
        req.vendorId,
        req.user._id
      );
      classroomEnrolled = result.enrolledCount;
    }

    if (studentIds.length > 0) {
      assigned = await enrollStudentsInInterview(interview._id, studentIds, req.vendorId);
    }

    const totalNew = assigned.length + classroomEnrolled;
    const parts = [];
    if (classroomIds.length > 0) {
      parts.push(
        `${classroomIds.length} classroom${classroomIds.length !== 1 ? 's' : ''} (${classroomEnrolled} new enrollment${classroomEnrolled !== 1 ? 's' : ''})`
      );
    }
    if (assigned.length > 0) {
      parts.push(`${assigned.length} individual student${assigned.length !== 1 ? 's' : ''}`);
    }

    res.json({
      message: totalNew > 0
        ? `Interview assigned successfully to ${parts.join(' and ')}`
        : 'Interview was already assigned to the selected audience',
      assigned,
      classroomEnrolled,
      totalNew,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
