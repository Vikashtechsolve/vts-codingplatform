const mongoose = require('mongoose');

const englishEssayQuestionSchema = new mongoose.Schema({
  prompt: {
    type: String,
    required: true,
    trim: true
  },
  writingType: {
    type: String,
    enum: [
      'essay_general', 'essay_opinion', 'essay_argumentative',
      'email_formal', 'email_informal',
      'letter_formal', 'letter_informal',
      'report', 'notice'
    ],
    required: true
  },
  instructions: {
    type: String,
    trim: true
  },
  wordLimit: {
    min: { type: Number, default: 100 },
    max: { type: Number, default: 500 }
  },
  timeLimit: {
    type: Number
  },
  sampleResponse: {
    type: String
  },
  expectedFormat: {
    type: String,
    trim: true
  },
  evaluationWeights: {
    grammar: { type: Number, default: 0.20 },
    vocabulary: { type: Number, default: 0.15 },
    coherence: { type: Number, default: 0.20 },
    structure: { type: Number, default: 0.15 },
    tone: { type: Number, default: 0.15 },
    relevance: { type: Number, default: 0.15 }
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  tags: {
    type: [String],
    default: [],
    set: (tags) =>
      Array.from(
        new Set(
          (Array.isArray(tags) ? tags : [])
            .map((tag) => String(tag || '').trim())
            .filter(Boolean)
        )
      )
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

module.exports = mongoose.model('EnglishEssayQuestion', englishEssayQuestionSchema);
