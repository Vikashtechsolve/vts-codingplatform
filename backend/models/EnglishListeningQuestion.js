const mongoose = require('mongoose');

const englishListeningQuestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  audioUrl: {
    type: String,
    required: true
  },
  audioTranscript: {
    type: String
  },
  audioDuration: {
    type: Number
  },
  maxReplays: {
    type: Number,
    default: 2
  },
  questionDelay: {
    type: Number,
    default: 0
  },
  questions: [{
    questionText: {
      type: String,
      required: true
    },
    questionType: {
      type: String,
      enum: ['mcq', 'fill_in_blank', 'short_answer', 'true_false'],
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
    correctAnswer: {
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

englishListeningQuestionSchema.pre('save', function(next) {
  if (this.questions && this.questions.length > 0) {
    this.totalPoints = this.questions.reduce((sum, q) => sum + (q.points || 5), 0);
  }
  next();
});

module.exports = mongoose.model('EnglishListeningQuestion', englishListeningQuestionSchema);
