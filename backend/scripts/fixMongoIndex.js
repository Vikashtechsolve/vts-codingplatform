const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const fixMongoIndex = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform');
    console.log('✅ MongoDB Connected\n');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    console.log('🔍 Checking indexes on users collection...\n');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('📋 Current indexes:');
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${JSON.stringify(index.key)} - ${index.name}`);
    });

    // Check if username index exists
    const usernameIndex = indexes.find(idx => idx.key && idx.key.username);
    
    if (usernameIndex) {
      console.log('\n⚠️  Found username index - this is causing the issue!');
      console.log('📝 Dropping username index...');
      
      try {
        await collection.dropIndex(usernameIndex.name);
        console.log('✅ Username index dropped successfully!');
      } catch (error) {
        console.log('❌ Error dropping index:', error.message);
        // Try alternative method
        try {
          await collection.dropIndex('username_1');
          console.log('✅ Username index dropped (alternative method)!');
        } catch (err) {
          console.log('❌ Alternative method also failed:', err.message);
        }
      }
    } else {
      console.log('\n✅ No username index found - database is clean');
    }

    // Verify email index exists
    const emailIndex = indexes.find(idx => idx.key && idx.key.email);
    if (!emailIndex) {
      console.log('\n📝 Creating email index...');
      await collection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Email index created');
    } else {
      console.log('\n✅ Email index already exists');
    }

    console.log('\n✅ Database indexes fixed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    mongoose.disconnect();
  }
};

fixMongoIndex();

