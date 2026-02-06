const mongoose = require('mongoose');

const aptitudeQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  caseStudy: {
    type: String,
    default: ''
  },
  questionType: {
    type: String,
    enum: ['single', 'multi', 'numeric', 'case_study'],
    required: true
  },
  options: [{
    text: {
      type: String,
      required: true
    }
  }],
  correctOptions: [{
    type: Number
  }],
  numericAnswer: {
    type: Number,
    default: null
  },
  numericTolerance: {
    type: Number,
    default: 0
  },
  section: {
    type: String,
    enum: ['quantitative', 'logical', 'analytical'],
    required: true
  },
  subCategory: {
    type: String,
    default: ''
  },
  explanation: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
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

module.exports = mongoose.model('AptitudeQuestion', aptitudeQuestionSchema);

