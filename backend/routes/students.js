const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const User = require('../models/User');
const Test = require('../models/Test');
const Result = require('../models/Result');

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
      .select('title description type duration startDate endDate')
      .sort({ createdAt: -1 });

    // Add enrollment status and result ID
    const testsWithStatus = await Promise.all(tests.map(async (test) => {
      const enrollment = student.enrolledTests.find(
        et => et.testId.toString() === test._id.toString()
      );
      
      // Find result ID if test is completed
      let resultId = null;
      if (enrollment && enrollment.status === 'completed') {
        const result = await Result.findOne({
          testId: test._id,
          studentId: student._id,
          status: 'completed'
        }).select('_id');
        if (result) {
          resultId = result._id;
        }
      }
      
      return {
        ...test.toObject(),
        enrollmentStatus: enrollment ? enrollment.status : 'assigned',
        assignedAt: enrollment ? enrollment.assignedAt : null,
        resultId: resultId
      };
    }));

    res.json(testsWithStatus);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

