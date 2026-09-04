const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
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
    default: null,
  },
  /** vendor = vendor-owned; platform = super admin, visible to vendors only when allocated */
  source: {
    type: String,
    enum: ['vendor', 'platform'],
    default: 'vendor',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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
  duration: {
    type: Number, // minutes
    required: true
  },
  questionCount: {
    type: Number,
    default: 6
  },
  questions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewQuestion'
    },
    order: {
      type: Number
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
    allowFollowUps: {
      type: Boolean,
      default: true
    },
    maxFollowUps: {
      type: Number,
      default: 6
    },
    autoSubmitAtWindowEnd: {
      type: Boolean,
      default: true
    },
    adaptiveDifficulty: {
      type: Boolean,
      default: true
    },
    minQuestions: {
      type: Number,
      default: 6
    },
    maxQuestions: {
      type: Number,
      default: 8
    }
  }
}, {
  timestamps: true
});

interviewSchema.pre('validate', function validateInterviewVendor(next) {
  if (this.source === 'platform') {
    if (this.vendorId) {
      return next(new Error('platform interviews cannot have vendorId'));
    }
    return next();
  }
  if (!this.vendorId) {
    return next(new Error('vendorId is required for vendor interviews'));
  }
  return next();
});

interviewSchema.index({ source: 1, isActive: 1 });

module.exports = mongoose.model('Interview', interviewSchema);
