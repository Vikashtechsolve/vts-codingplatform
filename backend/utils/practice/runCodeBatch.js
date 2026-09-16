const Queue = require('bull');
const { getBullQueueOptions } = require('../../config/redis');
const { CODE_EXECUTION_BATCH } = require('../../config/bullQueueNames');
const {
  JOB_TIMEOUT,
  HTTP_WAIT_BATCH_MS,
  HTTP_WAIT_BATCH_MAX_MS,
  CODE_JOB_POLL_MS,
  JOB_ATTEMPTS,
  JOB_RETRY_DELAY_MS,
} = require('../../config/codeExecution');

const JOB_ADD_OPTS = {
  timeout: JOB_TIMEOUT,
  attempts: JOB_ATTEMPTS,
  backoff: { type: 'fixed', delay: JOB_RETRY_DELAY_MS },
  removeOnComplete: { age: 300, count: 1000 },
  removeOnFail: { age: 600, count: 300 },
};

let batchQueue = null;

function initBatchQueue() {
  if (batchQueue) return batchQueue;
  try {
    batchQueue = new Queue(CODE_EXECUTION_BATCH, getBullQueueOptions());
    return batchQueue;
  } catch (err) {
    console.warn('Practice code batch queue unavailable:', err.message);
    return null;
  }
}

async function awaitJobResultPolled(queue, job, httpMs) {
  const jobId = job.id;
  const deadline = Date.now() + httpMs;

  while (Date.now() < deadline) {
    let snapshot = null;
    try {
      snapshot = await queue.getJob(jobId);
    } catch {
      snapshot = null;
    }

    if (!snapshot) {
      try {
        await job.reload();
        snapshot = job;
      } catch {
        if (job.returnvalue !== undefined && job.returnvalue !== null) {
          return job.returnvalue;
        }
      }
    }

    if (snapshot) {
      let state = 'unknown';
      try {
        state = await snapshot.getState();
      } catch {
        state = 'unknown';
      }

      if (state === 'completed') {
        if (snapshot.returnvalue !== undefined && snapshot.returnvalue !== null) {
          return snapshot.returnvalue;
        }
      } else if (state === 'failed') {
        throw new Error(snapshot.failedReason || 'Job failed');
      }
    }

    await new Promise((r) => setTimeout(r, CODE_JOB_POLL_MS));
  }

  throw new Error(`execute-batch: no response after ${httpMs}ms`);
}

async function runCodeBatch({ code, language, testCases }) {
  const queue = initBatchQueue();
  if (!queue) {
    throw new Error('Code execution service unavailable');
  }

  await queue.isReady();
  const n = testCases.length;
  const batchHttpMs = Math.min(
    HTTP_WAIT_BATCH_MAX_MS,
    Math.max(HTTP_WAIT_BATCH_MS, JOB_TIMEOUT + 30000, n * 20000)
  );

  const job = await queue.add({ code, language, testCases }, JOB_ADD_OPTS);
  return awaitJobResultPolled(queue, job, batchHttpMs);
}

function deriveSubmissionStatus(batchResult) {
  if (!batchResult || batchResult.success === false) {
    const err = (batchResult?.error || '').toLowerCase();
    if (err.includes('compile')) return 'compile_error';
    if (err.includes('timeout') || err.includes('timed out')) return 'timeout';
    if (err.includes('runtime')) return 'runtime_error';
    return 'runtime_error';
  }

  const passed = batchResult.testCasesPassed ?? 0;
  const total = batchResult.total ?? batchResult.results?.length ?? 0;
  if (total > 0 && passed === total) return 'accepted';
  return 'wrong_answer';
}

module.exports = {
  runCodeBatch,
  deriveSubmissionStatus,
};
