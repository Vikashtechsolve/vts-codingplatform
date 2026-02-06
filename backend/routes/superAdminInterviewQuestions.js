const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const InterviewQuestion = require('../models/InterviewQuestion');

router.use(auth);
router.use(authorize('super_admin'));

const validateInterviewQuestion = (payload) => {
  const errors = [];
  if (!payload.question || !payload.question.trim()) {
    errors.push('Question text is required');
  }
  if (!payload.interviewType || !payload.interviewType.trim()) {
    errors.push('Interview type is required');
  }
  if (!payload.topic || !payload.topic.trim()) {
    errors.push('Topic is required');
  }
  if (payload.difficulty && !['beginner', 'intermediate', 'advanced'].includes(payload.difficulty)) {
    errors.push('Invalid difficulty');
  }
  return errors;
};

router.post('/', [
  body('question').notEmpty().withMessage('Question is required'),
  body('interviewType').notEmpty().withMessage('Interview type is required'),
  body('topic').notEmpty().withMessage('Topic is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const validationErrors = validateInterviewQuestion(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

    const question = new InterviewQuestion({
      question: req.body.question.trim(),
      interviewType: req.body.interviewType.trim(),
      topic: req.body.topic.trim(),
      difficulty: req.body.difficulty || 'beginner',
      expectedAnswer: req.body.expectedAnswer || '',
      rubrics: req.body.rubrics || [],
      followUpHints: req.body.followUpHints || [],
      tags: req.body.tags || [],
      vendorId: null,
      isGlobal: true,
      createdBy: req.user._id,
      points: req.body.points || 10
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const questions = await InterviewQuestion.find({ isGlobal: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(questions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const question = await InterviewQuestion.findOne({
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

router.put('/:id', async (req, res) => {
  try {
    const question = await InterviewQuestion.findOne({
      _id: req.params.id,
      isGlobal: true
    });
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const mergedPayload = { ...question.toObject(), ...req.body };
    const validationErrors = validateInterviewQuestion(mergedPayload);
    if (validationErrors.length > 0) {
      return res.status(400).json({ message: validationErrors.join(', ') });
    }

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

router.delete('/:id', async (req, res) => {
  try {
    const question = await InterviewQuestion.findOneAndDelete({
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
