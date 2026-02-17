#!/usr/bin/env node

/**
 * Test Redis Connection
 * Run this script to verify Redis is properly configured
 */

require('dotenv').config();
const { testRedisConnection, getRedisUrl } = require('../config/redis');

async function main() {
  console.log('🔍 Testing Redis Configuration');
  console.log('================================\n');

  const url = getRedisUrl();
  if (url) {
    console.log('📋 REDIS_URL:', url.replace(/:[^:@]+@/, ':****@'));
  } else {
    console.log('📋 REDIS_URL: not set');
  }
  console.log('');

  const isConnected = await testRedisConnection();

  if (isConnected) {
    console.log('\n✅ Redis is properly configured and running!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Redis connection failed!');
    console.log('📝 Set REDIS_URL in .env to Railway public Redis URL.\n');
    process.exit(1);
  }
}

main();
