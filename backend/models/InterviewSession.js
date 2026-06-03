const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewQuestion',
    default: null
  },
  questionText: {
    type: String,
    required: true
  },
  transcript: {
    type: String,
    default: ''
  },
  evaluation: {
    correctness: Number,
    depth: Number,
    structure: Number,
    confidence: Number,
    relevance: Number,
    overall: Number,
    strengths: [String],
    weaknesses: [String],
    feedback: String,
    resources: [String]
  },
  isFollowUp: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema({
  interviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
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
  interviewType: String,
  topic: String,
  difficulty: String,
  startedAt: {
    type: Date,
    default: Date.now
  },
  submittedAt: Date,
  timeSpent: Number,
  answers: [answerSchema],
  currentQuestion: {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewQuestion',
      default: null
    },
    questionText: {
      type: String,
      default: ''
    },
    spokenText: {
      type: String,
      default: ''
    },
    acknowledgment: {
      type: String,
      default: ''
    },
    isFollowUp: {
      type: Boolean,
      default: false
    }
  },
  questionQueue: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewQuestion',
      default: null
    },
    questionText: String,
    spokenText: String,
    acknowledgment: String,
    isFollowUp: {
      type: Boolean,
      default: false
    }
  }],
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'timeout'],
    default: 'in_progress'
  },
  overallScore: {
    type: Number,
    default: 0
  },
  readinessPercent: {
    type: Number,
    default: 0
  },
  finalFeedback: {
    strengths: [String],
    improvements: [String],
    summary: String,
    readinessLabel: String,
    focusAreas: [String]
  },
  creditCharged: {
    type: Boolean,
    default: false
  },
  creditChargedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
