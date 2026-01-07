const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

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
      examples
    } = req.body;

    // Validate allowed languages
    if (!allowedLanguages || allowedLanguages.length === 0) {
      return res.status(400).json({ message: 'At least one allowed language is required' });
    }

    // Validate test cases
    if (!testCases || testCases.length === 0) {
      return res.status(400).json({ message: 'At least one test case is required' });
    }

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
      examples: examples || []
    });

    await question.save();
    console.log('✅ Coding question created:', question._id);
    res.status(201).json(question);
  } catch (error) {
    console.error('❌ Error creating coding question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all coding questions (vendor-specific + global)
router.get('/coding', async (req, res) => {
  try {
    console.log('📥 Fetching coding questions for vendor:', req.vendorId);
    // Get vendor-specific questions (include old questions without isGlobal field)
    const vendorQuestions = await CodingQuestion.find({
      vendorId: req.vendorId,
      $or: [
        { isGlobal: false },
        { isGlobal: { $exists: false } } // Include old questions without isGlobal field
      ]
    })
      .select('-solution')
      .sort({ createdAt: -1 });
    
    // Get global questions
    const globalQuestions = await CodingQuestion.find({ isGlobal: true })
      .select('-solution')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Combine and mark source
    const allQuestions = [
      ...vendorQuestions.map(q => ({ ...q.toObject(), source: 'vendor' })),
      ...globalQuestions.map(q => ({ ...q.toObject(), source: 'global' }))
    ];
    
    console.log(`✅ Found ${vendorQuestions.length} vendor questions, ${globalQuestions.length} global questions`);
    res.json(allQuestions);
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

    const { question, options, explanation, difficulty, category, points } = req.body;

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

    const mcqQuestion = new MCQQuestion({
      question: question.trim(),
      options: validOptions,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      vendorId: req.vendorId,
      isGlobal: false, // Explicitly set to false for vendor questions
      createdBy: req.user._id,
      category: category || '',
      points: points || 10
    });

    await mcqQuestion.save();
    console.log('✅ MCQ question created:', mcqQuestion._id);
    res.status(201).json(mcqQuestion);
  } catch (error) {
    console.error('❌ Error creating MCQ question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all MCQ questions (vendor-specific + global)
router.get('/mcq', async (req, res) => {
  try {
    // Get vendor-specific questions (include old questions without isGlobal field)
    const vendorQuestions = await MCQQuestion.find({
      vendorId: req.vendorId,
      $or: [
        { isGlobal: false },
        { isGlobal: { $exists: false } } // Include old questions without isGlobal field
      ]
    })
      .sort({ createdAt: -1 });
    
    // Get global questions
    const globalQuestions = await MCQQuestion.find({ isGlobal: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    // Combine and mark source
    const allQuestions = [
      ...vendorQuestions.map(q => ({ ...q.toObject(), source: 'vendor' })),
      ...globalQuestions.map(q => ({ ...q.toObject(), source: 'global' }))
    ];
    
    res.json(allQuestions);
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

module.exports = router;

