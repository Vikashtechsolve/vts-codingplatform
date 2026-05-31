const mongoose = require('mongoose');

const englishGrammarQuestionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  subType: {
    type: String,
    enum: ['fill_in_blank', 'error_detection', 'sentence_correction', 'parajumble', 'active_passive', 'direct_indirect'],
    required: true
  },
  blankSentence: {
    type: String,
    trim: true
  },
  sentences: [{
    type: String,
    trim: true
  }],
  correctOrder: [{
    type: Number
  }],
  options: [{
    text: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  }],
  correctAnswer: {
    type: String,
    trim: true
  },
  isSubjective: {
    type: Boolean,
    default: false
  },
  explanation: {
    type: String,
    trim: true
  },
  grammarCategory: {
    type: String,
    trim: true
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
    default: 10
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EnglishGrammarQuestion', englishGrammarQuestionSchema);
