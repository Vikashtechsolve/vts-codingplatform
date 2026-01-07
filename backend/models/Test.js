const mongoose = require('mongoose');

const testSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['coding', 'mcq', 'mixed'],
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  questions: [{
    type: {
      type: String,
      enum: ['coding', 'mcq'],
      required: true
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'questions.questionType'
    },
    questionType: {
      type: String,
      enum: ['CodingQuestion', 'MCQQuestion']
    },
    points: {
      type: Number,
      default: 10
    },
    order: {
      type: Number,
      required: true
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: Date,
  endDate: Date,
  settings: {
    allowMultipleAttempts: {
      type: Boolean,
      default: false
    },
    showResults: {
      type: Boolean,
      default: true
    },
    shuffleQuestions: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Test', testSchema);

