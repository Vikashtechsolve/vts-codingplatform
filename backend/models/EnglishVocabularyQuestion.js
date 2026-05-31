const mongoose = require('mongoose');

const englishVocabularyQuestionSchema = new mongoose.Schema({
  word: {
    type: String,
    required: true,
    trim: true
  },
  subType: {
    type: String,
    enum: ['synonym', 'antonym', 'meaning', 'one_word_substitution', 'idiom_phrase', 'spelling', 'contextual_usage'],
    required: true
  },
  contextSentence: {
    type: String,
    trim: true
  },
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
  explanation: {
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

module.exports = mongoose.model('EnglishVocabularyQuestion', englishVocabularyQuestionSchema);
