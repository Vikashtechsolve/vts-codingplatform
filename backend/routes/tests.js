const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Test = require('../models/Test');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');
const TheoryQuestion = require('../models/TheoryQuestion');
const EnglishGrammarQuestion = require('../models/EnglishGrammarQuestion');
const EnglishVocabularyQuestion = require('../models/EnglishVocabularyQuestion');
const EnglishReadingQuestion = require('../models/EnglishReadingQuestion');
const EnglishEssayQuestion = require('../models/EnglishEssayQuestion');
const EnglishSpeakingQuestion = require('../models/EnglishSpeakingQuestion');
const EnglishListeningQuestion = require('../models/EnglishListeningQuestion');
const User = require('../models/User');
const Result = require('../models/Result');
const {
  enrollStudentsInTest,
  assignTestToClassrooms,
} = require('../utils/assignToClassroom');
const {
  attachScheduleToTest,
  validateScheduleInput,
  parseScheduleDateInput,
} = require('../utils/testSchedule');
const { findPublishedContestByAssessment } = require('../utils/contestService');
const { getEffectiveAllowedLanguages } = require('../utils/codingQuestion');

const ENGLISH_QUESTION_MODELS = {
  english_grammar: EnglishGrammarQuestion,
  english_vocabulary: EnglishVocabularyQuestion,
  english_reading: EnglishReadingQuestion,
  english_essay: EnglishEssayQuestion,
  english_speaking: EnglishSpeakingQuestion,
  english_listening: EnglishListeningQuestion
};

// Create test (vendor admin only)
router.post('/', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware,
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type').isIn(['coding', 'mcq', 'aptitude', 'theory', 'mixed', 'sql', 'english']).withMessage('Invalid test type'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute')
], async (req, res) => {
  try {
    console.log('📥 Creating test:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, type, duration, questions, startDate, endDate, settings, datasetTemplateId } = req.body;

    const parsedStartDate = parseScheduleDateInput(startDate);
    const parsedEndDate = parseScheduleDateInput(endDate);
    const scheduleError = validateScheduleInput({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    console.log('📋 Test details:', { title, type, duration, questionsCount: questions?.length });

    if (type === 'sql') {
      if (!datasetTemplateId) {
        return res.status(400).json({ message: 'SQL tests require a dataset template (datasetTemplateId)' });
      }
      const DatasetTemplate = require('../models/DatasetTemplate');
      const template = await DatasetTemplate.findOne({ _id: datasetTemplateId, vendorId: req.vendorId });
      if (!template) {
        return res.status(400).json({ message: 'Dataset template not found or not owned by vendor' });
      }
      const test = new Test({
        title,
        description: description || '',
        vendorId: req.vendorId,
        createdBy: req.user._id,
        type: 'sql',
        datasetTemplateId,
        duration,
        questions: [],
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        settings: settings || {}
      });
      await test.save();
      const Vendor = require('../models/Vendor');
      await Vendor.findByIdAndUpdate(req.vendorId, { $inc: { 'stats.totalTests': 1 } });
      return res.status(201).json(test);
    }

    // Validate questions for non-SQL tests
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
      } else if (q.type === 'aptitude') {
        question = await AptitudeQuestion.findOne({
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
        console.log(`   Aptitude question ${q.questionId}: ${question ? '✅ Found' : '❌ Not found'}`);
      } else if (q.type === 'theory') {
        question = await TheoryQuestion.findOne({
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
        console.log(`   Theory question ${q.questionId}: ${question ? '✅ Found' : '❌ Not found'}`);
      } else if (ENGLISH_QUESTION_MODELS[q.type]) {
        const Model = ENGLISH_QUESTION_MODELS[q.type];
        question = await Model.findOne({
          _id: q.questionId,
          $or: [
            { vendorId: req.vendorId, $or: [{ isGlobal: false }, { isGlobal: { $exists: false } }] },
            { isGlobal: true }
          ]
        });
        console.log(`   English ${q.type} question ${q.questionId}: ${question ? '✅ Found' : '❌ Not found'}`);
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

    const TYPE_TO_MODEL = {
      coding: 'CodingQuestion',
      mcq: 'MCQQuestion',
      aptitude: 'AptitudeQuestion',
      theory: 'TheoryQuestion',
      english_grammar: 'EnglishGrammarQuestion',
      english_vocabulary: 'EnglishVocabularyQuestion',
      english_reading: 'EnglishReadingQuestion',
      english_essay: 'EnglishEssayQuestion',
      english_speaking: 'EnglishSpeakingQuestion',
      english_listening: 'EnglishListeningQuestion'
    };

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
        questionType: q.questionType || TYPE_TO_MODEL[q.type] || 'MCQQuestion',
        points: q.points || 10,
        order: q.order || index + 1,
        sectionId: q.sectionId || undefined
      })),
      englishSections: req.body.englishSections || [],
      startDate: parsedStartDate,
      endDate: parsedEndDate,
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
    const TheoryQuestion = require('../models/TheoryQuestion');
    const SQLQuestion = require('../models/SQLQuestion');

    const populatedQuestions = [];
    for (const q of test.questions) {
      let questionData;
      try {
        if (q.type === 'coding') {
          const codingDoc = await CodingQuestion.findById(q.questionId);
          if (codingDoc) {
            questionData = codingDoc.toObject();
            questionData.allowedLanguages = getEffectiveAllowedLanguages(questionData);
          }
        } else if (q.type === 'mcq') {
          questionData = await MCQQuestion.findById(q.questionId);
        } else if (q.type === 'aptitude') {
          questionData = await AptitudeQuestion.findById(q.questionId);
        } else if (q.type === 'theory') {
          questionData = await TheoryQuestion.findById(q.questionId)
            .populate('subjectId', 'name')
            .populate('topicId', 'name');
        } else if (q.type === 'sql') {
          const sqlQ = await SQLQuestion.findById(q.questionId).select('text marks order');
          questionData = sqlQ ? { _id: sqlQ._id, text: sqlQ.text, marks: sqlQ.marks, order: sqlQ.order } : null;
        } else if (ENGLISH_QUESTION_MODELS[q.type]) {
          questionData = await ENGLISH_QUESTION_MODELS[q.type].findById(q.questionId);
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

    if (test.type === 'sql' && test.datasetTemplateId) {
      const DatasetTemplate = require('../models/DatasetTemplate');
      const template = await DatasetTemplate.findById(test.datasetTemplateId)
        .select('name schemaSql dataSql');
      testObj.datasetTemplate = template
        ? {
            _id: template._id,
            name: template.name,
            schemaSql: template.schemaSql,
            dataSql: template.dataSql
          }
        : null;
    }

    console.log(`✅ Test fetched: ${testObj.title}, Questions: ${populatedQuestions.length}/${test.questions.length}`);
    
    if (populatedQuestions.length === 0) {
      console.log('⚠️  Warning: Test has no valid questions');
    }

    if (req.user.role === 'student') {
      const student = await User.findById(req.user._id).select('enrolledTests');
      const enrollment = student?.enrolledTests?.find(
        (et) => et.testId.toString() === test._id.toString()
      );
      const enrollmentStatus = enrollment?.status || 'assigned';
      const activeContest = await findPublishedContestByAssessment(
        'test',
        test._id,
        req.user._id
      );
      return res.json(
        attachScheduleToTest(
          {
            ...testObj,
            enrollmentStatus,
            ...(activeContest ? { contestId: activeContest._id } : {}),
          },
          enrollmentStatus,
          undefined,
          { skipSchedule: Boolean(activeContest) }
        )
      );
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

    const { title, description, duration, questions, startDate, endDate, isActive, settings, englishSections, datasetTemplateId } = req.body;

    const hasStartDate = Object.prototype.hasOwnProperty.call(req.body, 'startDate');
    const hasEndDate = Object.prototype.hasOwnProperty.call(req.body, 'endDate');
    const parsedStartDate = hasStartDate ? parseScheduleDateInput(startDate) : test.startDate;
    const parsedEndDate = hasEndDate ? parseScheduleDateInput(endDate) : test.endDate;
    const scheduleError = validateScheduleInput({
      startDate: parsedStartDate,
      endDate: parsedEndDate,
    });
    if (scheduleError) {
      return res.status(400).json({ message: scheduleError });
    }

    if (title) test.title = title;
    if (description !== undefined) test.description = description;
    if (duration) test.duration = duration;
    if (questions) test.questions = questions;
    if (hasStartDate) test.startDate = parsedStartDate;
    if (hasEndDate) test.endDate = parsedEndDate;
    if (isActive !== undefined) test.isActive = isActive;
    if (settings) test.settings = { ...test.settings, ...settings };
    if (englishSections !== undefined) test.englishSections = englishSections;
    if (test.type === 'sql' && datasetTemplateId) test.datasetTemplateId = datasetTemplateId;

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

// Assign test to students and/or classrooms
router.post('/:id/assign', [
  auth,
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

    const test = await Test.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
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
      const result = await assignTestToClassrooms(
        test._id,
        classroomIds,
        req.vendorId,
        req.user._id
      );
      classroomEnrolled = result.enrolledCount;
    }

    if (studentIds.length > 0) {
      assigned = await enrollStudentsInTest(test._id, studentIds, req.vendorId);
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
        ? `Test assigned successfully to ${parts.join(' and ')}`
        : 'Test was already assigned to the selected audience',
      assigned,
      classroomEnrolled,
      totalNew,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

