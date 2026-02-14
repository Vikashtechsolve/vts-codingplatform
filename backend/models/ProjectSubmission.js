const mongoose = require('mongoose');

const projectSubmissionSchema = new mongoose.Schema({
  // Reference
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
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
  
  // Submission Details
  githubRepoUrl: {
    type: String,
    required: true,
    trim: true
  },
  branchName: {
    type: String,
    default: 'main',
    trim: true
  },
  liveUrl: {
    type: String,
    trim: true
  },
  
  // Timing Information
  assignedAt: {
    type: Date,
    required: true
  },
  startedAt: {
    type: Date
  },
  submittedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  deadline: {
    type: Date,
    required: true
  },
  
  // Submission Status
  status: {
    type: String,
    enum: ['pending_evaluation', 'evaluating', 'evaluated', 'failed', 'late_submission', 'rejected_late'],
    default: 'pending_evaluation'
  },
  isLateSubmission: {
    type: Boolean,
    default: false
  },
  lateSubmissionMinutes: {
    type: Number,
    default: 0
  },
  latePenaltyMarks: {
    type: Number,
    default: 0
  },
  timerEndAt: {
    type: Date
  },
  evaluateAfter: {
    type: Date
  },
  lateCommitsData: [{
    hash: String,
    date: Date,
    message: String,
    author: String,
    minutesAfterTimer: Number
  }],
  
  // Repository Validation Results
  repositoryValidation: {
    isValid: {
      type: Boolean,
      default: false
    },
    errors: [{
      type: String
    }],
    warnings: [{
      type: String
    }],
    branchExists: Boolean,
    hasReadme: Boolean,
    hasEnvExample: Boolean,
    commitCount: Number,
    containsSecrets: Boolean,
    lastCommitAt: Date,
    lastCommitHash: String
  },
  
  // Repository Analysis (extracted before AI evaluation)
  repositoryAnalysis: {
    folderStructure: String,
    detectedTechStack: [{
      type: String
    }],
    fileCount: Number,
    linesOfCode: Number,
    packageFiles: [{
      name: String,
      content: String
    }],
    coreFiles: [{
      path: String,
      content: String,
      size: Number
    }]
  },
  
  // Evaluation Job Reference
  evaluationJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationJob'
  },
  
  // Student Notes (optional)
  studentNotes: {
    type: String,
    trim: true
  },
  
  // Resubmission tracking
  isResubmission: {
    type: Boolean,
    default: false
  },
  previousSubmissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSubmission'
  },
  resubmissionCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
projectSubmissionSchema.index({ assignmentId: 1, studentId: 1 });
projectSubmissionSchema.index({ studentId: 1, status: 1 });
projectSubmissionSchema.index({ vendorId: 1, status: 1 });
projectSubmissionSchema.index({ status: 1, createdAt: 1 });

// Prevent duplicate submissions (one active submission per student per assignment)
projectSubmissionSchema.index(
  { assignmentId: 1, studentId: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      status: { $in: ['pending_evaluation', 'evaluating', 'evaluated'] }
    }
  }
);

module.exports = mongoose.model('ProjectSubmission', projectSubmissionSchema);
