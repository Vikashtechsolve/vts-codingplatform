const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const PracticeTopic = require('../models/PracticeTopic');
const PracticeRoadmap = require('../models/PracticeRoadmap');
const PracticeDailyChallenge = require('../models/PracticeDailyChallenge');
const CodingQuestion = require('../models/CodingQuestion');
const PracticeSubmission = require('../models/PracticeSubmission');
const StudentPracticeProfile = require('../models/StudentPracticeProfile');
const { fetchPaginatedQuestions } = require('../utils/questionListQuery');
const { todayKey } = require('../utils/practice/practiceStatsService');

const router = express.Router();

router.use(auth);
router.use(authorize('super_admin'));

const CODING_LIST_SELECT =
  'title description difficulty allowedLanguages tags practiceEnabled practiceTopics estimatedMinutes companyTags createdAt isGlobal';

// Topics CRUD
router.get('/topics', async (req, res) => {
  const topics = await PracticeTopic.find().sort({ order: 1, label: 1 });
  res.json(topics);
});

router.post('/topics', [
  body('slug').trim().notEmpty(),
  body('label').trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const topic = await PracticeTopic.create({
    slug: req.body.slug.trim().toLowerCase(),
    label: req.body.label.trim(),
    category: req.body.category || 'fundamentals',
    order: req.body.order || 0,
    isActive: req.body.isActive !== false,
  });
  res.status(201).json(topic);
});

router.put('/topics/:id', async (req, res) => {
  const topic = await PracticeTopic.findById(req.params.id);
  if (!topic) return res.status(404).json({ message: 'Topic not found' });

  if (req.body.label !== undefined) topic.label = req.body.label.trim();
  if (req.body.slug !== undefined) topic.slug = req.body.slug.trim().toLowerCase();
  if (req.body.category !== undefined) topic.category = req.body.category;
  if (req.body.order !== undefined) topic.order = req.body.order;
  if (req.body.isActive !== undefined) topic.isActive = req.body.isActive;

  await topic.save();
  res.json(topic);
});

router.delete('/topics/:id', async (req, res) => {
  await PracticeTopic.findByIdAndDelete(req.params.id);
  res.json({ message: 'Topic deleted' });
});

// Practice questions (global + practiceEnabled) — default lists practice bank; ?source=global for all global
router.get('/questions', async (req, res) => {
  const source = req.query.source === 'global' ? 'global' : 'practice';
  const payload = await fetchPaginatedQuestions({
    Model: CodingQuestion,
    vendorId: null,
    source,
    query: req.query,
    listSelect: CODING_LIST_SELECT,
    searchFields: ['title', 'description', 'tags'],
    populateAll: [{ path: 'practiceTopics', select: 'slug label' }],
  });
  res.json(payload);
});

router.put('/questions/:id/practice', async (req, res) => {
  const question = await CodingQuestion.findOne({ _id: req.params.id, isGlobal: true });
  if (!question) return res.status(404).json({ message: 'Global question not found' });

  if (req.body.practiceEnabled !== undefined) question.practiceEnabled = !!req.body.practiceEnabled;
  if (req.body.practiceTopics !== undefined) question.practiceTopics = req.body.practiceTopics;
  if (req.body.estimatedMinutes !== undefined) question.estimatedMinutes = req.body.estimatedMinutes;
  if (req.body.companyTags !== undefined) question.companyTags = req.body.companyTags;

  await question.save();
  res.json(question);
});

// Roadmaps
router.get('/roadmaps', async (req, res) => {
  const roadmaps = await PracticeRoadmap.find()
    .populate('steps.topicId', 'slug label')
    .sort({ createdAt: -1 });
  res.json(roadmaps);
});

router.post('/roadmaps', [
  body('title').trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const roadmap = await PracticeRoadmap.create({
    title: req.body.title.trim(),
    description: req.body.description || '',
    steps: req.body.steps || [],
    isActive: req.body.isActive !== false,
    createdBy: req.user._id,
  });
  res.status(201).json(roadmap);
});

router.put('/roadmaps/:id', async (req, res) => {
  const roadmap = await PracticeRoadmap.findById(req.params.id);
  if (!roadmap) return res.status(404).json({ message: 'Roadmap not found' });

  if (req.body.title !== undefined) roadmap.title = req.body.title.trim();
  if (req.body.description !== undefined) roadmap.description = req.body.description;
  if (req.body.steps !== undefined) roadmap.steps = req.body.steps;
  if (req.body.isActive !== undefined) roadmap.isActive = req.body.isActive;

  await roadmap.save();
  res.json(roadmap);
});

router.delete('/roadmaps/:id', async (req, res) => {
  await PracticeRoadmap.findByIdAndDelete(req.params.id);
  res.json({ message: 'Roadmap deleted' });
});

// Daily challenge
router.get('/daily-challenge', async (req, res) => {
  const row = await PracticeDailyChallenge.findOne({ date: todayKey() })
    .populate('questionId', 'title difficulty');
  res.json(row);
});

router.post('/daily-challenge', [
  body('questionId').notEmpty(),
  body('date').optional(),
], async (req, res) => {
  const date = req.body.date || todayKey();
  const question = await CodingQuestion.findOne({
    _id: req.body.questionId,
    isGlobal: true,
    practiceEnabled: true,
  });
  if (!question) return res.status(400).json({ message: 'Invalid practice question' });

  const row = await PracticeDailyChallenge.findOneAndUpdate(
    { date },
    { questionId: question._id },
    { upsert: true, new: true }
  );
  res.json(row);
});

// Platform analytics
router.get('/analytics', async (req, res) => {
  const [
    totalQuestions,
    totalSubmissions,
    activeStudents,
    acceptedSubmissions,
  ] = await Promise.all([
    CodingQuestion.countDocuments({ isGlobal: true, practiceEnabled: true }),
    PracticeSubmission.countDocuments(),
    StudentPracticeProfile.countDocuments({ problemsAttempted: { $gt: 0 } }),
    PracticeSubmission.countDocuments({ status: 'accepted' }),
  ]);

  res.json({
    totalQuestions,
    totalSubmissions,
    activeStudents,
    acceptedSubmissions,
    successRate: totalSubmissions
      ? Math.round((acceptedSubmissions / totalSubmissions) * 100)
      : 0,
  });
});

module.exports = router;
