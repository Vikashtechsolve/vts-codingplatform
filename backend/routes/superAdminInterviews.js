const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Interview = require('../models/Interview');
const InterviewQuestion = require('../models/InterviewQuestion');
const InterviewVendorAllocation = require('../models/InterviewVendorAllocation');
const InterviewSession = require('../models/InterviewSession');
const Vendor = require('../models/Vendor');

const { parsePagination, isPaginatedRequest, paginatedFind } = require('../utils/pagination');

const router = express.Router();
router.use(auth);
router.use(authorize('super_admin'));

async function getPlatformInterviewOr404(id, res) {
  const interview = await Interview.findOne({ _id: id, source: 'platform' });
  if (!interview) {
    res.status(404).json({ message: 'Platform interview not found' });
    return null;
  }
  return interview;
}

async function verifyGlobalInterviewQuestions(questions) {
  if (!questions?.length) return null;
  for (const q of questions) {
    const question = await InterviewQuestion.findOne({ _id: q.questionId, isGlobal: true });
    if (!question) {
      return `Global interview question ${q.questionId} not found`;
    }
  }
  return null;
}

router.get('/', async (req, res) => {
  try {
    const filter = { source: 'platform' };
    if (isPaginatedRequest(req.query)) {
      const { page, limit, search } = parsePagination(req.query, {
        defaultLimit: 20,
        maxLimit: 50,
      });
      const payload = await paginatedFind(Interview, {
        filter,
        search,
        searchFields: ['title', 'topic', 'interviewType'],
        select: 'title topic interviewType duration difficulty createdAt',
        page,
        limit,
      });
      return res.json(payload);
    }

    const interviews = await Interview.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const ids = interviews.map((i) => i._id);
    const counts = await InterviewVendorAllocation.aggregate([
      { $match: { interviewId: { $in: ids }, isActive: true } },
      { $group: { _id: '$interviewId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row.count]));

    res.json(
      interviews.map((item) => ({
        ...item,
        allocatedVendorCount: countMap[String(item._id)] || 0,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', [
  body('title').trim().notEmpty(),
  body('interviewType').trim().notEmpty(),
  body('topic').trim().notEmpty(),
  body('duration').isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      title,
      description,
      interviewType,
      topic,
      difficulty,
      duration,
      questionCount,
      questions,
      settings,
    } = req.body;

    const verifyError = await verifyGlobalInterviewQuestions(questions);
    if (verifyError) return res.status(400).json({ message: verifyError });

    const interview = await Interview.create({
      title,
      description: description || '',
      interviewType,
      topic,
      difficulty: difficulty || 'beginner',
      duration,
      questionCount: questionCount || questions?.length || 6,
      questions: (questions || []).map((q, index) => ({
        questionId: q.questionId,
        order: q.order || index + 1,
      })),
      source: 'platform',
      vendorId: null,
      createdBy: req.user._id,
      isActive: true,
      settings: {
        allowMultipleAttempts: false,
        showResults: true,
        allowFollowUps: true,
        maxFollowUps: 6,
        adaptiveDifficulty: true,
        ...(settings || {}),
      },
    });

    res.status(201).json(interview);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const interview = await getPlatformInterviewOr404(req.params.id, res);
    if (!interview) return;
    const populated = await Interview.findById(interview._id)
      .populate('createdBy', 'name email')
      .populate('questions.questionId');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const interview = await getPlatformInterviewOr404(req.params.id, res);
    if (!interview) return;

    const {
      title,
      description,
      interviewType,
      topic,
      difficulty,
      duration,
      questionCount,
      questions,
      isActive,
      settings,
    } = req.body;

    if (questions) {
      const verifyError = await verifyGlobalInterviewQuestions(questions);
      if (verifyError) return res.status(400).json({ message: verifyError });
      interview.questions = questions.map((q, index) => ({
        questionId: q.questionId,
        order: q.order || index + 1,
      }));
    }

    if (title) interview.title = title;
    if (description !== undefined) interview.description = description;
    if (interviewType) interview.interviewType = interviewType;
    if (topic) interview.topic = topic;
    if (difficulty) interview.difficulty = difficulty;
    if (duration) interview.duration = duration;
    if (questionCount) interview.questionCount = questionCount;
    if (isActive !== undefined) interview.isActive = isActive;
    if (settings) interview.settings = { ...interview.settings, ...settings };

    await interview.save();
    res.json(interview);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const interview = await getPlatformInterviewOr404(req.params.id, res);
    if (!interview) return;

    await InterviewSession.deleteMany({ interviewId: interview._id });
    await InterviewVendorAllocation.deleteMany({ interviewId: interview._id });
    await Interview.findByIdAndDelete(interview._id);
    res.json({ message: 'Platform interview deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/allocations', async (req, res) => {
  try {
    const interview = await getPlatformInterviewOr404(req.params.id, res);
    if (!interview) return;

    const items = await InterviewVendorAllocation.find({
      interviewId: interview._id,
      isActive: true,
    })
      .populate('vendorId', 'name companyName email isActive')
      .sort({ allocatedAt: -1 })
      .lean();

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/allocations', [
  body('vendorIds').isArray({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const interview = await getPlatformInterviewOr404(req.params.id, res);
    if (!interview) return;

    const vendorIds = req.body.vendorIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('_id');
    const found = new Set(vendors.map((v) => String(v._id)));

    const results = [];
    for (const vendorId of vendorIds) {
      if (!found.has(String(vendorId))) continue;
      const doc = await InterviewVendorAllocation.findOneAndUpdate(
        { interviewId: interview._id, vendorId },
        {
          $set: {
            isActive: true,
            allocatedBy: req.user._id,
            allocatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      results.push(doc);
    }

    res.status(201).json({ items: results });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/allocations/:vendorId', async (req, res) => {
  try {
    const interview = await getPlatformInterviewOr404(req.params.id, res);
    if (!interview) return;

    const doc = await InterviewVendorAllocation.findOneAndUpdate(
      { interviewId: interview._id, vendorId: req.params.vendorId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Allocation not found' });
    res.json({ success: true, allocation: doc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
