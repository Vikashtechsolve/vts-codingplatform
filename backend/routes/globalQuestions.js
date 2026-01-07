const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');

router.use(auth);
router.use(authorize('super_admin'));

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

module.exports = router;

