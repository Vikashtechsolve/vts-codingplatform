const mongoose = require('mongoose');

const evaluationJobSchema = new mongoose.Schema({
  // Reference
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSubmission',
    required: true,
    unique: true
  },
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
  
  // Job Status
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed', 'timeout'],
    default: 'queued'
  },
  priority: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  
  // Processing Timeline
  queuedAt: {
    type: Date,
    default: Date.now
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  
  // Processing Steps Progress
  processingSteps: {
    repoCloning: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
      },
      startedAt: Date,
      completedAt: Date,
      error: String
    },
    repoAnalysis: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
      },
      startedAt: Date,
      completedAt: Date,
      error: String
    },
    aiEvaluation: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
      },
      startedAt: Date,
      completedAt: Date,
      error: String,
      tokensUsed: Number,
      cost: Number
    },
    scoring: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
      },
      startedAt: Date,
      completedAt: Date,
      error: String
    }
  },
  
  // Error Handling
  error: {
    type: String
  },
  errorDetails: {
    type: mongoose.Schema.Types.Mixed
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Resource Usage
  executionTime: {
    type: Number // in seconds
  },
  memoryUsed: {
    type: Number // in MB
  },
  
  // Worker Information
  workerId: String,
  workerHost: String,
  
  // Result Reference
  evaluationResultId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationResult'
  }
}, {
  timestamps: true
});

// Indexes for job queue management
evaluationJobSchema.index({ status: 1, priority: -1, queuedAt: 1 });
evaluationJobSchema.index({ submissionId: 1 });
evaluationJobSchema.index({ assignmentId: 1, status: 1 });
evaluationJobSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('EvaluationJob', evaluationJobSchema);
