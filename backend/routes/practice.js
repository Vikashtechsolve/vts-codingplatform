const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const CodingQuestion = require('../models/CodingQuestion');
const PracticeTopic = require('../models/PracticeTopic');
const PracticeSubmission = require('../models/PracticeSubmission');
const PracticeDailyChallenge = require('../models/PracticeDailyChallenge');
const Vendor = require('../models/Vendor');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  sanitizePracticeQuestion,
  sanitizePracticeQuestionList,
} = require('../utils/practice/sanitizePracticeQuestion');
const { submitPracticeSolution } = require('../utils/practice/practiceSubmissionService');
const { getProfileSummary, todayKey } = require('../utils/practice/practiceStatsService');
const {
  getRecommendations,
  getRoadmapProgress,
  getWeakTopicDrill,
} = require('../utils/practice/practiceRecommendationService');
const { getLeaderboard, getPercentile } = require('../utils/practice/practiceRankingService');
const { runCodeBatch, deriveSubmissionStatus } = require('../utils/practice/runCodeBatch');

const router = express.Router();

router.use(auth);
router.use(authorize('student'));

async function isPracticeEnabledForVendor(vendorId) {
  const vendor = await Vendor.findById(vendorId).select('settings.practice').lean();
  return vendor?.settings?.practice?.enabled !== false;
}

function buildStatusFilter(status, solvedIds, attemptedIds) {
  if (!status) return null;
  if (status === 'solved') return { _id: { $in: solvedIds } };
  if (status === 'attempted') return { _id: { $in: attemptedIds, $nin: solvedIds } };
  if (status === 'unsolved') return { _id: { $nin: solvedIds } };
  return null;
}

// GET /api/practice/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    if (!(await isPracticeEnabledForVendor(req.user.vendorId))) {
      return res.status(403).json({ message: 'Practice is disabled for your organization' });
    }

    const profile = await getProfileSummary(req.user._id);
    const [recommendations, roadmap, dailyChallenge, percentile] = await Promise.all([
      getRecommendations(req.user._id, profile, 6),
      getRoadmapProgress(req.user._id, profile),
      PracticeDailyChallenge.findOne({ date: todayKey() })
        .populate({
          path: 'questionId',
          select: 'title difficulty practiceTopics tags estimatedMinutes',
          populate: { path: 'practiceTopics', select: 'slug label' },
        })
        .lean(),
      getPercentile(req.user._id, req.user.vendorId),
    ]);

    const totalPractice = await CodingQuestion.countDocuments({
      isGlobal: true,
      practiceEnabled: true,
    });

    res.json({
      profile,
      recommendations,
      roadmap,
      dailyChallenge: dailyChallenge?.questionId || null,
      percentile,
      totalPracticeQuestions: totalPractice,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/questions
router.get('/questions', async (req, res) => {
  try {
    if (!(await isPracticeEnabledForVendor(req.user.vendorId))) {
      return res.status(403).json({ message: 'Practice is disabled for your organization' });
    }

    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const profile = await getProfileSummary(req.user._id);
    const solvedIds = profile.solvedQuestionIds || [];
    const attemptedIds = profile.attemptedQuestionIds || [];

    const filter = { isGlobal: true, practiceEnabled: true };
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;
    if (req.query.topic) filter.practiceTopics = req.query.topic;
    if (req.query.company) filter.companyTags = req.query.company;

    const statusFilter = buildStatusFilter(req.query.status, solvedIds, attemptedIds);
    if (statusFilter) Object.assign(filter, statusFilter);

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [{ title: regex }, { tags: regex }, { companyTags: regex }];
    }

    const sort = req.query.sort === 'difficulty' ? { difficulty: 1 } : { createdAt: -1 };

    const [items, total] = await Promise.all([
      CodingQuestion.find(filter)
        .select('title difficulty tags practiceTopics estimatedMinutes companyTags createdAt')
        .populate('practiceTopics', 'slug label')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      CodingQuestion.countDocuments(filter),
    ]);

    const solvedSet = new Set(solvedIds.map(String));
    const attemptedSet = new Set(attemptedIds.map(String));

    const mapped = items.map((q) => ({
      ...sanitizePracticeQuestionList(q),
      userStatus: solvedSet.has(String(q._id))
        ? 'solved'
        : attemptedSet.has(String(q._id))
          ? 'attempted'
          : 'unsolved',
    }));

    res.json(paginatedResponse({ items: mapped, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/questions/:id
router.get('/questions/:id', async (req, res) => {
  try {
    if (!(await isPracticeEnabledForVendor(req.user.vendorId))) {
      return res.status(403).json({ message: 'Practice is disabled for your organization' });
    }

    const question = await CodingQuestion.findOne({
      _id: req.params.id,
      isGlobal: true,
      practiceEnabled: true,
    })
      .populate('practiceTopics', 'slug label')
      .lean();

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const profile = await getProfileSummary(req.user._id);
    const solvedSet = new Set((profile.solvedQuestionIds || []).map(String));
    const attemptedSet = new Set((profile.attemptedQuestionIds || []).map(String));

    const lastSubmission = await PracticeSubmission.findOne({
      studentId: req.user._id,
      questionId: question._id,
    })
      .sort({ submittedAt: -1 })
      .select('code language status submittedAt passedTests totalTests')
      .lean();

    res.json({
      question: sanitizePracticeQuestion(question),
      userStatus: solvedSet.has(String(question._id))
        ? 'solved'
        : attemptedSet.has(String(question._id))
          ? 'attempted'
          : 'unsolved',
      lastSubmission,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /api/practice/questions/:id/run
router.post('/questions/:id/run', [
  body('code').notEmpty(),
  body('language').isIn(['java', 'cpp', 'c', 'python']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await CodingQuestion.findOne({
      _id: req.params.id,
      isGlobal: true,
      practiceEnabled: true,
    }).lean();

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const visibleCases = (question.testCases || []).filter((tc) => !tc.isHidden);
    const testCases = visibleCases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));

    const batchResult = await runCodeBatch({
      code: req.body.code,
      language: req.body.language,
      testCases,
    });

    res.json({
      ...batchResult,
      status: deriveSubmissionStatus(batchResult),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Run failed' });
  }
});

// POST /api/practice/questions/:id/submit
router.post('/questions/:id/submit', [
  body('code').notEmpty(),
  body('language').isIn(['java', 'cpp', 'c', 'python']),
  body('timeSpentMs').optional().isInt({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await submitPracticeSolution({
      studentId: req.user._id,
      vendorId: req.user.vendorId,
      questionId: req.params.id,
      code: req.body.code,
      language: req.body.language,
      timeSpentMs: req.body.timeSpentMs || 0,
    });

    res.json({
      accepted: result.accepted,
      status: result.submission.status,
      passedTests: result.submission.passedTests,
      totalTests: result.submission.totalTests,
      score: result.submission.score,
      batchResult: result.batchResult,
      profile: result.profile,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Submit failed' });
  }
});

// GET /api/practice/analytics
router.get('/analytics', async (req, res) => {
  try {
    const profile = await getProfileSummary(req.user._id);
    const topics = await PracticeTopic.find({ isActive: true }).sort({ order: 1 }).lean();

    const topicStats = topics.map((topic) => {
      const row = (profile.topicMastery || []).find(
        (t) => String(t.topicId) === String(topic._id)
      );
      return {
        topicId: topic._id,
        slug: topic.slug,
        label: topic.label,
        solved: row?.solved || 0,
        attempted: row?.attempted || 0,
        masteryScore: row?.masteryScore || 0,
        strength: row?.strength || 'weak',
      };
    });

    res.json({
      profile,
      topicStats,
      difficulty: profile.difficulty,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/skill-matrix
router.get('/skill-matrix', async (req, res) => {
  try {
    const profile = await getProfileSummary(req.user._id);
    const topics = await PracticeTopic.find({ isActive: true }).sort({ order: 1 }).lean();

    const matrix = topics.map((topic) => {
      const row = (profile.topicMastery || []).find(
        (t) => String(t.topicId) === String(topic._id)
      );
      return {
        topicId: topic._id,
        slug: topic.slug,
        label: topic.label,
        category: topic.category,
        solved: row?.solved || 0,
        attempted: row?.attempted || 0,
        masteryScore: row?.masteryScore || 0,
        strength: row?.strength || 'weak',
      };
    });

    res.json({ matrix, weakTopics: profile.weakTopics, strongTopics: profile.strongTopics });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const profile = await getProfileSummary(req.user._id);
    const recommendations = await getRecommendations(req.user._id, profile, 12);
    res.json({ recommendations });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/roadmap
router.get('/roadmap', async (req, res) => {
  try {
    const profile = await getProfileSummary(req.user._id);
    const roadmap = await getRoadmapProgress(req.user._id, profile);
    res.json({ roadmap });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/weak-drill
router.get('/weak-drill', async (req, res) => {
  try {
    const profile = await getProfileSummary(req.user._id);
    const questions = await getWeakTopicDrill(req.user._id, profile, 5);
    res.json({ questions });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/submissions
router.get('/submissions', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const filter = { studentId: req.user._id };

    const [items, total] = await Promise.all([
      PracticeSubmission.find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('questionId', 'title difficulty')
        .lean(),
      PracticeSubmission.countDocuments(filter),
    ]);

    res.json(paginatedResponse({ items, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.vendorId).select('settings.practice').lean();
    if (vendor?.settings?.practice?.showLeaderboard === false) {
      return res.status(403).json({ message: 'Leaderboard is disabled' });
    }

    const rows = await getLeaderboard({
      vendorId: req.user.vendorId,
      classroomId: req.query.classroomId,
      limit: 50,
    });
    const percentile = await getPercentile(req.user._id, req.user.vendorId);

    res.json({ leaderboard: rows, you: percentile });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /api/practice/daily-goal
router.put('/daily-goal', [body('target').isInt({ min: 1, max: 20 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const StudentPracticeProfile = require('../models/StudentPracticeProfile');
    const profile = await StudentPracticeProfile.findOneAndUpdate(
      { studentId: req.user._id },
      {
        $set: {
          'dailyGoal.target': req.body.target,
          vendorId: req.user.vendorId,
        },
      },
      { upsert: true, new: true }
    );

    res.json({ dailyGoal: profile.dailyGoal });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/practice/topics
router.get('/topics', async (req, res) => {
  try {
    const topics = await PracticeTopic.find({ isActive: true }).sort({ order: 1 }).lean();
    res.json(topics);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
