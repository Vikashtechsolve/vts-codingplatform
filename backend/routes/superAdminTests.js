const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Test = require('../models/Test');
const TestVendorAllocation = require('../models/TestVendorAllocation');
const Vendor = require('../models/Vendor');
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
const DatasetTemplate = require('../models/DatasetTemplate');
const Result = require('../models/Result');
const SQLQuestion = require('../models/SQLQuestion');
const { parsePagination, isPaginatedRequest, paginatedFind } = require('../utils/pagination');

const router = express.Router();

router.use(auth);
router.use(authorize('super_admin'));

const ENGLISH_QUESTION_MODELS = {
  english_grammar: EnglishGrammarQuestion,
  english_vocabulary: EnglishVocabularyQuestion,
  english_reading: EnglishReadingQuestion,
  english_essay: EnglishEssayQuestion,
  english_speaking: EnglishSpeakingQuestion,
  english_listening: EnglishListeningQuestion,
};

const TYPE_TO_MODEL = {
  coding: 'CodingQuestion',
  mcq: 'MCQQuestion',
  aptitude: 'AptitudeQuestion',
  theory: 'TheoryQuestion',
  sql: 'SQLQuestion',
  english_grammar: 'EnglishGrammarQuestion',
  english_vocabulary: 'EnglishVocabularyQuestion',
  english_reading: 'EnglishReadingQuestion',
  english_essay: 'EnglishEssayQuestion',
  english_speaking: 'EnglishSpeakingQuestion',
  english_listening: 'EnglishListeningQuestion',
};

const STANDARD_TYPES = ['coding', 'mcq', 'aptitude', 'theory', 'mixed'];
const ALL_TYPES = ['coding', 'mcq', 'aptitude', 'theory', 'mixed', 'sql', 'english'];

async function verifyGlobalQuestion(q) {
  if (q.type === 'coding') {
    return CodingQuestion.findOne({ _id: q.questionId, isGlobal: true });
  }
  if (q.type === 'mcq') {
    return MCQQuestion.findOne({ _id: q.questionId, isGlobal: true });
  }
  if (q.type === 'aptitude') {
    return AptitudeQuestion.findOne({ _id: q.questionId, isGlobal: true });
  }
  if (q.type === 'theory') {
    return TheoryQuestion.findOne({ _id: q.questionId, isGlobal: true });
  }
  if (ENGLISH_QUESTION_MODELS[q.type]) {
    return ENGLISH_QUESTION_MODELS[q.type].findOne({ _id: q.questionId, isGlobal: true });
  }
  return null;
}

async function verifyAllGlobalQuestions(questions) {
  if (!questions?.length) {
    return 'At least one question is required';
  }
  for (const q of questions) {
    const question = await verifyGlobalQuestion(q);
    if (!question) {
      return `Global question ${q.questionId} not found for type ${q.type}`;
    }
  }
  return null;
}

function mapQuestions(questions) {
  return questions.map((q, index) => ({
    type: q.type,
    questionId: q.questionId,
    questionType: q.questionType || TYPE_TO_MODEL[q.type] || 'MCQQuestion',
    points: q.points || 10,
    order: q.order || index + 1,
    sectionId: q.sectionId || undefined,
  }));
}

async function getPlatformTestOr404(id, res) {
  const test = await Test.findOne({ _id: id, source: 'platform' });
  if (!test) {
    res.status(404).json({ message: 'Platform test not found' });
    return null;
  }
  return test;
}

// List platform tests
router.get('/', async (req, res) => {
  try {
    const type = String(req.query.type || '').trim();
    const filter = { source: 'platform' };
    if (type) filter.type = type;

    if (isPaginatedRequest(req.query)) {
      const { page, limit, search } = parsePagination(req.query, {
        defaultLimit: 20,
        maxLimit: 50,
      });
      const payload = await paginatedFind(Test, {
        filter,
        search,
        searchFields: ['title', 'description'],
        select: 'title type duration questions source createdAt isActive',
        page,
        limit,
      });
      payload.items = payload.items.map((test) => ({
        _id: test._id,
        title: test.title,
        type: test.type,
        duration: test.duration,
        source: test.source,
        createdAt: test.createdAt,
        isActive: test.isActive,
        questionCount: Array.isArray(test.questions) ? test.questions.length : 0,
      }));
      return res.json(payload);
    }

    const tests = await Test.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const testIds = tests.map((t) => t._id);
    const allocationCounts = await TestVendorAllocation.aggregate([
      { $match: { testId: { $in: testIds }, isActive: true } },
      { $group: { _id: '$testId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(allocationCounts.map((row) => [String(row._id), row.count]));

    res.json(
      tests.map((test) => ({
        ...test,
        allocatedVendorCount: countMap[String(test._id)] || 0,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create platform test
router.post('/', [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type').isIn(ALL_TYPES).withMessage('Invalid test type'),
  body('duration').isInt({ min: 1 }).withMessage('Duration must be at least 1 minute'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, type, duration, questions, settings, englishSections, datasetTemplateId } = req.body;

    if (type === 'sql') {
      if (!datasetTemplateId) {
        return res.status(400).json({ message: 'SQL tests require a platform dataset template' });
      }
      const template = await DatasetTemplate.findOne({
        _id: datasetTemplateId,
        vendorId: null,
        isPlatform: true,
      });
      if (!template) {
        return res.status(400).json({ message: 'Platform dataset template not found' });
      }
      const test = await Test.create({
        title,
        description: description || '',
        type: 'sql',
        duration,
        questions: [],
        datasetTemplateId,
        source: 'platform',
        vendorId: null,
        createdBy: req.user._id,
        settings: settings || {},
        isActive: true,
      });
      return res.status(201).json(test);
    }

    const verifyError = await verifyAllGlobalQuestions(questions);
    if (verifyError) {
      return res.status(400).json({ message: verifyError });
    }

    const test = await Test.create({
      title,
      description: description || '',
      type,
      duration,
      questions: mapQuestions(questions),
      englishSections: englishSections || [],
      source: 'platform',
      vendorId: null,
      createdBy: req.user._id,
      settings: {
        allowMultipleAttempts: false,
        showResults: true,
        resultDisplay: 'detailed',
        shuffleQuestions: false,
        practiceMode: false,
        ...(settings || {}),
      },
      isActive: true,
    });

    res.status(201).json(test);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

async function getPlatformSqlTestOr404(testId, res) {
  if (!mongoose.Types.ObjectId.isValid(testId)) {
    res.status(400).json({ message: 'Invalid test id' });
    return null;
  }
  const test = await Test.findOne({ _id: testId, source: 'platform', type: 'sql' });
  if (!test) {
    res.status(404).json({ message: 'Platform SQL test not found' });
    return null;
  }
  return test;
}

// Platform dataset templates (for SQL tests) — must be before /:id
router.get('/meta/dataset-templates', async (req, res) => {
  try {
    const templates = await DatasetTemplate.find({ vendorId: null, isPlatform: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/meta/dataset-templates/:templateId', async (req, res) => {
  try {
    const template = await DatasetTemplate.findOne({
      _id: req.params.templateId,
      vendorId: null,
      isPlatform: true,
    }).lean();
    if (!template) return res.status(404).json({ message: 'Platform dataset template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/meta/dataset-templates', [
  body('name').trim().notEmpty(),
  body('schemaSql').trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const template = await DatasetTemplate.create({
      name: req.body.name,
      description: req.body.description || '',
      domain: req.body.domain || 'General',
      schemaSql: req.body.schemaSql,
      dataSql: req.body.dataSql || '',
      vendorId: null,
      isPlatform: true,
      isPublished: true,
      publishedAt: new Date(),
    });
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/meta/dataset-templates/:templateId', [
  body('name').optional().trim().notEmpty(),
  body('schemaSql').optional().trim().notEmpty(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const template = await DatasetTemplate.findOne({
      _id: req.params.templateId,
      vendorId: null,
      isPlatform: true,
    });
    if (!template) return res.status(404).json({ message: 'Platform dataset template not found' });

    if (req.body.name !== undefined) template.name = req.body.name;
    if (req.body.description !== undefined) template.description = req.body.description;
    if (req.body.domain !== undefined) template.domain = req.body.domain;
    if (req.body.schemaSql !== undefined) template.schemaSql = req.body.schemaSql;
    if (req.body.dataSql !== undefined) template.dataSql = req.body.dataSql;
    await template.save();
    res.json(template);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/meta/dataset-templates/:templateId', async (req, res) => {
  try {
    const template = await DatasetTemplate.findOne({
      _id: req.params.templateId,
      vendorId: null,
      isPlatform: true,
    });
    if (!template) return res.status(404).json({ message: 'Platform dataset template not found' });

    const inUse = await Test.countDocuments({ datasetTemplateId: template._id, source: 'platform' });
    if (inUse > 0) {
      return res.status(400).json({ message: 'Template is used by platform SQL tests and cannot be deleted' });
    }
    await DatasetTemplate.findByIdAndDelete(template._id);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Platform SQL questions — must be before /:id
router.get('/:testId/sql-questions', async (req, res) => {
  try {
    const test = await getPlatformSqlTestOr404(req.params.testId, res);
    if (!test) return;

    const questions = await SQLQuestion.find({ testId: test._id }).sort({ order: 1 });
    res.json(
      questions.map((q) => {
        const obj = q.toObject();
        delete obj.correctSql;
        return obj;
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:testId/sql-questions', [
  body('text').trim().notEmpty().withMessage('Question text is required'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be at least 1'),
  body('correctSql').notEmpty().withMessage('Correct SQL is required'),
  body('order').optional().isInt({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const test = await getPlatformSqlTestOr404(req.params.testId, res);
    if (!test) return;

    if (!test.datasetTemplateId) {
      return res.status(400).json({ message: 'Test has no dataset template' });
    }
    const template = await DatasetTemplate.findById(test.datasetTemplateId);
    if (!template) return res.status(400).json({ message: 'Dataset template not found' });

    const { text, marks, correctSql, order } = req.body;
    const expectedOutputHash = getExpectedOutputHash(template.schemaSql, template.dataSql, correctSql);
    if (!expectedOutputHash) {
      return res.status(400).json({
        message: 'Correct SQL did not run successfully. Check your query against the dataset.',
        runError: true,
      });
    }

    const existingCount = await SQLQuestion.countDocuments({ testId: test._id });
    const question = await SQLQuestion.create({
      testId: test._id,
      vendorId: null,
      text,
      marks,
      correctSql,
      expectedOutputHash,
      order: order ?? existingCount,
    });

    test.questions.push({
      type: 'sql',
      questionId: question._id,
      questionType: 'SQLQuestion',
      points: marks,
      order: question.order,
    });
    await test.save();

    const out = question.toObject();
    delete out.correctSql;
    res.status(201).json(out);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:testId/sql-questions/:questionId', async (req, res) => {
  try {
    const test = await getPlatformSqlTestOr404(req.params.testId, res);
    if (!test) return;

    const question = await SQLQuestion.findOne({
      _id: req.params.questionId,
      testId: test._id,
    });
    if (!question) return res.status(404).json({ message: 'SQL question not found' });

    if (req.body.text !== undefined) question.text = req.body.text;
    if (req.body.marks !== undefined) question.marks = req.body.marks;
    if (req.body.order !== undefined) question.order = req.body.order;

    if (req.body.correctSql !== undefined && req.body.correctSql !== '') {
      const template = await DatasetTemplate.findById(test.datasetTemplateId);
      if (!template) return res.status(400).json({ message: 'Dataset template not found' });
      const expectedOutputHash = getExpectedOutputHash(
        template.schemaSql,
        template.dataSql,
        req.body.correctSql
      );
      if (!expectedOutputHash) {
        return res.status(400).json({ message: 'Correct SQL did not run successfully.', runError: true });
      }
      question.correctSql = req.body.correctSql;
      question.expectedOutputHash = expectedOutputHash;
    }

    await question.save();
    const out = question.toObject();
    delete out.correctSql;
    res.json(out);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:testId/sql-questions/:questionId', async (req, res) => {
  try {
    const test = await getPlatformSqlTestOr404(req.params.testId, res);
    if (!test) return;

    const question = await SQLQuestion.findOne({
      _id: req.params.questionId,
      testId: test._id,
    });
    if (!question) return res.status(404).json({ message: 'SQL question not found' });

    await Test.findByIdAndUpdate(test._id, {
      $pull: { questions: { questionId: question._id } },
    });
    await SQLQuestion.findByIdAndDelete(question._id);
    res.json({ message: 'SQL question deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:testId/sql-questions/run-query', [
  body('query').notEmpty().trim().withMessage('Query is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const test = await getPlatformSqlTestOr404(req.params.testId, res);
    if (!test) return;

    const template = await DatasetTemplate.findById(test.datasetTemplateId);
    if (!template) return res.status(400).json({ message: 'Dataset template not found' });

    const run = runInSandbox(template.schemaSql, template.dataSql || '', req.body.query);
    res.json({
      success: run.success,
      rows: run.rows || [],
      error: run.error || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:testId/sql-questions/validate', async (req, res) => {
  try {
    const test = await getPlatformSqlTestOr404(req.params.testId, res);
    if (!test) return;

    const template = await DatasetTemplate.findById(test.datasetTemplateId);
    if (!template) return res.status(400).json({ message: 'Dataset template not found' });

    const questions = await SQLQuestion.find({ testId: test._id }).sort({ order: 1 });
    const results = [];
    let allOk = true;
    for (const q of questions) {
      const run = runInSandbox(template.schemaSql, template.dataSql, q.correctSql);
      results.push({
        questionId: q._id,
        text: q.text.substring(0, 50) + (q.text.length > 50 ? '...' : ''),
        success: run.success,
        error: run.error || null,
      });
      if (!run.success) allOk = false;
    }
    res.json({ valid: allOk, results });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single platform test
router.get('/:id', async (req, res) => {
  try {
    const test = await getPlatformTestOr404(req.params.id, res);
    if (!test) return;

    const populated = await Test.findById(test._id).populate('createdBy', 'name email');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update platform test
router.put('/:id', async (req, res) => {
  try {
    const test = await getPlatformTestOr404(req.params.id, res);
    if (!test) return;

    const { title, description, duration, questions, isActive, settings, englishSections, datasetTemplateId } = req.body;

    if (questions) {
      const verifyError = await verifyAllGlobalQuestions(questions);
      if (verifyError) {
        return res.status(400).json({ message: verifyError });
      }
      test.questions = mapQuestions(questions);
    }

    if (title) test.title = title;
    if (description !== undefined) test.description = description;
    if (duration) test.duration = duration;
    if (isActive !== undefined) test.isActive = isActive;
    if (settings) test.settings = { ...test.settings, ...settings };
    if (englishSections !== undefined) test.englishSections = englishSections;
    if (test.type === 'sql' && datasetTemplateId) {
      const template = await DatasetTemplate.findOne({
        _id: datasetTemplateId,
        vendorId: null,
        isPlatform: true,
      });
      if (!template) {
        return res.status(400).json({ message: 'Platform dataset template not found' });
      }
      test.datasetTemplateId = datasetTemplateId;
    }

    await test.save();
    res.json(test);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete platform test
router.delete('/:id', async (req, res) => {
  try {
    const test = await getPlatformTestOr404(req.params.id, res);
    if (!test) return;

    await Result.deleteMany({ testId: test._id });
    await TestVendorAllocation.deleteMany({ testId: test._id });
    await Test.findByIdAndDelete(test._id);

    res.json({ message: 'Platform test deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Vendor allocations
router.get('/:id/allocations', async (req, res) => {
  try {
    const test = await getPlatformTestOr404(req.params.id, res);
    if (!test) return;

    const items = await TestVendorAllocation.find({ testId: test._id, isActive: true })
      .populate('vendorId', 'name companyName email isActive')
      .sort({ allocatedAt: -1 })
      .lean();

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post(
  '/:id/allocations',
  [body('vendorIds').isArray({ min: 1 }).withMessage('vendorIds required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const test = await getPlatformTestOr404(req.params.id, res);
      if (!test) return;

      const vendorIds = req.body.vendorIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('_id');
      const found = new Set(vendors.map((v) => String(v._id)));

      const results = [];
      for (const vendorId of vendorIds) {
        if (!found.has(String(vendorId))) continue;
        const doc = await TestVendorAllocation.findOneAndUpdate(
          { testId: test._id, vendorId },
          {
            $set: {
              isActive: true,
              allocatedBy: req.user._id,
              allocatedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );
        results.push(doc);
      }

      res.status(201).json({ items: results });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/:id/allocations/:vendorId', async (req, res) => {
  try {
    const test = await getPlatformTestOr404(req.params.id, res);
    if (!test) return;

    const doc = await TestVendorAllocation.findOneAndUpdate(
      { testId: test._id, vendorId: req.params.vendorId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Allocation not found' });
    res.json({ success: true, allocation: doc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
