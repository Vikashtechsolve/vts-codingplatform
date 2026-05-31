const mongoose = require('mongoose');

const rubricSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  weight: {
    type: Number,
    default: 1
  }
}, { _id: false });

const interviewQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  interviewType: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  expectedAnswer: {
    type: String,
    default: ''
  },
  rubrics: [rubricSchema],
  followUpHints: [{
    type: String,
    default: ''
  }],
  tags: [{
    type: String,
    trim: true
  }],
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

module.exports = mongoose.model('InterviewQuestion', interviewQuestionSchema);
