const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  // Basic Details
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
    required: true
  },
  category: {
    type: String,
    enum: ['frontend', 'backend', 'fullstack', 'mobile', 'devops', 'data-science'],
    required: true
  },
  
  // Tech Stack
  allowedTechStack: [{
    type: String,
    trim: true
  }],
  
  // Timing
  deadline: {
    type: Date,
    required: function deadlineRequired() {
      return this.source !== 'platform';
    },
  },
  duration: {
    type: Number, // in minutes
    required: true
  },
  
  // Scoring
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Feature Checklist - VERY IMPORTANT for AI evaluation
  featureChecklist: [{
    feature: {
      type: String,
      required: true
    },
    marks: {
      type: Number,
      required: true,
      min: 0
    },
    required: {
      type: Boolean,
      default: false
    },
    description: String
  }],
  
  // Evaluation Criteria Weights
  evaluationWeights: {
    featureCompletion: {
      type: Number,
      default: 40,
      min: 0,
      max: 100
    },
    codeQuality: {
      type: Number,
      default: 20,
      min: 0,
      max: 100
    },
    architecture: {
      type: Number,
      default: 15,
      min: 0,
      max: 100
    },
    security: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    gitPractices: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    documentation: {
      type: Number,
      default: 5,
      min: 0,
      max: 100
    }
  },
  
  // Repository Rules
  repositoryRules: {
    requiredBranch: {
      type: String,
      default: 'main'
    },
    mustIncludeReadme: {
      type: Boolean,
      default: true
    },
    mustIncludeEnvExample: {
      type: Boolean,
      default: true
    },
    mustNotContainSecrets: {
      type: Boolean,
      default: true
    },
    minimumCommits: {
      type: Number,
      default: 5,
      min: 1
    },
    requireDeploymentUrl: {
      type: Boolean,
      default: false
    }
  },
  
  // Additional Instructions
  additionalInstructions: {
    type: String,
    default: ''
  },
  
  // Assignment Metadata
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
  status: {
    type: String,
    enum: ['draft', 'active', 'archived'],
    default: 'draft'
  },
  
  // Assignment Type
  assignmentType: {
    type: String,
    enum: ['individual', 'batch', 'classroom', 'public'],
    default: 'individual'
  },
  
  // Statistics
  totalAssigned: {
    type: Number,
    default: 0
  },
  totalSubmitted: {
    type: Number,
    default: 0
  },
  totalEvaluated: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
assignmentSchema.index({ vendorId: 1, status: 1 });
assignmentSchema.index({ source: 1, status: 1 });
assignmentSchema.index({ createdBy: 1 });
assignmentSchema.index({ deadline: 1 });

assignmentSchema.pre('validate', function validateAssignmentVendor(next) {
  if (this.source === 'platform') {
    if (this.vendorId) {
      return next(new Error('platform assignments cannot have vendorId'));
    }
    return next();
  }
  if (!this.vendorId) {
    return next(new Error('vendorId is required for vendor assignments'));
  }
  return next();
});

module.exports = mongoose.model('Assignment', assignmentSchema);
