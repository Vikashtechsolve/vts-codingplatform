const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');
const TheoryQuestion = require('../models/TheoryQuestion');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const { resolveTagsForSave } = require('../utils/questionTags');
const { fetchPaginatedQuestions } = require('../utils/questionListQuery');

const CODING_LIST_SELECT =
  'title description difficulty allowedLanguages tags createdAt updatedAt vendorId isGlobal createdBy';
const MCQ_LIST_SELECT =
  'question category difficulty tags createdAt updatedAt vendorId isGlobal createdBy options correctOptions';
const APTITUDE_LIST_SELECT =
  'question section subCategory questionType difficulty tags createdAt updatedAt vendorId isGlobal createdBy';
const THEORY_LIST_SELECT =
  'questionText subjectId topicId difficulty tags createdAt updatedAt vendorId isGlobal createdBy';

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

const normalizeOptionIndexes = (indexes = []) => {
  if (!Array.isArray(indexes)) return [];
  return [...new Set(indexes.map(val => parseInt(val, 10)).filter(val => !Number.isNaN(val)))];
};

const validateAptitudePayload = (payload) => {
  const errors = [];
  const {
    question,
    questionType,
    options,
    correctOptions,
    numericAnswer,
    numericTolerance,
    section
  } = payload;

  if (!question || !question.trim()) {
    errors.push('Question text is required');
  }

  if (!['single', 'multi', 'numeric', 'case_study'].includes(questionType)) {
    errors.push('Invalid question type');
  }

  if (!['quantitative', 'logical', 'analytical'].includes(section)) {
    errors.push('Invalid section');
  }

  if (questionType === 'numeric') {
    const parsedAnswer = parseFloat(numericAnswer);
    if (Number.isNaN(parsedAnswer)) {
      errors.push('Numeric answer is required');
    }
    if (numericTolerance !== undefined && Number.isNaN(parseFloat(numericTolerance))) {
      errors.push('Numeric tolerance must be a number');
    }
    return errors;
  }

  const validOptions = (options || []).filter(opt => opt && opt.text && opt.text.trim());
  if (validOptions.length < 2) {
    errors.push('At least 2 options are required');
  }

  const normalizedCorrect = normalizeOptionIndexes(correctOptions);
  if (normalizedCorrect.length === 0) {
    errors.push('At least one correct option is required');
  }

  if (['single', 'case_study'].includes(questionType) && normalizedCorrect.length !== 1) {
    errors.push('Single/case study questions must have exactly one correct option');
  }

  if (normalizedCorrect.some(idx => idx < 0 || idx >= validOptions.length)) {
    errors.push('Correct options must match available options');
  }

  return errors;
};

// Create coding question
router.post('/coding', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('allowedLanguages').isArray().withMessage('Allowed languages must be an array'),
  body('testCases').isArray().withMessage('Test cases must be an array'),
  body('testCases').custom((value) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('At least one test case is required');
    }
    return true;
  })
], async (req, res) => {
  try {
    console.log('📥 Creating coding question for vendor:', req.vendorId);
    console.log('   Title:', req.body.title);
    console.log('   Allowed languages:', req.body.allowedLanguages);
    console.log('   Test cases:', req.body.testCases?.length || 0);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      difficulty,
      allowedLanguages,
      testCases,
      starterCode,
      solution,
      constraints,
      examples,
      tags
    } = req.body;

    // Validate allowed languages
    if (!allowedLanguages || allowedLanguages.length === 0) {
      return res.status(400).json({ message: 'At least one allowed language is required' });
    }

    // Validate test cases
    if (!testCases || testCases.length === 0) {
      return res.status(400).json({ message: 'At least one test case is required' });
    }

    const resolvedTags = await resolveTagsForSave(req.vendorId, tags, req.user._id);

    const question = new CodingQuestion({
      title: title.trim(),
      description: description.trim(),
      difficulty: difficulty || 'medium',
      vendorId: req.vendorId,
      isGlobal: false, // Explicitly set to false for vendor questions
      createdBy: req.user._id,
      allowedLanguages: allowedLanguages || [],
      testCases: testCases || [],
      starterCode: starterCode || {},
      solution: solution || {},
      constraints: constraints || '',
      examples: examples || [],
      tags: resolvedTags
    });

    await question.save();
    console.log('✅ Coding question created:', question._id);
    res.status(201).json(question);
  } catch (error) {
    console.error('❌ Error creating coding question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get coding questions (paginated list — lean fields for vendor panel)
router.get('/coding', async (req, res) => {
  try {
    console.log('📥 Fetching coding questions for vendor:', req.vendorId);
    const source = req.query.source === 'global' ? 'global' : 'vendor';
    const payload = await fetchPaginatedQuestions({
      Model: CodingQuestion,
      vendorId: req.vendorId,
      source,
      query: req.query,
      listSelect: CODING_LIST_SELECT,
      searchFields: ['title', 'description', 'difficulty'],
      populateGlobal: { path: 'createdBy', select: 'name email' },
    });
    console.log(`✅ Coding ${source}: ${payload.items.length}/${payload.total}`);
    res.json(payload);
  } catch (error) {
    console.error('❌ Error fetching coding questions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single coding question (vendor-specific or global)
router.get('/coding/:id', async (req, res) => {
  try {
    const question = await CodingQuestion.findOne({
      _id: req.params.id,
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
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    const questionObj = question.toObject();
    questionObj.source = question.isGlobal ? 'global' : 'vendor';
    res.json(questionObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update coding question (only vendor's own questions)
router.put('/coding/:id', async (req, res) => {
  try {
    const question = await CodingQuestion.findOne({
      _id: req.params.id,
      vendorId: req.vendorId,
      $or: [
        { isGlobal: false },
        { isGlobal: { $exists: false } } // Include old questions
      ]
    });
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found or you cannot edit this question' });
    }

    if (req.body.tags !== undefined) {
      req.body.tags = await resolveTagsForSave(req.vendorId, req.body.tags, req.user._id);
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== 'isGlobal' && key !== 'vendorId' && key !== 'createdBy') {
        question[key] = req.body[key];
      }
    });

    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete coding question
router.delete('/coding/:id', async (req, res) => {
  try {
    const question = await CodingQuestion.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create MCQ question
router.post('/mcq', [
  body('question').notEmpty().withMessage('Question is required'),
  body('options').isArray().withMessage('Options must be an array'),
  body('options').custom((value) => {
    if (!Array.isArray(value) || value.length < 2) {
      throw new Error('At least 2 options are required');
    }
    return true;
  }),
  body('options.*.text').notEmpty().withMessage('Option text is required')
], async (req, res) => {
  try {
    console.log('📥 Creating MCQ question for vendor:', req.vendorId);
    console.log('   Question:', req.body.question?.substring(0, 50));
    console.log('   Options:', req.body.options?.length || 0);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { question, options, explanation, difficulty, category, points, tags } = req.body;

    // Filter out empty options
    const validOptions = (options || []).filter(opt => opt.text && opt.text.trim());
    
    if (validOptions.length < 2) {
      return res.status(400).json({ message: 'At least 2 valid options are required' });
    }

    // Validate that at least one option is correct
    const hasCorrectAnswer = validOptions.some(opt => opt.isCorrect);
    if (!hasCorrectAnswer) {
      return res.status(400).json({ message: 'At least one option must be marked as correct' });
    }

    const resolvedTags = await resolveTagsForSave(req.vendorId, tags, req.user._id);

    const mcqQuestion = new MCQQuestion({
      question: question.trim(),
      options: validOptions,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      vendorId: req.vendorId,
      isGlobal: false, // Explicitly set to false for vendor questions
      createdBy: req.user._id,
      category: category || '',
      points: points || 10,
      tags: resolvedTags
    });

    await mcqQuestion.save();
    console.log('✅ MCQ question created:', mcqQuestion._id);
    res.status(201).json(mcqQuestion);
  } catch (error) {
    console.error('❌ Error creating MCQ question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get MCQ questions (paginated list)
router.get('/mcq', async (req, res) => {
  try {
    const source = req.query.source === 'global' ? 'global' : 'vendor';
    const payload = await fetchPaginatedQuestions({
      Model: MCQQuestion,
      vendorId: req.vendorId,
      source,
      query: req.query,
      listSelect: MCQ_LIST_SELECT,
      searchFields: ['question', 'category', 'difficulty'],
      populateGlobal: { path: 'createdBy', select: 'name email' },
    });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single MCQ question (vendor-specific or global)
router.get('/mcq/:id', async (req, res) => {
  try {
    const question = await MCQQuestion.findOne({
      _id: req.params.id,
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
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    const questionObj = question.toObject();
    questionObj.source = question.isGlobal ? 'global' : 'vendor';
    res.json(questionObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update MCQ question (only vendor's own questions)
router.put('/mcq/:id', async (req, res) => {
  try {
    const question = await MCQQuestion.findOne({
      _id: req.params.id,
      vendorId: req.vendorId,
      $or: [
        { isGlobal: false },
        { isGlobal: { $exists: false } } // Include old questions
      ]
    });
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found or you cannot edit this question' });
    }

    if (req.body.tags !== undefined) {
      req.body.tags = await resolveTagsForSave(req.vendorId, req.body.tags, req.user._id);
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== 'isGlobal' && key !== 'vendorId' && key !== 'createdBy') {
        question[key] = req.body[key];
      }
    });

    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete MCQ question
router.delete('/mcq/:id', async (req, res) => {
  try {
    const question = await MCQQuestion.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create aptitude question
router.post('/aptitude', [
  body('question').notEmpty().withMessage('Question is required'),
  body('questionType').isIn(['single', 'multi', 'numeric', 'case_study']).withMessage('Invalid question type'),
  body('section').isIn(['quantitative', 'logical', 'analytical']).withMessage('Invalid section')
], async (req, res) => {
  try {
    console.log('📥 Creating aptitude question for vendor:', req.vendorId);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const validationErrors = validateAptitudePayload(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const {
      question,
      caseStudy,
      questionType,
      options,
      correctOptions,
      numericAnswer,
      numericTolerance,
      section,
      subCategory,
      explanation,
      difficulty,
      points,
      tags
    } = req.body;

    const validOptions = (options || []).filter(opt => opt && opt.text && opt.text.trim());
    const normalizedCorrect = normalizeOptionIndexes(correctOptions);
    const resolvedTags = await resolveTagsForSave(req.vendorId, tags, req.user._id);

    const aptitudeQuestion = new AptitudeQuestion({
      question: question.trim(),
      caseStudy: caseStudy || '',
      questionType,
      options: questionType === 'numeric' ? [] : validOptions,
      correctOptions: questionType === 'numeric' ? [] : normalizedCorrect,
      numericAnswer: questionType === 'numeric' ? parseFloat(numericAnswer) : null,
      numericTolerance: questionType === 'numeric' ? parseFloat(numericTolerance || 0) : 0,
      section,
      subCategory: subCategory || '',
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      vendorId: req.vendorId,
      isGlobal: false,
      createdBy: req.user._id,
      points: points || 10,
      tags: resolvedTags
    });

    await aptitudeQuestion.save();
    console.log('✅ Aptitude question created:', aptitudeQuestion._id);
    res.status(201).json(aptitudeQuestion);
  } catch (error) {
    console.error('❌ Error creating aptitude question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get aptitude questions (paginated list)
router.get('/aptitude', async (req, res) => {
  try {
    const source = req.query.source === 'global' ? 'global' : 'vendor';
    const payload = await fetchPaginatedQuestions({
      Model: AptitudeQuestion,
      vendorId: req.vendorId,
      source,
      query: req.query,
      listSelect: APTITUDE_LIST_SELECT,
      searchFields: ['question', 'section', 'subCategory', 'questionType'],
      populateGlobal: { path: 'createdBy', select: 'name email' },
    });
    res.json(payload);
  } catch (error) {
    console.error('❌ Error fetching aptitude questions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single aptitude question (vendor-specific or global)
router.get('/aptitude/:id', async (req, res) => {
  try {
    const question = await AptitudeQuestion.findOne({
      _id: req.params.id,
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
      return res.status(404).json({ message: 'Question not found' });
    }
    const questionObj = question.toObject();
    questionObj.source = question.isGlobal ? 'global' : 'vendor';
    res.json(questionObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update aptitude question (only vendor's own questions)
router.put('/aptitude/:id', async (req, res) => {
  try {
    const question = await AptitudeQuestion.findOne({
      _id: req.params.id,
      vendorId: req.vendorId,
      $or: [
        { isGlobal: false },
        { isGlobal: { $exists: false } }
      ]
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found or you cannot edit this question' });
    }

    const mergedPayload = { ...question.toObject(), ...req.body };
    const validationErrors = validateAptitudePayload(mergedPayload);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const updatedOptions = (mergedPayload.options || []).filter(opt => opt && opt.text && opt.text.trim());
    const normalizedCorrect = normalizeOptionIndexes(mergedPayload.correctOptions);

    if (req.body.tags !== undefined) {
      req.body.tags = await resolveTagsForSave(req.vendorId, req.body.tags, req.user._id);
    }

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== 'isGlobal' && key !== 'vendorId' && key !== 'createdBy') {
        question[key] = req.body[key];
      }
    });

    if (question.questionType === 'numeric') {
      question.options = [];
      question.correctOptions = [];
      question.numericAnswer = parseFloat(mergedPayload.numericAnswer);
      question.numericTolerance = parseFloat(mergedPayload.numericTolerance || 0);
    } else {
      question.options = updatedOptions;
      question.correctOptions = normalizedCorrect;
      question.numericAnswer = null;
      question.numericTolerance = 0;
    }

    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete aptitude question
router.delete('/aptitude/:id', async (req, res) => {
  try {
    const question = await AptitudeQuestion.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create theory question
router.post('/theory', [
  body('questionText').trim().notEmpty().withMessage('Question text is required'),
  body('subjectId').notEmpty().withMessage('Subject is required'),
  body('referenceAnswer').notEmpty().withMessage('Reference answer is required'),
  body('maxMarks').optional().isNumeric().withMessage('Max marks must be a number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      questionText,
      subjectId,
      topicId,
      difficulty,
      maxMarks,
      expectedAnswerLength,
      referenceAnswer,
      keywords,
      evaluationRubric,
      evaluationConfig,
      tags
    } = req.body;

    const subject = await Subject.findOne({ _id: subjectId, vendorId: req.vendorId });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    let topic = null;
    if (topicId) {
      topic = await Topic.findOne({ _id: topicId, vendorId: req.vendorId });
      if (!topic) {
        return res.status(404).json({ message: 'Topic not found' });
      }
    }

    const resolvedTags = await resolveTagsForSave(req.vendorId, tags, req.user._id);

    const theoryQuestion = new TheoryQuestion({
      questionText: questionText.trim(),
      subjectId: subject._id,
      topicId: topic ? topic._id : undefined,
      difficulty: difficulty || 'medium',
      maxMarks: maxMarks || 10,
      expectedAnswerLength: expectedAnswerLength || 150,
      referenceAnswer,
      keywords: Array.isArray(keywords) ? keywords : [],
      evaluationRubric: evaluationRubric || '',
      evaluationConfig: evaluationConfig || {},
      tags: resolvedTags,
      vendorId: req.vendorId,
      isGlobal: false,
      createdBy: req.user._id
    });

    await theoryQuestion.save();
    res.status(201).json(theoryQuestion);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get theory questions (paginated list)
router.get('/theory', async (req, res) => {
  try {
    const source = req.query.source === 'global' ? 'global' : 'vendor';
    const payload = await fetchPaginatedQuestions({
      Model: TheoryQuestion,
      vendorId: req.vendorId,
      source,
      query: req.query,
      listSelect: THEORY_LIST_SELECT,
      searchFields: ['questionText', 'difficulty'],
      populateGlobal: { path: 'createdBy', select: 'name email' },
      populateAll: [
        { path: 'subjectId', select: 'name' },
        { path: 'topicId', select: 'name' },
      ],
    });
    res.json(payload);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single theory question
router.get('/theory/:id', async (req, res) => {
  try {
    const question = await TheoryQuestion.findOne({
      _id: req.params.id,
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
    })
      .populate('subjectId', 'name')
      .populate('topicId', 'name');

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    const questionObj = question.toObject();
    questionObj.source = question.isGlobal ? 'global' : 'vendor';
    res.json(questionObj);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update theory question (vendor only)
router.put('/theory/:id', async (req, res) => {
  try {
    const question = await TheoryQuestion.findOne({
      _id: req.params.id,
      vendorId: req.vendorId,
      $or: [
        { isGlobal: false },
        { isGlobal: { $exists: false } }
      ]
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found or you cannot edit this question' });
    }

    if (req.body.subjectId) {
      const subject = await Subject.findOne({ _id: req.body.subjectId, vendorId: req.vendorId });
      if (!subject) {
        return res.status(404).json({ message: 'Subject not found' });
      }
      question.subjectId = subject._id;
    }
    if (req.body.topicId) {
      const topic = await Topic.findOne({ _id: req.body.topicId, vendorId: req.vendorId });
      if (!topic) {
        return res.status(404).json({ message: 'Topic not found' });
      }
      question.topicId = topic._id;
    }

    if (req.body.tags !== undefined) {
      req.body.tags = await resolveTagsForSave(req.vendorId, req.body.tags, req.user._id);
    }

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && !['_id', 'isGlobal', 'vendorId', 'createdBy'].includes(key)) {
        question[key] = req.body[key];
      }
    });

    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete theory question
router.delete('/theory/:id', async (req, res) => {
  try {
    const question = await TheoryQuestion.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

