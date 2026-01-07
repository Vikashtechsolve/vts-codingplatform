const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Test',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  timeSpent: Number, // in seconds
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    questionType: {
      type: String,
      enum: ['coding', 'mcq'],
      required: true
    },
    answer: mongoose.Schema.Types.Mixed, // Can be code or selected option
    language: String, // For coding questions
    testCasesPassed: Number,
    totalTestCases: Number,
    isCorrect: Boolean,
    points: Number,
    maxPoints: Number
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'timeout'],
    default: 'in_progress'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Result', resultSchema);

