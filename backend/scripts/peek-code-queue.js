/**
 * Print Bull queue depths for code execution (same names as API/worker).
 * Run on API or worker host: REDIS_URL=... node scripts/peek-code-queue.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Queue = require('bull');
const { getBullQueueOptions } = require('../config/redis');
const {
  CODE_EXECUTION_SINGLE,
  CODE_EXECUTION_BATCH
} = require('../config/bullQueueNames');
const {
  MAX_QUEUE_WAITING_SINGLE,
  MAX_QUEUE_WAITING_BATCH,
  WORKER_SINGLE_CONCURRENCY,
  WORKER_BATCH_CONCURRENCY,
} = require('../config/codeExecution');

async function main() {
  const opts = getBullQueueOptions();
  const single = new Queue(CODE_EXECUTION_SINGLE, opts);
  const batch = new Queue(CODE_EXECUTION_BATCH, opts);
  await single.isReady();
  const [sw, sa, sc, sf, bw, ba, bc, bf] = await Promise.all([
    single.getWaitingCount(),
    single.getActiveCount(),
    single.getCompletedCount(),
    single.getFailedCount(),
    batch.getWaitingCount(),
    batch.getActiveCount(),
    batch.getCompletedCount(),
    batch.getFailedCount()
  ]);
  console.log('Queue names:', CODE_EXECUTION_SINGLE, '|', CODE_EXECUTION_BATCH);
  console.log('limits:', {
    maxWaitingSingle: MAX_QUEUE_WAITING_SINGLE,
    maxWaitingBatch: MAX_QUEUE_WAITING_BATCH,
    workerSingleConcurrency: WORKER_SINGLE_CONCURRENCY,
    workerBatchConcurrency: WORKER_BATCH_CONCURRENCY,
  });
  console.log('single:', { waiting: sw, active: sa, completed: sc, failed: sf });
  console.log('batch: ', { waiting: bw, active: ba, completed: bc, failed: bf });
  if (bw > 0 || sw > 0) {
    console.log('\nIf waiting grows but active stays 0, the code-worker is not consuming (wrong image, REDIS_URL, or queue names).');
  }
  await single.close();
  await batch.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
