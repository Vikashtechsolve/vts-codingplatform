const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const SQLQuestion = require('../models/SQLQuestion');
const Test = require('../models/Test');
const DatasetTemplate = require('../models/DatasetTemplate');
const { getExpectedOutputHash, runInSandbox } = require('../utils/sqlSandbox');

router.use(auth, tenantMiddleware);

// List SQL questions for a test (vendor only)
router.get('/test/:testId', authorize('vendor_admin'), async (req, res) => {
  try {
    const test = await Test.findOne({
      _id: req.params.testId,
      vendorId: req.vendorId,
      type: 'sql'
    });
    if (!test) {
      return res.status(404).json({ message: 'SQL test not found' });
    }
    const questions = await SQLQuestion.find({ testId: test._id }).sort({ order: 1 });
    const withoutCorrectSql = questions.map(q => {
      const obj = q.toObject();
      delete obj.correctSql;
      return obj;
    });
    res.json(withoutCorrectSql);
  } catch (error) {
    console.error('Error listing SQL questions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create SQL question (vendor only). Computes expectedOutputHash from correctSql + test's dataset.
router.post('/', [
  authorize('vendor_admin'),
  body('testId').notEmpty().withMessage('testId is required'),
  body('text').trim().notEmpty().withMessage('Question text is required'),
  body('marks').isInt({ min: 1 }).withMessage('Marks must be at least 1'),
  body('correctSql').notEmpty().withMessage('Correct SQL is required'),
  body('order').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { testId, text, marks, correctSql, order } = req.body;

    const test = await Test.findOne({
      _id: testId,
      vendorId: req.vendorId,
      type: 'sql'
    });
    if (!test) {
      return res.status(404).json({ message: 'SQL test not found' });
    }
    if (!test.datasetTemplateId) {
      return res.status(400).json({ message: 'Test has no dataset template. Set datasetTemplateId first.' });
    }

    const template = await DatasetTemplate.findById(test.datasetTemplateId);
    if (!template) {
      return res.status(400).json({ message: 'Dataset template not found' });
    }

    const expectedOutputHash = getExpectedOutputHash(template.schemaSql, template.dataSql, correctSql);
    if (!expectedOutputHash) {
      return res.status(400).json({
        message: 'Correct SQL did not run successfully. Check your query against the dataset.',
        runError: true
      });
    }

    const existingCount = await SQLQuestion.countDocuments({ testId });
    const question = new SQLQuestion({
      testId,
      vendorId: req.vendorId,
      text,
      marks,
      correctSql,
      expectedOutputHash,
      order: order ?? existingCount
    });
    await question.save();

    test.questions.push({
      type: 'sql',
      questionId: question._id,
      questionType: 'SQLQuestion',
      points: marks,
      order: question.order
    });
    await test.save();

    const out = question.toObject();
    delete out.correctSql;
    res.status(201).json(out);
  } catch (error) {
    console.error('Error creating SQL question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update SQL question (vendor only). Recomputes hash if correctSql provided.
router.put('/:id', [
  authorize('vendor_admin'),
  body('text').optional().trim().notEmpty(),
  body('marks').optional().isInt({ min: 1 }),
  body('correctSql').optional(),
  body('order').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const question = await SQLQuestion.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!question) {
      return res.status(404).json({ message: 'SQL question not found' });
    }

    const test = await Test.findById(question.testId);
    if (!test || test.type !== 'sql') {
      return res.status(400).json({ message: 'Test not found or not SQL test' });
    }

    if (req.body.text !== undefined) question.text = req.body.text;
    if (req.body.marks !== undefined) question.marks = req.body.marks;
    if (req.body.order !== undefined) question.order = req.body.order;

    if (req.body.correctSql !== undefined) {
      const template = await DatasetTemplate.findById(test.datasetTemplateId);
      if (!template) {
        return res.status(400).json({ message: 'Dataset template not found' });
      }
      const expectedOutputHash = getExpectedOutputHash(template.schemaSql, template.dataSql, req.body.correctSql);
      if (!expectedOutputHash) {
        return res.status(400).json({
          message: 'Correct SQL did not run successfully.',
          runError: true
        });
      }
      question.correctSql = req.body.correctSql;
      question.expectedOutputHash = expectedOutputHash;
    }

    await question.save();
    const out = question.toObject();
    delete out.correctSql;
    res.json(out);
  } catch (error) {
    console.error('Error updating SQL question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete SQL question
router.delete('/:id', authorize('vendor_admin'), async (req, res) => {
  try {
    const question = await SQLQuestion.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });
    if (!question) {
      return res.status(404).json({ message: 'SQL question not found' });
    }
    await Test.findByIdAndUpdate(question.testId, {
      $pull: { questions: { questionId: question._id } }
    });
    await SQLQuestion.findByIdAndDelete(req.params.id);
    res.json({ message: 'SQL question deleted' });
  } catch (error) {
    console.error('Error deleting SQL question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Run a query against the test's dataset and return rows (vendor only, for preview when creating questions)
router.post('/test/:testId/run-query', authorize('vendor_admin'), [
  body('query').notEmpty().trim().withMessage('Query is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const test = await Test.findOne({
      _id: req.params.testId,
      vendorId: req.vendorId,
      type: 'sql'
    });
    if (!test) {
      return res.status(404).json({ message: 'SQL test not found' });
    }
    const template = await DatasetTemplate.findById(test.datasetTemplateId);
    if (!template) {
      return res.status(400).json({ message: 'Dataset template not found' });
    }
    const { query } = req.body;
    const run = runInSandbox(template.schemaSql, template.dataSql || '', query);
    return res.json({
      success: run.success,
      rows: run.rows || [],
      error: run.error || null
    });
  } catch (error) {
    console.error('Error running vendor query:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Dry-run / validate: run all correct SQL for a test and return success/errors (vendor only)
router.post('/test/:testId/validate', authorize('vendor_admin'), async (req, res) => {
  try {
    const test = await Test.findOne({
      _id: req.params.testId,
      vendorId: req.vendorId,
      type: 'sql'
    });
    if (!test) {
      return res.status(404).json({ message: 'SQL test not found' });
    }
    const template = await DatasetTemplate.findById(test.datasetTemplateId);
    if (!template) {
      return res.status(400).json({ message: 'Dataset template not found' });
    }

    const questions = await SQLQuestion.find({ testId: test._id }).sort({ order: 1 });
    const results = [];
    let allOk = true;
    for (const q of questions) {
      const run = runInSandbox(template.schemaSql, template.dataSql, q.correctSql);
      results.push({
        questionId: q._id,
        text: q.text.substring(0, 50) + (q.text.length > 50 ? '...' : ''),
        success: run.success,
        error: run.error || null
      });
        if (!run.success) allOk = false;
    }
    res.json({ valid: allOk, results });
  } catch (error) {
    console.error('Error validating SQL test:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
