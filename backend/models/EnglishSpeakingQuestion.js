const mongoose = require('mongoose');

const englishSpeakingQuestionSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true,
    trim: true
  },
  speakingType: {
    type: String,
    enum: ['read_aloud', 'describe_image', 'topic_speaking', 'situational', 'extempore'],
    required: true
  },
  referenceText: {
    type: String
  },
  imageUrl: {
    type: String
  },
  preparationTime: {
    type: Number,
    default: 30
  },
  speakingTime: {
    min: { type: Number, default: 30 },
    max: { type: Number, default: 120 }
  },
  maxAttempts: {
    type: Number,
    default: 2
  },
  evaluationWeights: {
    pronunciation: { type: Number, default: 0.25 },
    fluency: { type: Number, default: 0.25 },
    coherence: { type: Number, default: 0.20 },
    vocabulary: { type: Number, default: 0.15 },
    grammar: { type: Number, default: 0.15 }
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  points: {
    type: Number,
    default: 20
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EnglishSpeakingQuestion', englishSpeakingQuestionSchema);
