const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');
const TheoryQuestion = require('../models/TheoryQuestion');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');

router.use(auth);
router.use(authorize('super_admin'));

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

// Create global coding question
router.post('/coding', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('allowedLanguages').isArray().withMessage('Allowed languages must be an array'),
  body('testCases').isArray().withMessage('Test cases must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
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
      examples
    } = req.body;

    if (!allowedLanguages || allowedLanguages.length === 0) {
      return res.status(400).json({ message: 'At least one allowed language is required' });
    }

    if (!testCases || testCases.length === 0) {
      return res.status(400).json({ message: 'At least one test case is required' });
    }

    const question = new CodingQuestion({
      title: title.trim(),
      description: description.trim(),
      difficulty: difficulty || 'medium',
      vendorId: null, // Global questions have no vendor
      isGlobal: true,
      createdBy: req.user._id,
      allowedLanguages: allowedLanguages || [],
      testCases: testCases || [],
      starterCode: starterCode || {},
      solution: solution || {},
      constraints: constraints || '',
      examples: examples || []
    });

    await question.save();
    console.log('✅ Global coding question created:', question._id);
    res.status(201).json(question);
  } catch (error) {
    console.error('❌ Error creating global coding question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all global coding questions
router.get('/coding', async (req, res) => {
  try {
    const questions = await CodingQuestion.find({ isGlobal: true })
      .select('-solution')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single global coding question
router.get('/coding/:id', async (req, res) => {
  try {
    const question = await CodingQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update global coding question
router.put('/coding/:id', [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().notEmpty().withMessage('Description cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await CodingQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== 'isGlobal' && key !== 'vendorId') {
        question[key] = req.body[key];
      }
    });

    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete global coding question
router.delete('/coding/:id', async (req, res) => {
  try {
    const question = await CodingQuestion.findOneAndDelete({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create global MCQ question
router.post('/mcq', [
  body('question').notEmpty().withMessage('Question is required'),
  body('options').isArray().withMessage('Options must be an array'),
  body('options').custom((value) => {
    if (!Array.isArray(value) || value.length < 2) {
      throw new Error('At least 2 options are required');
    }
    return true;
  })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { question, options, explanation, difficulty, category, points } = req.body;

    const validOptions = (options || []).filter(opt => opt.text && opt.text.trim());
    
    if (validOptions.length < 2) {
      return res.status(400).json({ message: 'At least 2 valid options are required' });
    }

    const hasCorrectAnswer = validOptions.some(opt => opt.isCorrect);
    if (!hasCorrectAnswer) {
      return res.status(400).json({ message: 'At least one option must be marked as correct' });
    }

    const mcqQuestion = new MCQQuestion({
      question: question.trim(),
      options: validOptions,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      vendorId: null, // Global questions have no vendor
      isGlobal: true,
      createdBy: req.user._id,
      category: category || '',
      points: points || 10
    });

    await mcqQuestion.save();
    console.log('✅ Global MCQ question created:', mcqQuestion._id);
    res.status(201).json(mcqQuestion);
  } catch (error) {
    console.error('❌ Error creating global MCQ question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all global MCQ questions
router.get('/mcq', async (req, res) => {
  try {
    const questions = await MCQQuestion.find({ isGlobal: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single global MCQ question
router.get('/mcq/:id', async (req, res) => {
  try {
    const question = await MCQQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update global MCQ question
router.put('/mcq/:id', [
  body('question').optional().notEmpty().withMessage('Question cannot be empty'),
  body('options').optional().isArray().withMessage('Options must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await MCQQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== 'isGlobal' && key !== 'vendorId') {
        question[key] = req.body[key];
      }
    });

    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete global MCQ question
router.delete('/mcq/:id', async (req, res) => {
  try {
    const question = await MCQQuestion.findOneAndDelete({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create global aptitude question
router.post('/aptitude', [
  body('question').notEmpty().withMessage('Question is required'),
  body('questionType').isIn(['single', 'multi', 'numeric', 'case_study']).withMessage('Invalid question type'),
  body('section').isIn(['quantitative', 'logical', 'analytical']).withMessage('Invalid section')
], async (req, res) => {
  try {
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
      points
    } = req.body;

    const validOptions = (options || []).filter(opt => opt && opt.text && opt.text.trim());
    const normalizedCorrect = normalizeOptionIndexes(correctOptions);

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
      vendorId: null,
      isGlobal: true,
      createdBy: req.user._id,
      points: points || 10
    });

    await aptitudeQuestion.save();
    res.status(201).json(aptitudeQuestion);
  } catch (error) {
    console.error('❌ Error creating global aptitude question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all global aptitude questions
router.get('/aptitude', async (req, res) => {
  try {
    const questions = await AptitudeQuestion.find({ isGlobal: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single global aptitude question
router.get('/aptitude/:id', async (req, res) => {
  try {
    const question = await AptitudeQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update global aptitude question
router.put('/aptitude/:id', [
  body('question').optional().trim().notEmpty().withMessage('Question cannot be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const question = await AptitudeQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const mergedPayload = { ...question.toObject(), ...req.body };
    const validationErrors = validateAptitudePayload(mergedPayload);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const updatedOptions = (mergedPayload.options || []).filter(opt => opt && opt.text && opt.text.trim());
    const normalizedCorrect = normalizeOptionIndexes(mergedPayload.correctOptions);

    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined && key !== '_id' && key !== 'isGlobal' && key !== 'vendorId') {
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

// Delete global aptitude question
router.delete('/aptitude/:id', async (req, res) => {
  try {
    const question = await AptitudeQuestion.findOneAndDelete({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create global theory question
router.post('/theory', [
  body('questionText').trim().notEmpty().withMessage('Question text is required'),
  body('subjectId').notEmpty().withMessage('Subject is required'),
  body('referenceAnswer').notEmpty().withMessage('Reference answer is required')
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

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    let topic = null;
    if (topicId) {
      topic = await Topic.findById(topicId);
      if (!topic) {
        return res.status(404).json({ message: 'Topic not found' });
      }
    }

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
      tags: Array.isArray(tags) ? tags : [],
      vendorId: null,
      isGlobal: true,
      createdBy: req.user._id
    });

    await theoryQuestion.save();
    res.status(201).json(theoryQuestion);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all global theory questions
router.get('/theory', async (req, res) => {
  try {
    const questions = await TheoryQuestion.find({ isGlobal: true })
      .populate('subjectId', 'name')
      .populate('topicId', 'name')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single global theory question
router.get('/theory/:id', async (req, res) => {
  try {
    const question = await TheoryQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    })
      .populate('subjectId', 'name')
      .populate('topicId', 'name');
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update global theory question
router.put('/theory/:id', async (req, res) => {
  try {
    const question = await TheoryQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    if (req.body.subjectId) {
      const subject = await Subject.findById(req.body.subjectId);
      if (!subject) {
        return res.status(404).json({ message: 'Subject not found' });
      }
      question.subjectId = subject._id;
    }
    if (req.body.topicId) {
      const topic = await Topic.findById(req.body.topicId);
      if (!topic) {
        return res.status(404).json({ message: 'Topic not found' });
      }
      question.topicId = topic._id;
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

// Delete global theory question
router.delete('/theory/:id', async (req, res) => {
  try {
    const question = await TheoryQuestion.findOneAndDelete({
      _id: req.params.id,
      isGlobal: true
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

