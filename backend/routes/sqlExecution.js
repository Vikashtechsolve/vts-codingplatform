const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth } = require('../middleware/auth');
const Result = require('../models/Result');
const Test = require('../models/Test');
const DatasetTemplate = require('../models/DatasetTemplate');
const SQLQuestion = require('../models/SQLQuestion');
const { runInSandbox } = require('../utils/sqlSandbox');

const MAX_RUNS_PER_TEST = parseInt(process.env.SQL_MAX_RUNS_PER_TEST || '100', 10);

// In-memory run counter per result (optional: could use Redis in production)
const runCounts = new Map();

function getRunCount(resultId) {
  const key = String(resultId);
  return runCounts.get(key) || 0;
}

function incrementRunCount(resultId) {
  const key = String(resultId);
  const next = (runCounts.get(key) || 0) + 1;
  runCounts.set(key, next);
  return next;
}

/**
 * Run student SQL query in sandbox (during test).
 * POST /api/sql-execution/run
 * Body: { resultId, questionId, query }
 */
router.post('/run', [
  auth,
  body('resultId').notEmpty().withMessage('resultId is required'),
  body('questionId').notEmpty().withMessage('questionId is required'),
  body('query').notEmpty().withMessage('query is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { resultId, questionId, query } = req.body;

    const result = await Result.findOne({
      _id: resultId,
      studentId: req.user._id,
      status: 'in_progress'
    });
    if (!result) {
      return res.status(404).json({ message: 'Result not found or test already submitted' });
    }

    const runCount = incrementRunCount(resultId);
    if (runCount > MAX_RUNS_PER_TEST) {
      return res.status(429).json({
        success: false,
        error: `Query execution limit reached (${MAX_RUNS_PER_TEST} per test).`,
        rows: []
      });
    }

    const test = await Test.findById(result.testId).populate('datasetTemplateId');
    if (!test || test.type !== 'sql' || !test.datasetTemplateId) {
      return res.status(400).json({ success: false, error: 'Not an SQL test or dataset missing.', rows: [] });
    }

    let template = test.datasetTemplateId;
    if (template && !template.schemaSql) {
      template = await DatasetTemplate.findById(template._id || template);
    }
    if (!template || !template.schemaSql) {
      return res.status(400).json({ success: false, error: 'Dataset template not found.', rows: [] });
    }

    const sandboxResult = runInSandbox(template.schemaSql, template.dataSql || '', query);

    let isCorrect = false;
    if (sandboxResult.success) {
      const sqlQuestion = await SQLQuestion.findById(questionId).select('expectedOutputHash');
      if (sqlQuestion) {
        const expected = sqlQuestion.expectedOutputHash;
        isCorrect =
          sandboxResult.outputHash === expected ||
          (sandboxResult.outputHashSet && sandboxResult.outputHashSet === expected);
      }
    }

    res.json({
      success: sandboxResult.success,
      rows: sandboxResult.rows,
      error: sandboxResult.error,
      isCorrect,
      runCount,
      maxRuns: MAX_RUNS_PER_TEST
    });
  } catch (error) {
    console.error('SQL execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Execution failed',
      rows: []
    });
  }
});

module.exports = router;
