/**
 * Script to fix old questions that don't have isGlobal field set
 * This will set isGlobal: false for all questions that have a vendorId
 */

const mongoose = require('mongoose');
require('dotenv').config();

const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');

async function fixOldQuestions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Fix coding questions
    const codingResult = await CodingQuestion.updateMany(
      { 
        vendorId: { $exists: true, $ne: null },
        isGlobal: { $exists: false }
      },
      { $set: { isGlobal: false } }
    );
    console.log(`✅ Updated ${codingResult.modifiedCount} coding questions`);

    // Fix MCQ questions
    const mcqResult = await MCQQuestion.updateMany(
      { 
        vendorId: { $exists: true, $ne: null },
        isGlobal: { $exists: false }
      },
      { $set: { isGlobal: false } }
    );
    console.log(`✅ Updated ${mcqResult.modifiedCount} MCQ questions`);

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing questions:', error);
    process.exit(1);
  }
}

fixOldQuestions();

