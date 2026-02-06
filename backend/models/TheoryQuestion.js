const mongoose = require('mongoose');

const theoryQuestionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: true,
    trim: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  maxMarks: {
    type: Number,
    default: 10
  },
  expectedAnswerLength: {
    type: Number,
    default: 150
  },
  referenceAnswer: {
    type: String,
    required: true
  },
  keywords: [{
    type: String,
    trim: true
  }],
  evaluationRubric: {
    type: String,
    trim: true
  },
  evaluationConfig: {
    similarityWeight: { type: Number, default: 0.5 },
    conceptWeight: { type: Number, default: 0.3 },
    depthWeight: { type: Number, default: 0.2 },
    strictness: { type: String, enum: ['strict', 'moderate', 'lenient'], default: 'moderate' }
  },
  tags: [{
    type: String,
    trim: true
  }],
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
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

module.exports = mongoose.model('TheoryQuestion', theoryQuestionSchema);

