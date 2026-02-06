const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const TheoryQuestion = require('../models/TheoryQuestion');

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

// Get all subjects
router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.find({ vendorId: req.vendorId })
      .sort({ createdAt: -1 });
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create subject
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const subject = new Subject({
      name: req.body.name.trim(),
      description: req.body.description || '',
      vendorId: req.vendorId,
      createdBy: req.user._id
    });
    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Subject already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update subject
router.put('/:id', async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    if (req.body.name !== undefined) subject.name = req.body.name.trim();
    if (req.body.description !== undefined) subject.description = req.body.description;
    if (req.body.isActive !== undefined) subject.isActive = req.body.isActive;
    await subject.save();
    res.json(subject);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete subject (only if no topics or questions)
router.delete('/:id', async (req, res) => {
  try {
    const subject = await Subject.findOne({ _id: req.params.id, vendorId: req.vendorId });
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    const topicCount = await Topic.countDocuments({ subjectId: subject._id });
    const questionCount = await TheoryQuestion.countDocuments({ subjectId: subject._id });
    if (topicCount > 0 || questionCount > 0) {
      return res.status(400).json({ message: 'Cannot delete subject with linked topics or questions' });
    }
    await Subject.findByIdAndDelete(subject._id);
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

