const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Vendor = require('../models/Vendor');
const StudentPracticeProfile = require('../models/StudentPracticeProfile');
const User = require('../models/User');
const { getLeaderboard } = require('../utils/practice/practiceRankingService');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

const router = express.Router();

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

router.get('/settings', async (req, res) => {
  const vendor = await Vendor.findById(req.vendorId).select('settings.practice').lean();
  res.json({
    practice: vendor?.settings?.practice || {
      enabled: true,
      defaultDailyGoal: 2,
      showLeaderboard: true,
      showGlobalRank: false,
    },
  });
});

router.put('/settings', async (req, res) => {
  const vendor = await Vendor.findById(req.vendorId);
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  vendor.settings = vendor.settings || {};
  vendor.settings.practice = {
    ...vendor.settings.practice,
    ...req.body,
  };
  await vendor.save();
  res.json({ practice: vendor.settings.practice });
});

router.get('/analytics/overview', async (req, res) => {
  const profiles = await StudentPracticeProfile.find({ vendorId: req.vendorId }).lean();
  const active = profiles.filter((p) => p.problemsAttempted > 0);

  const totals = active.reduce(
    (acc, p) => {
      acc.solved += p.problemsSolved || 0;
      acc.attempted += p.problemsAttempted || 0;
      acc.score += p.codingScore || 0;
      return acc;
    },
    { solved: 0, attempted: 0, score: 0 }
  );

  const topicWeakness = {};
  active.forEach((p) => {
    (p.topicMastery || []).forEach((t) => {
      if (!topicWeakness[t.slug]) {
        topicWeakness[t.slug] = { label: t.label, weak: 0, total: 0 };
      }
      topicWeakness[t.slug].total += 1;
      if (t.strength === 'weak' || t.strength === 'developing') {
        topicWeakness[t.slug].weak += 1;
      }
    });
  });

  res.json({
    totalStudents: profiles.length,
    activeStudents: active.length,
    avgSolved: active.length ? Math.round(totals.solved / active.length) : 0,
    avgCodingScore: active.length ? Math.round(totals.score / active.length) : 0,
    successRate: totals.attempted
      ? Math.round((totals.solved / totals.attempted) * 100)
      : 0,
    topicWeakness: Object.values(topicWeakness).sort((a, b) => b.weak - a.weak),
  });
});

router.get('/analytics/students', async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });

  const [items, total] = await Promise.all([
    StudentPracticeProfile.find({ vendorId: req.vendorId })
      .sort({ codingScore: -1 })
      .skip(skip)
      .limit(limit)
      .populate('studentId', 'name email')
      .lean(),
    StudentPracticeProfile.countDocuments({ vendorId: req.vendorId }),
  ]);

  res.json(paginatedResponse({ items, page, limit, total }));
});

router.get('/analytics/students/:studentId', async (req, res) => {
  const student = await User.findOne({
    _id: req.params.studentId,
    vendorId: req.vendorId,
    role: 'student',
  }).select('name email');

  if (!student) return res.status(404).json({ message: 'Student not found' });

  const profile = await StudentPracticeProfile.findOne({
    studentId: req.params.studentId,
    vendorId: req.vendorId,
  }).lean();

  res.json({ student, profile });
});

router.get('/analytics/classrooms/:classroomId', async (req, res) => {
  const students = await User.find({
    vendorId: req.vendorId,
    role: 'student',
    classrooms: req.params.classroomId,
  }).select('_id');

  const studentIds = students.map((s) => s._id);
  const profiles = await StudentPracticeProfile.find({
    vendorId: req.vendorId,
    studentId: { $in: studentIds },
  }).lean();

  const active = profiles.filter((p) => p.problemsAttempted > 0);
  const totals = active.reduce(
    (acc, p) => {
      acc.solved += p.problemsSolved || 0;
      acc.attempted += p.problemsAttempted || 0;
      return acc;
    },
    { solved: 0, attempted: 0 }
  );

  res.json({
    studentCount: studentIds.length,
    activeStudents: active.length,
    avgSolved: active.length ? Math.round(totals.solved / active.length) : 0,
    successRate: totals.attempted
      ? Math.round((totals.solved / totals.attempted) * 100)
      : 0,
    profiles,
  });
});

router.get('/leaderboard', async (req, res) => {
  const rows = await getLeaderboard({
    vendorId: req.vendorId,
    classroomId: req.query.classroomId,
    limit: 50,
  });
  res.json({ leaderboard: rows });
});

module.exports = router;
