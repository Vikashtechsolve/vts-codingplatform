const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { uploadToR2 } = require('../utils/r2Storage');
const EnglishGrammarQuestion = require('../models/EnglishGrammarQuestion');
const EnglishVocabularyQuestion = require('../models/EnglishVocabularyQuestion');
const EnglishReadingQuestion = require('../models/EnglishReadingQuestion');
const EnglishEssayQuestion = require('../models/EnglishEssayQuestion');
const EnglishSpeakingQuestion = require('../models/EnglishSpeakingQuestion');
const EnglishListeningQuestion = require('../models/EnglishListeningQuestion');
const { resolveTagsForSave } = require('../utils/questionTags');

const isGlobalBank = (req) => Boolean(req.globalEnglishBank);

router.use(auth);
router.use((req, res, next) => {
  if (isGlobalBank(req)) return authorize('super_admin')(req, res, next);
  return authorize('vendor_admin')(req, res, next);
});
router.use((req, res, next) => {
  if (isGlobalBank(req)) return next();
  return tenantMiddleware(req, res, next);
});

const questionOwnership = (req) => ({
  vendorId: isGlobalBank(req) ? null : req.vendorId,
  isGlobal: Boolean(isGlobalBank(req)),
  createdBy: req.user._id,
});

const resolveQuestionTags = async (req, tags) =>
  resolveTagsForSave(isGlobalBank(req) ? null : req.vendorId, tags, req.user._id);

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.ogg', '.webm', '.m4a'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  }
});

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

// Helper: standard vendor+global query
const vendorOrGlobalQuery = (vendorId) => ({
  $or: [
    { vendorId, $or: [{ isGlobal: false }, { isGlobal: { $exists: false } }] },
    { isGlobal: true }
  ]
});

const vendorOnlyQuery = (vendorId) => ({
  vendorId,
  $or: [{ isGlobal: false }, { isGlobal: { $exists: false } }]
});

const globalOnlyQuery = () => ({ isGlobal: true, vendorId: null });

const getEditFilter = (req, id) =>
  isGlobalBank(req) ? { _id: id, isGlobal: true } : { _id: id, ...vendorOnlyQuery(req.vendorId) };

const getReadFilter = (req, id) =>
  isGlobalBank(req) ? { _id: id, isGlobal: true } : { _id: id, ...vendorOrGlobalQuery(req.vendorId) };

const getDeleteFilter = (req, id) =>
  isGlobalBank(req) ? { _id: id, isGlobal: true } : { _id: id, vendorId: req.vendorId };

async function listEnglishQuestions(req, res, Model) {
  try {
    if (isGlobalBank(req)) {
      const globalQuestions = await Model.find(globalOnlyQuery())
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 });
      return res.json(globalQuestions.map((q) => ({ ...q.toObject(), source: 'global' })));
    }
    const vendorQuestions = await Model.find(vendorOnlyQuery(req.vendorId)).sort({ createdAt: -1 });
    const globalQuestions = await Model.find({ isGlobal: true })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    const all = [
      ...vendorQuestions.map((q) => ({ ...q.toObject(), source: 'vendor' })),
      ...globalQuestions.map((q) => ({ ...q.toObject(), source: 'global' })),
    ];
    res.json(all);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}

const protectedFields = ['_id', 'isGlobal', 'vendorId', 'createdBy'];
const parseMaybeJsonTags = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    return JSON.parse(value);
  } catch {
    return value.split(',');
  }
};

const updateAllowedFields = (doc, body) => {
  Object.keys(body).forEach(key => {
    if (body[key] !== undefined && !protectedFields.includes(key)) {
      doc[key] = body[key];
    }
  });
};

const resolveBodyTags = async (req) => {
  if (req.body.tags === undefined) return;
  const raw = Array.isArray(req.body.tags) ? req.body.tags : parseMaybeJsonTags(req.body.tags);
  req.body.tags = await resolveQuestionTags(req, raw);
};

// ============================================
// GRAMMAR QUESTIONS
// ============================================

router.post('/grammar', [
  body('questionText').trim().notEmpty().withMessage('Question text is required'),
  body('subType').isIn(['fill_in_blank', 'error_detection', 'sentence_correction', 'parajumble', 'active_passive', 'direct_indirect']).withMessage('Invalid sub-type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      questionText, subType, blankSentence, sentences, correctOrder,
      options, correctAnswer, isSubjective, explanation, grammarCategory,
      difficulty, points, tags
    } = req.body;

    const optionBasedSubTypes = ['error_detection', 'active_passive', 'direct_indirect'];
    if (optionBasedSubTypes.includes(subType)) {
      const validOptions = (options || []).filter(o => o.text && o.text.trim());
      if (validOptions.length < 2) return res.status(400).json({ message: 'At least 2 options are required for MCQ questions' });
      if (!validOptions.some(o => o.isCorrect)) return res.status(400).json({ message: 'At least one option must be correct' });
    }

    if (subType === 'fill_in_blank' || subType === 'sentence_correction') {
      if (!correctAnswer || !String(correctAnswer).trim()) return res.status(400).json({ message: 'Correct answer is required for this question type' });
    }

    if (subType === 'parajumble') {
      if (!sentences || sentences.length < 2) return res.status(400).json({ message: 'At least 2 sentences are required for parajumble' });
      if (!correctOrder || correctOrder.length !== sentences.length) return res.status(400).json({ message: 'Correct order must match number of sentences' });
    }

    const question = new EnglishGrammarQuestion({
      questionText: questionText.trim(),
      subType,
      blankSentence: blankSentence || '',
      sentences: sentences || [],
      correctOrder: correctOrder || [],
      options: options || [],
      correctAnswer: correctAnswer || '',
      isSubjective: isSubjective || false,
      explanation: explanation || '',
      grammarCategory: grammarCategory || '',
      difficulty: difficulty || 'medium',
      vendorId: questionOwnership(req).vendorId,
      isGlobal: questionOwnership(req).isGlobal,
      createdBy: questionOwnership(req).createdBy,
      points: points || 10,
      tags: await resolveQuestionTags(req, tags)
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/grammar', (req, res) => listEnglishQuestions(req, res, EnglishGrammarQuestion));

router.get('/grammar/:id', async (req, res) => {
  try {
    const question = await EnglishGrammarQuestion.findOne(getReadFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ ...question.toObject(), source: question.isGlobal ? 'global' : 'vendor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/grammar/:id', async (req, res) => {
  try {
    const question = await EnglishGrammarQuestion.findOne(getEditFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found or cannot edit' });
    await resolveBodyTags(req);
    updateAllowedFields(question, req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/grammar/:id', async (req, res) => {
  try {
    const question = await EnglishGrammarQuestion.findOneAndDelete(getDeleteFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// VOCABULARY QUESTIONS
// ============================================

router.post('/vocabulary', [
  body('word').trim().notEmpty().withMessage('Word is required'),
  body('subType').isIn(['synonym', 'antonym', 'meaning', 'one_word_substitution', 'idiom_phrase', 'spelling', 'contextual_usage']).withMessage('Invalid sub-type'),
  body('options').isArray({ min: 2 }).withMessage('At least 2 options are required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { word, subType, contextSentence, options, explanation, difficulty, points, tags } = req.body;

    const validOptions = (options || []).filter(o => o.text && o.text.trim());
    if (!validOptions.some(o => o.isCorrect)) return res.status(400).json({ message: 'At least one option must be correct' });

    const question = new EnglishVocabularyQuestion({
      word: word.trim(),
      subType,
      contextSentence: contextSentence || '',
      options: validOptions,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      vendorId: questionOwnership(req).vendorId,
      isGlobal: questionOwnership(req).isGlobal,
      createdBy: questionOwnership(req).createdBy,
      points: points || 10,
      tags: await resolveQuestionTags(req, tags)
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/vocabulary', (req, res) => listEnglishQuestions(req, res, EnglishVocabularyQuestion));

router.get('/vocabulary/:id', async (req, res) => {
  try {
    const question = await EnglishVocabularyQuestion.findOne(getReadFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ ...question.toObject(), source: question.isGlobal ? 'global' : 'vendor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/vocabulary/:id', async (req, res) => {
  try {
    const question = await EnglishVocabularyQuestion.findOne(getEditFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found or cannot edit' });
    await resolveBodyTags(req);
    updateAllowedFields(question, req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/vocabulary/:id', async (req, res) => {
  try {
    const question = await EnglishVocabularyQuestion.findOneAndDelete(getDeleteFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// READING COMPREHENSION QUESTIONS
// ============================================

router.post('/reading', [
  body('passage.title').trim().notEmpty().withMessage('Passage title is required'),
  body('passage.content').notEmpty().withMessage('Passage content is required'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { passage, questions, difficulty, tags } = req.body;

    for (const q of questions) {
      if (!q.questionText || !q.questionText.trim()) return res.status(400).json({ message: 'Each question must have text' });
      if (q.questionType === 'mcq' || q.questionType === 'true_false') {
        const opts = (q.options || []).filter(o => o.text && o.text.trim());
        if (opts.length < 2) return res.status(400).json({ message: 'MCQ/True-False questions need at least 2 options' });
        if (!opts.some(o => o.isCorrect)) return res.status(400).json({ message: 'At least one option must be correct' });
      }
      if ((q.questionType === 'short_answer' || q.questionType === 'inference') && !q.referenceAnswer) {
        return res.status(400).json({ message: 'Short answer and inference questions need a reference answer' });
      }
    }

    const wordCount = passage.content.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

    const question = new EnglishReadingQuestion({
      passage: {
        title: passage.title.trim(),
        content: passage.content,
        source: passage.source || '',
        wordCount,
        genre: passage.genre || 'non_fiction'
      },
      questions: questions.map(q => ({
        questionText: q.questionText.trim(),
        questionType: q.questionType || 'mcq',
        options: q.options || [],
        referenceAnswer: q.referenceAnswer || '',
        points: q.points || 5
      })),
      difficulty: difficulty || 'medium',
      tags: await resolveQuestionTags(req, tags),
      ...questionOwnership(req),
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/reading', (req, res) => listEnglishQuestions(req, res, EnglishReadingQuestion));

router.get('/reading/:id', async (req, res) => {
  try {
    const question = await EnglishReadingQuestion.findOne(getReadFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ ...question.toObject(), source: question.isGlobal ? 'global' : 'vendor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/reading/:id', async (req, res) => {
  try {
    const question = await EnglishReadingQuestion.findOne(getEditFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found or cannot edit' });
    await resolveBodyTags(req);
    updateAllowedFields(question, req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/reading/:id', async (req, res) => {
  try {
    const question = await EnglishReadingQuestion.findOneAndDelete(getDeleteFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// ESSAY / EMAIL / LETTER QUESTIONS
// ============================================

router.post('/essay', [
  body('prompt').trim().notEmpty().withMessage('Prompt is required'),
  body('writingType').isIn([
    'essay_general', 'essay_opinion', 'essay_argumentative',
    'email_formal', 'email_informal', 'letter_formal', 'letter_informal',
    'report', 'notice'
  ]).withMessage('Invalid writing type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
      prompt, writingType, instructions, wordLimit, timeLimit,
      sampleResponse, expectedFormat, evaluationWeights, difficulty, points, tags
    } = req.body;

    const question = new EnglishEssayQuestion({
      prompt: prompt.trim(),
      writingType,
      instructions: instructions || '',
      wordLimit: wordLimit || { min: 100, max: 500 },
      timeLimit: timeLimit || null,
      sampleResponse: sampleResponse || '',
      expectedFormat: expectedFormat || '',
      evaluationWeights: evaluationWeights || {},
      difficulty: difficulty || 'medium',
      vendorId: questionOwnership(req).vendorId,
      isGlobal: questionOwnership(req).isGlobal,
      createdBy: questionOwnership(req).createdBy,
      points: points || 20,
      tags: await resolveQuestionTags(req, tags)
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/essay', (req, res) => listEnglishQuestions(req, res, EnglishEssayQuestion));

router.get('/essay/:id', async (req, res) => {
  try {
    const question = await EnglishEssayQuestion.findOne(getReadFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ ...question.toObject(), source: question.isGlobal ? 'global' : 'vendor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/essay/:id', async (req, res) => {
  try {
    const question = await EnglishEssayQuestion.findOne(getEditFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found or cannot edit' });
    await resolveBodyTags(req);
    updateAllowedFields(question, req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/essay/:id', async (req, res) => {
  try {
    const question = await EnglishEssayQuestion.findOneAndDelete(getDeleteFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// SPEAKING QUESTIONS
// ============================================

router.post('/speaking', uploadImage.single('image'), async (req, res) => {
  try {
    const {
      prompt, speakingType, referenceText, preparationTime,
      speakingTime, maxAttempts, evaluationWeights, difficulty, points, tags
    } = req.body;

    if (!prompt || !prompt.trim()) return res.status(400).json({ message: 'Prompt is required' });
    if (!['read_aloud', 'describe_image', 'topic_speaking', 'situational', 'extempore'].includes(speakingType)) {
      return res.status(400).json({ message: 'Invalid speaking type' });
    }
    if (speakingType === 'read_aloud' && !referenceText) {
      return res.status(400).json({ message: 'Reference text is required for read aloud' });
    }

    let imageUrl = req.body.imageUrl || '';
    if (req.file) {
      const filename = `${Date.now()}-${req.file.originalname}`;
      const r2Key = `uploads/english/images/${filename}`;
      imageUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    }

    const parsedSpeakingTime = speakingTime ? (typeof speakingTime === 'string' ? JSON.parse(speakingTime) : speakingTime) : { min: 30, max: 120 };
    const parsedWeights = evaluationWeights ? (typeof evaluationWeights === 'string' ? JSON.parse(evaluationWeights) : evaluationWeights) : {};

    const question = new EnglishSpeakingQuestion({
      prompt: prompt.trim(),
      speakingType,
      referenceText: referenceText || '',
      imageUrl,
      preparationTime: preparationTime || 30,
      speakingTime: parsedSpeakingTime,
      maxAttempts: maxAttempts || 2,
      evaluationWeights: parsedWeights,
      difficulty: difficulty || 'medium',
      vendorId: questionOwnership(req).vendorId,
      isGlobal: questionOwnership(req).isGlobal,
      createdBy: questionOwnership(req).createdBy,
      points: points || 20,
      tags: await resolveQuestionTags(req, parseMaybeJsonTags(tags))
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/speaking', (req, res) => listEnglishQuestions(req, res, EnglishSpeakingQuestion));

router.get('/speaking/:id', async (req, res) => {
  try {
    const question = await EnglishSpeakingQuestion.findOne(getReadFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ ...question.toObject(), source: question.isGlobal ? 'global' : 'vendor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/speaking/:id', uploadImage.single('image'), async (req, res) => {
  try {
    const question = await EnglishSpeakingQuestion.findOne(getEditFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found or cannot edit' });
    if (req.file) {
      const filename = `${Date.now()}-${req.file.originalname}`;
      const r2Key = `uploads/english/images/${filename}`;
      req.body.imageUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    }
    if (req.body.speakingTime && typeof req.body.speakingTime === 'string') req.body.speakingTime = JSON.parse(req.body.speakingTime);
    if (req.body.evaluationWeights && typeof req.body.evaluationWeights === 'string') req.body.evaluationWeights = JSON.parse(req.body.evaluationWeights);
    await resolveBodyTags(req);
    updateAllowedFields(question, req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/speaking/:id', async (req, res) => {
  try {
    const question = await EnglishSpeakingQuestion.findOneAndDelete(getDeleteFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============================================
// LISTENING QUESTIONS
// ============================================

router.post('/listening', uploadAudio.single('audio'), async (req, res) => {
  try {
    const { title, audioTranscript, audioDuration, maxReplays, questionDelay, questions, difficulty, tags } = req.body;

    if (!title || !title.trim()) return res.status(400).json({ message: 'Title is required' });
    if (!req.file && !req.body.audioUrl) return res.status(400).json({ message: 'Audio file is required' });

    const parsedQuestions = typeof questions === 'string' ? JSON.parse(questions) : questions;
    if (!parsedQuestions || parsedQuestions.length < 1) return res.status(400).json({ message: 'At least one question is required' });

    for (const q of parsedQuestions) {
      if (!q.questionText || !q.questionText.trim()) return res.status(400).json({ message: 'Each question must have text' });
      if (q.questionType === 'mcq' || q.questionType === 'true_false') {
        const opts = (q.options || []).filter(o => o.text && o.text.trim());
        if (opts.length < 2) return res.status(400).json({ message: 'MCQ questions need at least 2 options' });
        if (!opts.some(o => o.isCorrect)) return res.status(400).json({ message: 'At least one option must be correct' });
      }
    }

    let audioUrl = req.body.audioUrl;
    if (req.file) {
      const filename = `${Date.now()}-${req.file.originalname}`;
      const r2Key = `uploads/listening/${filename}`;
      audioUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    }

    const question = new EnglishListeningQuestion({
      title: title.trim(),
      audioUrl,
      audioTranscript: audioTranscript || '',
      audioDuration: audioDuration || 0,
      maxReplays: maxReplays || 2,
      questionDelay: questionDelay || 0,
      questions: parsedQuestions.map(q => ({
        questionText: q.questionText.trim(),
        questionType: q.questionType || 'mcq',
        options: q.options || [],
        correctAnswer: q.correctAnswer || '',
        points: q.points || 5
      })),
      difficulty: difficulty || 'medium',
      tags: await resolveQuestionTags(req, parseMaybeJsonTags(tags)),
      ...questionOwnership(req),
    });

    await question.save();
    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/listening', (req, res) => listEnglishQuestions(req, res, EnglishListeningQuestion));

router.get('/listening/:id', async (req, res) => {
  try {
    const question = await EnglishListeningQuestion.findOne(getReadFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ ...question.toObject(), source: question.isGlobal ? 'global' : 'vendor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/listening/:id', uploadAudio.single('audio'), async (req, res) => {
  try {
    const question = await EnglishListeningQuestion.findOne(getEditFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found or cannot edit' });
    if (req.file) {
      const filename = `${Date.now()}-${req.file.originalname}`;
      const r2Key = `uploads/listening/${filename}`;
      req.body.audioUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    }
    if (req.body.questions && typeof req.body.questions === 'string') req.body.questions = JSON.parse(req.body.questions);
    await resolveBodyTags(req);
    updateAllowedFields(question, req.body);
    await question.save();
    res.json(question);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/listening/:id', async (req, res) => {
  try {
    const question = await EnglishListeningQuestion.findOneAndDelete(getDeleteFilter(req, req.params.id));
    if (!question) return res.status(404).json({ message: 'Question not found' });
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ===== BULK IMPORT =====
const MODEL_MAP = {
  grammar: EnglishGrammarQuestion,
  vocabulary: EnglishVocabularyQuestion,
  reading: EnglishReadingQuestion,
  essay: EnglishEssayQuestion,
  speaking: EnglishSpeakingQuestion,
  listening: EnglishListeningQuestion,
};

const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.json', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only .json and .csv files are allowed'));
  }
});

function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    values.push(current.trim());
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

function transformGrammarRow(row) {
  const q = {
    questionText: row.questionText || row.question,
    subType: row.subType || 'sentence_correction',
    difficulty: row.difficulty || 'medium',
    grammarCategory: row.grammarCategory || row.category || '',
    explanation: row.explanation || '',
    isSubjective: row.isSubjective === 'true' || row.isSubjective === true,
  };
  if (row.blankSentence) q.blankSentence = row.blankSentence;
  if (row.correctAnswer !== undefined) {
    const parsed = parseInt(row.correctAnswer);
    q.correctAnswer = isNaN(parsed) ? row.correctAnswer : parsed;
  }
  if (row.options) {
    try {
      q.options = typeof row.options === 'string' ? JSON.parse(row.options) : row.options;
    } catch { q.options = row.options.split('|').map(t => ({ text: t.trim(), isCorrect: false })); }
  }
  return q;
}

function transformVocabularyRow(row) {
  const q = {
    word: row.word,
    subType: row.subType || 'meaning',
    difficulty: row.difficulty || 'medium',
    explanation: row.explanation || '',
  };
  if (row.contextSentence) q.contextSentence = row.contextSentence;
  if (row.correctAnswer !== undefined) {
    const parsed = parseInt(row.correctAnswer);
    q.correctAnswer = isNaN(parsed) ? row.correctAnswer : parsed;
  }
  if (row.options) {
    try {
      q.options = typeof row.options === 'string' ? JSON.parse(row.options) : row.options;
    } catch { q.options = row.options.split('|').map(t => ({ text: t.trim(), isCorrect: false })); }
  }
  return q;
}

function transformEssayRow(row) {
  return {
    prompt: row.prompt || row.question,
    writingType: row.writingType || 'essay',
    instructions: row.instructions || '',
    wordLimit: { min: parseInt(row.wordLimitMin) || 100, max: parseInt(row.wordLimitMax) || 500 },
    timeLimit: parseInt(row.timeLimit) || 30,
    difficulty: row.difficulty || 'medium',
  };
}

const TRANSFORM_MAP = {
  grammar: transformGrammarRow,
  vocabulary: transformVocabularyRow,
  essay: transformEssayRow,
};

router.post('/bulk-import/:type', bulkUpload.single('file'), async (req, res) => {
  try {
    const qType = req.params.type;
    const Model = MODEL_MAP[qType];
    if (!Model) return res.status(400).json({ message: `Invalid question type: ${qType}` });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    let rawData;
    if (ext === '.json') {
      rawData = JSON.parse(req.file.buffer.toString('utf-8'));
      if (!Array.isArray(rawData)) rawData = [rawData];
    } else {
      rawData = parseCSV(req.file.buffer);
    }

    if (rawData.length === 0) return res.status(400).json({ message: 'No data found in file' });

    const transform = TRANSFORM_MAP[qType];
    const results = { created: 0, errors: [] };

    for (let i = 0; i < rawData.length; i++) {
      try {
        const data = transform ? transform(rawData[i]) : rawData[i];
        // Sets vendorId/isGlobal/createdBy correctly for both the vendor
        // bank and the super-admin global bank mounts
        Object.assign(data, questionOwnership(req));
        const doc = new Model(data);
        await doc.save();
        results.created++;
      } catch (err) {
        results.errors.push({ row: i + 1, error: err.message });
      }
    }

    res.json({
      message: `Imported ${results.created} of ${rawData.length} questions`,
      created: results.created,
      total: rawData.length,
      errors: results.errors
    });
  } catch (error) {
    res.status(500).json({ message: 'Import failed', error: error.message });
  }
});

module.exports = router;
