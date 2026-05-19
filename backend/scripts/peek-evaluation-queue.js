/**
 * Evaluation queue depths + failed job reasons.
 * On API host: node scripts/peek-evaluation-queue.js
 * (uses .env.production if you symlink or pass REDIS_URL)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const Queue = require('bull');
const { getBullQueueOptions } = require('../config/redis');
const { PROJECT_EVALUATION } = require('../config/bullQueueNames');

async function main() {
  const q = new Queue(PROJECT_EVALUATION, getBullQueueOptions());
  await q.isReady();

  const [waiting, delayed, active, completed, failed] = await Promise.all([
    q.getWaitingCount(),
    q.getDelayedCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount()
  ]);

  console.log('Queue:', PROJECT_EVALUATION);
  console.log({ waiting, delayed, active, completed, failed });

  if (delayed > 0) {
    const delayedJobs = await q.getDelayed(0, 9);
    console.log('\nDelayed jobs (not failed — waiting for timer):');
    for (const job of delayedJobs) {
      const runAt = job.timestamp + (job.opts.delay || 0);
      console.log('  -', job.id, 'submissionId=', job.data.submissionId, 'runs~', new Date(runAt).toISOString());
    }
  }

  if (failed > 0) {
    const failedJobs = await q.getFailed(0, 9);
    console.log('\nFailed jobs (check Mongo EvaluationJob.error too):');
    for (const job of failedJobs) {
      console.log('  -', job.id, 'submissionId=', job.data.submissionId);
      console.log('    failedReason:', job.failedReason || '(none)');
    }
  }

  await q.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
