const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Topic = require('../models/Topic');
const Subject = require('../models/Subject');
const TheoryQuestion = require('../models/TheoryQuestion');

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

// Get topics (optionally filtered by subject)
router.get('/', async (req, res) => {
  try {
    const query = { vendorId: req.vendorId };
    if (req.query.subjectId) {
      query.subjectId = req.query.subjectId;
    }
    const topics = await Topic.find(query).sort({ createdAt: -1 });
    res.json(topics);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create topic
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('subjectId').notEmpty().withMessage('Subject is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const subject = await Subject.findOne({ _id: req.body.subjectId, vendorId: req.vendorId });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    const topic = new Topic({
      name: req.body.name.trim(),
      subjectId: subject._id,
      vendorId: req.vendorId,
      createdBy: req.user._id
    });
    await topic.save();
    res.status(201).json(topic);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Topic already exists for this subject' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update topic
router.put('/:id', async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    if (req.body.name !== undefined) topic.name = req.body.name.trim();
    if (req.body.isActive !== undefined) topic.isActive = req.body.isActive;
    await topic.save();
    res.json(topic);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete topic (only if no questions)
router.delete('/:id', async (req, res) => {
  try {
    const topic = await Topic.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!topic) {
      return res.status(404).json({ message: 'Topic not found' });
    }
    const questionCount = await TheoryQuestion.countDocuments({ topicId: topic._id });
    if (questionCount > 0) {
      return res.status(400).json({ message: 'Cannot delete topic with linked questions' });
    }
    await Topic.findByIdAndDelete(topic._id);
    res.json({ message: 'Topic deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

