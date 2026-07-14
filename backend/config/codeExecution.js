/**
 * Shared code-execution limits for API routes and the Bull worker.
 * Tune via env on the API and worker hosts (same values on both).
 */

function readInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Legacy alias — applies to both queues when per-queue vars are unset. */
const LEGACY_MAX_QUEUE = readInt('MAX_QUEUE_SIZE', 0);

const MAX_QUEUE_WAITING_SINGLE = readInt(
  'MAX_QUEUE_WAITING_SINGLE',
  LEGACY_MAX_QUEUE || 200
);
const MAX_QUEUE_WAITING_BATCH = readInt(
  'MAX_QUEUE_WAITING_BATCH',
  LEGACY_MAX_QUEUE || 400
);

const JOB_TIMEOUT = readInt('CODE_JOB_TIMEOUT', 90000);
const EXECUTION_TIMEOUT = readInt('CODE_EXECUTION_TIMEOUT', 5000);

const HTTP_WAIT_EXECUTE_MS = readInt('CODE_HTTP_WAIT_EXECUTE_MS', 120000);
const HTTP_WAIT_BATCH_MS = readInt('CODE_HTTP_WAIT_BATCH_MS', 300000);
const HTTP_WAIT_BATCH_MAX_MS = readInt('CODE_HTTP_WAIT_BATCH_MAX_MS', 600000);
const CODE_JOB_POLL_MS = readInt('CODE_JOB_POLL_MS', 800);

const LEGACY_WORKER_CONCURRENCY = readInt('CODE_WORKER_CONCURRENCY', 0);
const WORKER_SINGLE_CONCURRENCY = readInt(
  'CODE_WORKER_SINGLE_CONCURRENCY',
  LEGACY_WORKER_CONCURRENCY || 12
);
const WORKER_BATCH_CONCURRENCY = readInt(
  'CODE_WORKER_BATCH_CONCURRENCY',
  LEGACY_WORKER_CONCURRENCY || 10
);

/** Run up to N sample/hidden cases concurrently inside one batch job (compile once). */
const BATCH_CASE_PARALLELISM = readInt('CODE_BATCH_CASE_PARALLELISM', 1);

const JOB_ATTEMPTS = readInt('CODE_JOB_ATTEMPTS', 2);
const JOB_RETRY_DELAY_MS = readInt('CODE_JOB_RETRY_DELAY_MS', 2000);

module.exports = {
  MAX_QUEUE_WAITING_SINGLE,
  MAX_QUEUE_WAITING_BATCH,
  JOB_TIMEOUT,
  EXECUTION_TIMEOUT,
  HTTP_WAIT_EXECUTE_MS,
  HTTP_WAIT_BATCH_MS,
  HTTP_WAIT_BATCH_MAX_MS,
  CODE_JOB_POLL_MS,
  WORKER_SINGLE_CONCURRENCY,
  WORKER_BATCH_CONCURRENCY,
  BATCH_CASE_PARALLELISM,
  JOB_ATTEMPTS,
  JOB_RETRY_DELAY_MS,
};
