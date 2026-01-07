const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Test = require('../models/Test');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const User = require('../models/User');
const Result = require('../models/Result');

// Create test (vendor admin only)
router.post('/', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type').isIn(['coding', 'mcq', 'mixed']).withMessage('Invalid test type'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
], async (req, res) => {
  try {
    console.log('📥 Creating test:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, type, duration, questions, startDate, endDate, settings } = req.body;

    console.log('📋 Test details:', { title, type, duration, questionsCount: questions?.length });

    // Validate questions
    if (!questions || questions.length === 0) {
      console.log('❌ No questions provided');
      return res.status(400).json({ message: 'At least one question is required' });
    }

    // Verify all questions belong to the vendor OR are global
    console.log('🔍 Verifying questions belong to vendor or are global...');
    for (const q of questions) {
      let question;
      if (q.type === 'coding') {
        question = await CodingQuestion.findOne({
          _id: q.questionId,
          $or: [
            { 
              vendorId: req.vendorId, 
              $or: [
                { isGlobal: false },
                { isGlobal: { $exists: false } } // Include old questions
              ]
            },
            { isGlobal: true }
          ]
        });
        console.log(`   Coding question ${q.questionId}: ${question ? '✅ Found' : '❌ Not found'}`);
      } else if (q.type === 'mcq') {
        question = await MCQQuestion.findOne({
          _id: q.questionId,
          $or: [
            { 
              vendorId: req.vendorId, 
              $or: [
                { isGlobal: false },
                { isGlobal: { $exists: false } } // Include old questions
              ]
            },
            { isGlobal: true }
          ]
        });
        console.log(`   MCQ question ${q.questionId}: ${question ? '✅ Found' : '❌ Not found'}`);
      } else {
        console.log(`   ❌ Unknown question type: ${q.type}`);
        return res.status(400).json({ message: `Invalid question type: ${q.type}` });
      }

      if (!question) {
        console.log(`   ❌ Question ${q.questionId} not found or not accessible`);
        return res.status(400).json({ message: `Question ${q.questionId} not found or not accessible` });
      }
    }
    console.log('✅ All questions verified');

    const test = new Test({
      title,
      description,
      vendorId: req.vendorId,
      createdBy: req.user._id,
      type,
      duration,
      questions: questions.map((q, index) => ({
        type: q.type,
        questionId: q.questionId,
        questionType: q.type === 'coding' ? 'CodingQuestion' : 'MCQQuestion',
        points: q.points || 10,
        order: q.order || index + 1
      })),
      startDate,
      endDate,
      settings: settings || {}
    });

    await test.save();

    console.log('✅ Test created successfully:', test._id);

    // Update vendor stats
    const Vendor = require('../models/Vendor');
    await Vendor.findByIdAndUpdate(req.vendorId, { $inc: { 'stats.totalTests': 1 } });

    res.status(201).json(test);
  } catch (error) {
    console.error('❌ Error creating test:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all tests (vendor admin) or assigned tests (student)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role === 'vendor_admin') {
      const tests = await Test.find({ vendorId: req.user.vendorId })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      return res.json(tests);
    } else if (req.user.role === 'student') {
      // Get assigned tests
      const assignedTestIds = req.user.enrolledTests.map(et => et.testId);
      const tests = await Test.find({
        _id: { $in: assignedTestIds },
        vendorId: req.user.vendorId,
        isActive: true
      })
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      return res.json(tests);
    }

    res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single test
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('📥 Fetching test:', req.params.id, 'for user:', req.user.role);
    
    const test = await Test.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!test) {
      console.log('❌ Test not found:', req.params.id);
      return res.status(404).json({ message: 'Test not found' });
    }

    // Check access
    if (req.user.role === 'vendor_admin' && test.vendorId.toString() !== req.user.vendorId.toString()) {
      console.log('❌ Vendor admin access denied');
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'student') {
      const student = await User.findById(req.user._id);
      const isEnrolled = student.enrolledTests.some(et => et.testId.toString() === test._id.toString());
      if (!isEnrolled) {
        console.log('❌ Student not enrolled in test');
        return res.status(403).json({ message: 'Test not assigned to you' });
      }
    }

    // Populate questions based on type
    const CodingQuestion = require('../models/CodingQuestion');
    const MCQQuestion = require('../models/MCQQuestion');
    
    const populatedQuestions = [];
    for (const q of test.questions) {
      let questionData;
      try {
        if (q.type === 'coding') {
          questionData = await CodingQuestion.findById(q.questionId);
        } else if (q.type === 'mcq') {
          questionData = await MCQQuestion.findById(q.questionId);
        }
        
        if (questionData) {
          populatedQuestions.push({
            ...q.toObject(),
            questionId: questionData
          });
        } else {
          console.log(`⚠️  Question ${q.questionId} not found (type: ${q.type})`);
        }
      } catch (err) {
        console.error(`❌ Error loading question ${q.questionId}:`, err);
      }
    }

    const testObj = test.toObject();
    testObj.questions = populatedQuestions;

    console.log(`✅ Test fetched: ${testObj.title}, Questions: ${populatedQuestions.length}/${test.questions.length}`);
    
    if (populatedQuestions.length === 0) {
      console.log('⚠️  Warning: Test has no valid questions');
    }
    
    res.json(testObj);
  } catch (error) {
    console.error('❌ Error fetching test:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update test
router.put('/:id', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware
], async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const { title, description, duration, questions, startDate, endDate, isActive, settings } = req.body;

    if (title) test.title = title;
    if (description !== undefined) test.description = description;
    if (duration) test.duration = duration;
    if (questions) test.questions = questions;
    if (startDate) test.startDate = startDate;
    if (endDate) test.endDate = endDate;
    if (isActive !== undefined) test.isActive = isActive;
    if (settings) test.settings = { ...test.settings, ...settings };

    await test.save();
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete test
router.delete('/:id', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware
], async (req, res) => {
  try {
    const test = await Test.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Delete associated results
    await Result.deleteMany({ testId: test._id });

    await Test.findByIdAndDelete(req.params.id);
    res.json({ message: 'Test deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign test to students
router.post('/:id/assign', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware,
  body('studentIds').isArray().withMessage('Student IDs must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const test = await Test.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
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

      // Check if already assigned
      const alreadyAssigned = student.enrolledTests.some(
        et => et.testId.toString() === test._id.toString()
      );

      if (!alreadyAssigned) {
        student.enrolledTests.push({
          testId: test._id,
          status: 'assigned'
        });
        await student.save();
        assigned.push(studentId);
      }
    }

    res.json({ message: 'Test assigned successfully', assigned });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

