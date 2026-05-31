const mongoose = require('mongoose');

const englishReadingQuestionSchema = new mongoose.Schema({
  passage: {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true
    },
    source: {
      type: String,
      trim: true
    },
    wordCount: {
      type: Number
    },
    genre: {
      type: String,
      enum: ['fiction', 'non_fiction', 'editorial', 'scientific', 'business', 'narrative', 'descriptive'],
      default: 'non_fiction'
    }
  },
  questions: [{
    questionText: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      enum: ['mcq', 'short_answer', 'true_false', 'inference'],
      required: true
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
    referenceAnswer: {
      type: String
    },
    points: {
      type: Number,
      default: 5
    }
  }],
  totalPoints: {
    type: Number,
    default: 0
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
  }
}, {
  timestamps: true
});

englishReadingQuestionSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 5), 0);
  }
  next();
});

module.exports = mongoose.model('EnglishReadingQuestion', englishReadingQuestionSchema);
