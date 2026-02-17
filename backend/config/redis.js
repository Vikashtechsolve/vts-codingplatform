/**
 * Redis Configuration
 * Uses REDIS_URL only. Set to Railway public Redis URL in both local and deployment.
 */

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    try {
      const u = new URL(redisUrl);
      console.log('📡 Redis: Using REDIS_URL →', `${u.hostname}:${u.port || '6379'}`);
    } catch {
      console.log('📡 Redis: Using REDIS_URL');
    }
    return redisUrl;
  }

  console.error('❌ Redis: REDIS_URL not set. Add it to .env or deployment Variables.');
  return null;
}

function getBullQueueOptions() {
  const redisUrl = getRedisUrl();

  if (!redisUrl) {
    throw new Error('REDIS_URL is required. Set it in .env or deployment Variables.');
  }

  // Bull uses ioredis — pass URL string directly, NOT as {url: "..."}
  return {
    redis: redisUrl,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800 }
    },
    settings: { enableReadyCheck: true }
  };
}

async function testRedisConnection() {
  const Redis = require('ioredis');
  const redisUrl = getRedisUrl();

  if (!redisUrl) return false;

  try {
    const client = new Redis(redisUrl);
    const pong = await client.ping();
    await client.quit();

    if (pong === 'PONG') {
      console.log('✅ Redis: Connection successful');
      return true;
    }
  } catch (error) {
    console.error('❌ Redis: Connection failed:', error.message);
    return false;
  }
}

module.exports = {
  getRedisUrl,
  getBullQueueOptions,
  testRedisConnection
};
