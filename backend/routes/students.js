const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const User = require('../models/User');
const Test = require('../models/Test');
const Result = require('../models/Result');
const {
  loadBrandingForUser,
  resolveVendorIdForUser,
} = require('../utils/vendorBranding');

// Organization branding (logo + colors) for the logged-in student
router.get('/branding', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const vendorId = await resolveVendorIdForUser(req.user);
    const branding = await loadBrandingForUser(req.user);

    res.json({
      vendorId: vendorId || null,
      ...(branding || { logo: null, companyName: null, settings: null }),
    });
  } catch (error) {
    console.error('GET /students/branding error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get student profile
router.get('/profile', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const student = await User.findById(req.user._id)
      .select('-password')
      .populate('enrolledTests.testId', 'title type duration');
    
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get assigned tests
router.get('/tests', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const student = await User.findById(req.user._id);
    const testIds = student.enrolledTests.map(et => et.testId);

    const tests = await Test.find({
      _id: { $in: testIds },
      isActive: true
    })
      .select('title description type duration startDate endDate questions.type')
      .sort({ createdAt: -1 });

    // Add enrollment status and result ID
    const testsWithStatus = await Promise.all(tests.map(async (test) => {
      const enrollment = student.enrolledTests.find(
        et => et.testId.toString() === test._id.toString()
      );
      
      // Find result summary if test is completed
      let resultId = null;
      let percentage = null;
      let submittedAt = null;
      if (enrollment && enrollment.status === 'completed') {
        const result = await Result.findOne({
          testId: test._id,
          studentId: student._id,
          status: 'completed'
        })
          .sort({ submittedAt: -1 })
          .select('_id percentage submittedAt');
        if (result) {
          resultId = result._id;
          percentage = result.percentage ?? null;
          submittedAt = result.submittedAt ?? null;
        }
      }

      const testObj = test.toObject();
      // Treat mixed tests that only contain English question types as English for student dashboard grouping
      if (testObj.type === 'mixed' && Array.isArray(testObj.questions) && testObj.questions.length > 0 &&
          testObj.questions.every(q => (q.type || '').startsWith('english_'))) {
        testObj.type = 'english';
      }
      delete testObj.questions;

      return {
        ...testObj,
        enrollmentStatus: enrollment ? enrollment.status : 'assigned',
        assignedAt: enrollment ? enrollment.assignedAt : null,
        resultId,
        percentage,
        submittedAt
      };
    }));

    res.json(testsWithStatus);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// English performance trends - aggregates section scores across completed English tests
router.get('/english-trends', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const results = await Result.find({
      studentId: req.user._id,
      status: 'completed',
      sectionScores: { $exists: true, $ne: [] }
    })
      .populate('testId', 'title type')
      .select('testId sectionScores totalScore maxScore percentage submittedAt')
      .sort({ submittedAt: 1 });

    const englishResults = results.filter(r => r.testId?.type === 'english');

    const trends = englishResults.map(r => ({
      testId: r.testId?._id,
      testTitle: r.testId?.title,
      submittedAt: r.submittedAt,
      overallPercentage: r.percentage || 0,
      sections: (r.sectionScores || []).reduce((acc, sec) => {
        acc[sec.sectionType] = {
          score: sec.score,
          maxScore: sec.maxScore,
          percentage: sec.percentage || (sec.maxScore > 0 ? Math.round((sec.score / sec.maxScore) * 100) : 0)
        };
        return acc;
      }, {})
    }));

    const sectionTypes = ['english_grammar', 'english_vocabulary', 'english_reading', 'english_essay', 'english_speaking', 'english_listening'];
    const sectionAverages = {};
    sectionTypes.forEach(type => {
      const scores = trends
        .filter(t => t.sections[type])
        .map(t => t.sections[type].percentage);
      sectionAverages[type] = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;
    });

    const latestResult = trends.length > 0 ? trends[trends.length - 1] : null;
    const previousResult = trends.length > 1 ? trends[trends.length - 2] : null;
    const improvement = latestResult && previousResult
      ? latestResult.overallPercentage - previousResult.overallPercentage
      : null;

    res.json({
      totalTests: trends.length,
      trends,
      sectionAverages,
      latestPercentage: latestResult?.overallPercentage || null,
      improvement
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

