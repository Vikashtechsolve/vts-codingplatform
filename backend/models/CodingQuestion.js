const mongoose = require('mongoose');

const codingQuestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    default: null // null for global questions
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
  allowedLanguages: [{
    type: String,
    enum: ['java', 'cpp', 'c', 'python']
  }],
  testCases: [{
    input: {
      type: String,
      required: true
    },
    expectedOutput: {
      type: String,
      required: true
    },
    isHidden: {
      type: Boolean,
      default: false
    },
    points: {
      type: Number,
      default: 10
    }
  }],
  starterCode: {
    java: String,
    cpp: String,
    c: String,
    python: String
  },
  solution: {
    java: String,
    cpp: String,
    c: String,
    python: String
  },
  constraints: String,
  examples: [{
    input: String,
    output: String,
    explanation: String
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('CodingQuestion', codingQuestionSchema);

