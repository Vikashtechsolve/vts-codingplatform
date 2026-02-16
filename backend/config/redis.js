/**
 * Redis Configuration
 * Works both locally and in deployment (Railway, Heroku, etc.)
 */

/**
 * Detect if Redis URL points to Railway (for contextual logging)
 */
function isRailwayRedis(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return lower.includes('railway') || lower.includes('rlwy.net') || lower.includes('railway.internal');
}

/**
 * Get Redis configuration based on environment
 * Priority: REDIS_URL > Individual params (HOST, PORT, PASSWORD)
 */
function getRedisConfig() {
  const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

  // Check if REDIS_URL is provided (common in cloud deployments)
  if (process.env.REDIS_URL) {
    const url = process.env.REDIS_URL;
    const isRemote = isRailwayRedis(url);
    if (isRailway) {
      console.log('📡 Redis: Using REDIS_URL (Railway deployment)');
    } else {
      console.log('📡 Redis: Using REDIS_URL (local dev → connecting to remote Redis)');
      if (isRemote) {
        console.log('   ℹ️  Tip: Public URL from local may have higher latency. For prod, backend and Redis run together on Railway.');
      }
    }
    return url;
  }

  // Use individual parameters (common in local development)
  const config = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  };

  if (process.env.REDIS_PASSWORD) {
    config.password = process.env.REDIS_PASSWORD;
  }

  console.log('📡 Redis: Using host/port config', {
    host: config.host,
    port: config.port,
    hasPassword: !!config.password
  });

  return config;
}

/**
 * Get Bull queue options with retry logic
 */
function getBullQueueOptions() {
  const redisConfig = getRedisConfig();

  // For remote Redis (URL), add longer timeout - ETIMEDOUT is common with Railway/cloud
  const redisOpts = typeof redisConfig === 'string'
    ? {
        url: redisConfig,
        connectTimeout: 30000,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => (times > 10 ? null : Math.min(times * 1000, 10000))
      }
    : {
        ...redisConfig,
        connectTimeout: 30000,
        maxRetriesPerRequest: 3
      };

  return {
    redis: redisOpts,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24 hours
        count: 1000 // Keep last 1000 completed jobs
      },
      removeOnFail: {
        age: 604800 // Keep failed jobs for 7 days
      }
    },
    settings: {
      enableReadyCheck: true
    }
  };
}

/**
 * Test Redis connection
 */
async function testRedisConnection() {
  const redis = require('redis');
  const redisConfig = getRedisConfig();

  try {
    let client;

    if (typeof redisConfig === 'string') {
      // URL format
      client = redis.createClient({ url: redisConfig });
    } else {
      // Object format
      client = redis.createClient(redisConfig);
    }

    await client.connect();
    const pong = await client.ping();
    
    if (pong === 'PONG') {
      console.log('✅ Redis: Connection test successful');
      await client.quit();
      return true;
    }
  } catch (error) {
    console.error('❌ Redis: Connection test failed:', error.message);
    if (process.env.REDIS_URL) {
      console.log('💡 REDIS_URL is set. Check:');
      console.log('   - Railway: Ensure Redis service is running and REDIS_URL uses internal URL (railway.internal)');
      console.log('   - Local using Railway URL: Verify public URL is correct and Redis is reachable');
    } else {
      console.log('💡 Local Redis: brew services start redis | docker run -d -p 6379:6379 redis:alpine');
    }
    return false;
  }
}

module.exports = {
  getRedisConfig,
  getBullQueueOptions,
  testRedisConnection,
  isRailwayRedis
};
