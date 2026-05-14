const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Queue = require('bull');
const { auth } = require('../middleware/auth');
const { getBullQueueOptions } = require('../config/redis');
const {
  CODE_EXECUTION_SINGLE,
  CODE_EXECUTION_BATCH
} = require('../config/bullQueueNames');

const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '100', 10);
const JOB_TIMEOUT = parseInt(process.env.CODE_JOB_TIMEOUT || '60000', 10);

/** Wall-clock cap for HTTP handler — job.finished() never resolves if no worker picks the job. */
const HTTP_WAIT_EXECUTE_MS = parseInt(process.env.CODE_HTTP_WAIT_EXECUTE_MS || '120000', 10);
const HTTP_WAIT_BATCH_MS = parseInt(process.env.CODE_HTTP_WAIT_BATCH_MS || '300000', 10);
const HTTP_WAIT_BATCH_MAX_MS = parseInt(process.env.CODE_HTTP_WAIT_BATCH_MAX_MS || '600000', 10);

/**
 * @param {object} job Bull job
 * @param {number} ms
 * @param {string} label
 */
async function awaitJobFinishedOrHttpTimeout(job, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `${label}: no response after ${ms}ms. Ensure the code-worker process is running with the same ` +
            `REDIS_URL and the same deployment (queue names) as this API.`
        )
      );
    }, ms);
  });
  try {
    return await Promise.race([job.finished(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

let singleQueue = null;
let batchQueue = null;

function initQueues() {
  if (singleQueue) return true;
  try {
    const opts = getBullQueueOptions();
    singleQueue = new Queue(CODE_EXECUTION_SINGLE, opts);
    batchQueue = new Queue(CODE_EXECUTION_BATCH, opts);

    singleQueue.on('error', (err) => {
      console.error('Code single-queue Redis error:', err.message);
    });
    batchQueue.on('error', (err) => {
      console.error('Code batch-queue Redis error:', err.message);
    });
    singleQueue.on('ready', () => console.log('Code single-queue connected to Redis'));
    batchQueue.on('ready', () => console.log('Code batch-queue connected to Redis'));

    return true;
  } catch (err) {
    console.warn('Code execution queues unavailable:', err.message);
    return false;
  }
}

initQueues();

async function ensureQueues(res) {
  if (!singleQueue || !batchQueue) {
    if (!initQueues()) {
      res.status(503).json({ success: false, output: '', error: 'Code execution service unavailable. Redis not configured.', executionTime: 0 });
      return false;
    }
  }

  try {
    await singleQueue.isReady();
    return true;
  } catch (err) {
    res.status(503).json({ success: false, output: '', error: 'Code execution service temporarily unavailable. Please try again in a moment.', executionTime: 0 });
    return false;
  }
}

async function isQueueFull(queue, res) {
  const waiting = await queue.getWaitingCount();
  if (waiting >= MAX_QUEUE_SIZE) {
    res.status(429).json({ success: false, output: '', error: 'Server busy. Too many executions queued. Please try again in a moment.', executionTime: 0 });
    return true;
  }
  return false;
}

/** Stats only — no job processors. Used by GET /api/health/code-execution (never load codeExecutionWorker on API). */
async function getCodeQueueStats() {
  if (!singleQueue || !batchQueue) initQueues();
  if (!singleQueue || !batchQueue) {
    throw new Error('Code execution queues not initialized');
  }
  await singleQueue.isReady();
  const [sWait, sActive, sCompleted, sFailed] = await Promise.all([
    singleQueue.getWaitingCount(), singleQueue.getActiveCount(),
    singleQueue.getCompletedCount(), singleQueue.getFailedCount()
  ]);
  const [bWait, bActive, bCompleted, bFailed] = await Promise.all([
    batchQueue.getWaitingCount(), batchQueue.getActiveCount(),
    batchQueue.getCompletedCount(), batchQueue.getFailedCount()
  ]);
  return {
    single: { waiting: sWait, active: sActive, completed: sCompleted, failed: sFailed },
    batch: { waiting: bWait, active: bActive, completed: bCompleted, failed: bFailed },
    totalWaiting: sWait + bWait,
    totalActive: sActive + bActive
  };
}

// Single execution endpoint (custom test cases, one-off runs)
router.post('/execute', [
  auth,
  body('code').notEmpty().withMessage('Code is required'),
  body('language').isIn(['java', 'cpp', 'c', 'python']).withMessage('Invalid language'),
  body('input').optional()
], async (req, res) => {
  if (!(await ensureQueues(res))) return;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, output: '', error: errors.array().map(e => e.msg).join(', '), executionTime: 0 });
  }

  const { code, language, input } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, output: '', error: 'Code cannot be empty', executionTime: 0 });
  }

  if (await isQueueFull(singleQueue, res)) return;

  let job;
  try {
    job = await singleQueue.add(
      { code, language, input: input || '' },
      { timeout: JOB_TIMEOUT, removeOnComplete: { age: 300, count: 500 }, removeOnFail: { age: 600, count: 200 } }
    );

    const httpMs = Math.max(HTTP_WAIT_EXECUTE_MS, JOB_TIMEOUT + 15000);
    const result = await awaitJobFinishedOrHttpTimeout(job, httpMs, 'execute');
    res.json(result);
  } catch (err) {
    const msg = err.message || 'Execution failed';
    console.error('[code-execution/execute]', msg, err.stack || '');
    const stalled = msg.includes('no response after');
    const isJobTimeout = msg.includes('timed out');
    if (stalled && job) job.remove().catch(() => {});
    res.status(stalled ? 503 : isJobTimeout ? 408 : 500).json({
      success: false,
      output: '',
      error: stalled ? msg : isJobTimeout ? 'Execution timed out. Please simplify your code.' : msg,
      executionTime: 0
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
  if (!(await ensureQueues(res))) return;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', '), results: [] });
  }

  const { code, language, testCases } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ success: false, error: 'Code cannot be empty', results: [] });
  }

  if (await isQueueFull(batchQueue, res)) return;

  const n = testCases.length;
  const batchHttpMs = Math.min(
    HTTP_WAIT_BATCH_MAX_MS,
    Math.max(HTTP_WAIT_BATCH_MS, JOB_TIMEOUT + 30000, n * 25000)
  );

  let job;
  try {
    job = await batchQueue.add(
      { code, language, testCases },
      { timeout: JOB_TIMEOUT, removeOnComplete: { age: 300, count: 500 }, removeOnFail: { age: 600, count: 200 } }
    );

    const result = await awaitJobFinishedOrHttpTimeout(job, batchHttpMs, 'execute-batch');
    res.json(result);
  } catch (err) {
    const msg = err.message || 'Execution failed';
    console.error('[code-execution/execute-batch]', msg, err.stack || '');
    const stalled = msg.includes('no response after');
    const isJobTimeout = msg.includes('timed out');
    if (stalled && job) job.remove().catch(() => {});
    res.status(stalled ? 503 : isJobTimeout ? 408 : 500).json({
      success: false,
      error: stalled ? msg : isJobTimeout ? 'Execution timed out. Please simplify your code.' : msg,
      results: []
    });
  }
});

// Health check for code execution service
router.get('/health', async (req, res) => {
  if (!singleQueue || !batchQueue) {
    return res.status(503).json({ status: 'unavailable', message: 'Queues not initialized' });
  }
  try {
    await singleQueue.isReady();
    const [sWait, sActive, bWait, bActive] = await Promise.all([
      singleQueue.getWaitingCount(), singleQueue.getActiveCount(),
      batchQueue.getWaitingCount(), batchQueue.getActiveCount()
    ]);
    res.json({
      status: 'ok',
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
module.exports.getCodeQueueStats = getCodeQueueStats;
