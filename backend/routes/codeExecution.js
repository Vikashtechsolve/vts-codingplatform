const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Queue = require('bull');
const { auth } = require('../middleware/auth');
const { getBullQueueOptions } = require('../config/redis');

const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '100', 10);
const JOB_TIMEOUT = parseInt(process.env.CODE_JOB_TIMEOUT || '60000', 10);

let singleQueue = null;
let batchQueue = null;
let queuesReady = false;

function initQueues() {
  if (singleQueue) return;
  try {
    const opts = getBullQueueOptions();
    singleQueue = new Queue('code-execution-single', opts);
    batchQueue = new Queue('code-execution-batch', opts);
    singleQueue.on('ready', () => { queuesReady = true; });
    singleQueue.on('error', () => { queuesReady = false; });
    batchQueue.on('error', () => {});
  } catch (err) {
    console.warn('Code execution queues unavailable:', err.message);
  }
}

initQueues();

function queueAvailable(res) {
  if (!singleQueue || !batchQueue || !queuesReady) {
    res.status(503).json({ success: false, output: '', error: 'Code execution service unavailable. Please try again later.', executionTime: 0 });
    return false;
  }
  return true;
}

async function isQueueFull(queue, res) {
  const waiting = await queue.getWaitingCount();
  if (waiting >= MAX_QUEUE_SIZE) {
    res.status(429).json({ success: false, output: '', error: 'Server busy. Too many executions queued. Please try again in a moment.', executionTime: 0 });
    return true;
  }
  return false;
}

// Single execution endpoint (custom test cases, one-off runs)
router.post('/execute', [
  auth,
  body('code').notEmpty().withMessage('Code is required'),
  body('language').isIn(['java', 'cpp', 'c', 'python']).withMessage('Invalid language'),
  body('input').optional()
], async (req, res) => {
  if (!queueAvailable(res)) return;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, output: '', error: errors.array().map(e => e.msg).join(', '), executionTime: 0 });
  }

  const { code, language, input } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, output: '', error: 'Code cannot be empty', executionTime: 0 });
  }

  if (await isQueueFull(singleQueue, res)) return;

  try {
    const job = await singleQueue.add(
      { code, language, input: input || '' },
      { timeout: JOB_TIMEOUT, removeOnComplete: { age: 300, count: 500 }, removeOnFail: { age: 600, count: 200 } }
    );

    const result = await job.finished();
    res.json(result);
  } catch (err) {
    const msg = err.message || 'Execution failed';
    const isTimeout = msg.includes('timed out');
    res.status(isTimeout ? 408 : 500).json({
      success: false, output: '', error: isTimeout ? 'Execution timed out. Please simplify your code.' : msg, executionTime: 0
    });
  }
});

// Batch execution endpoint (all test cases in one request)
router.post('/execute-batch', [
  auth,
  body('code').notEmpty().withMessage('Code is required'),
  body('language').isIn(['java', 'cpp', 'c', 'python']).withMessage('Invalid language'),
  body('testCases').isArray({ min: 1, max: 50 }).withMessage('testCases must be an array (1-50 items)')
], async (req, res) => {
  if (!queueAvailable(res)) return;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', '), results: [] });
  }

  const { code, language, testCases } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: 'Code cannot be empty', results: [] });
  }

  if (await isQueueFull(batchQueue, res)) return;

  try {
    const job = await batchQueue.add(
      { code, language, testCases },
      { timeout: JOB_TIMEOUT, removeOnComplete: { age: 300, count: 500 }, removeOnFail: { age: 600, count: 200 } }
    );

    const result = await job.finished();
    res.json(result);
  } catch (err) {
    const msg = err.message || 'Execution failed';
    const isTimeout = msg.includes('timed out');
    res.status(isTimeout ? 408 : 500).json({
      success: false, error: isTimeout ? 'Execution timed out. Please simplify your code.' : msg, results: []
    });
  }
});

// Health check for code execution service
router.get('/health', async (req, res) => {
  if (!singleQueue || !batchQueue) {
    return res.status(503).json({ status: 'unavailable', message: 'Queues not initialized' });
  }
  try {
    const [sWait, sActive, bWait, bActive] = await Promise.all([
      singleQueue.getWaitingCount(), singleQueue.getActiveCount(),
      batchQueue.getWaitingCount(), batchQueue.getActiveCount()
    ]);
    res.json({
      status: 'ok',
      queuesReady,
      single: { waiting: sWait, active: sActive },
      batch: { waiting: bWait, active: bActive },
      maxQueueSize: MAX_QUEUE_SIZE,
      jobTimeout: JOB_TIMEOUT
    });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
