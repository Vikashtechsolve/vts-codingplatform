#!/usr/bin/env node

/**
 * Test Redis Connection
 * Run this script to verify Redis is properly configured
 */

require('dotenv').config();
const { testRedisConnection, getRedisConfig } = require('../config/redis');

async function main() {
  console.log('🔍 Testing Redis Configuration');
  console.log('================================\n');

  // Show current configuration
  const config = getRedisConfig();
  console.log('📋 Current Redis Config:');
  if (typeof config === 'string') {
    console.log('   URL:', config.replace(/:[^:@]+@/, ':****@')); // Hide password
  } else {
    console.log('   Host:', config.host);
    console.log('   Port:', config.port);
    console.log('   Password:', config.password ? '****' : 'None');
  }
  console.log('');

  // Test connection
  const isConnected = await testRedisConnection();

  if (isConnected) {
    console.log('\n✅ Redis is properly configured and running!');
    console.log('You can now start the application.\n');
    process.exit(0);
  } else {
    console.log('\n❌ Redis connection failed!');
    console.log('\n📝 Troubleshooting steps:');
    console.log('1. Make sure Redis is installed');
    console.log('2. Start Redis:');
    console.log('   - macOS: brew services start redis');
    console.log('   - Linux: sudo systemctl start redis-server');
    console.log('   - Docker: docker run -d -p 6379:6379 redis:alpine');
    console.log('3. Check your .env file has correct Redis configuration');
    console.log('4. Test manually: redis-cli ping\n');
    process.exit(1);
  }
}

main();
