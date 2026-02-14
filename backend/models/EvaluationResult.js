const mongoose = require('mongoose');

const evaluationResultSchema = new mongoose.Schema({
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
  evaluationJobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EvaluationJob',
    required: true
  },
  
  // Overall Scores
  totalScore: {
    type: Number,
    required: true,
    min: 0
  },
  totalPossibleScore: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
    required: true
  },
  
  // Category-wise Scores
  categoryScores: {
    featureCompletion: {
      score: Number,
      maxScore: Number,
      percentage: Number
    },
    codeQuality: {
      score: Number,
      maxScore: Number,
      percentage: Number
    },
    architecture: {
      score: Number,
      maxScore: Number,
      percentage: Number
    },
    security: {
      score: Number,
      maxScore: Number,
      percentage: Number
    },
    gitPractices: {
      score: Number,
      maxScore: Number,
      percentage: Number
    },
    documentation: {
      score: Number,
      maxScore: Number,
      percentage: Number
    }
  },
  
  // Feature-wise Evaluation
  featureEvaluation: [{
    feature: String,
    expectedMarks: Number,
    scoredMarks: Number,
    status: {
      type: String,
      enum: ['implemented', 'partial', 'missing', 'error']
    },
    aiAnalysis: String,
    suggestions: [String]
  }],
  
  // AI Analysis Results
  aiAnalysis: {
    summary: String,
    strengths: [String],
    weaknesses: [String],
    codeQualityIssues: [{
      severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low']
      },
      issue: String,
      location: String,
      suggestion: String
    }],
    securityIssues: [{
      severity: {
        type: String,
        enum: ['critical', 'high', 'medium', 'low']
      },
      issue: String,
      location: String,
      suggestion: String
    }],
    architectureAnalysis: String,
    bestPracticesFollowed: [String],
    bestPracticesViolated: [String]
  },
  
  // Git Practices Analysis
  gitAnalysis: {
    commitQuality: {
      score: Number,
      goodCommits: Number,
      poorCommits: Number,
      examples: [{
        hash: String,
        message: String,
        quality: String,
        feedback: String
      }]
    },
    branchingStrategy: {
      score: Number,
      analysis: String
    },
    commitFrequency: {
      score: Number,
      totalCommits: Number,
      commitsPerDay: Number
    }
  },
  
  // Documentation Quality
  documentationAnalysis: {
    readmeQuality: {
      score: Number,
      hasSetupInstructions: Boolean,
      hasFeatureDescription: Boolean,
      hasUsageExamples: Boolean,
      hasDependencies: Boolean,
      feedback: String
    },
    codeComments: {
      score: Number,
      commentedFunctions: Number,
      totalFunctions: Number,
      quality: String
    }
  },
  
  // Automated Test Results (if applicable)
  automatedTests: {
    executed: Boolean,
    passed: Number,
    failed: Number,
    total: Number,
    testResults: [{
      testName: String,
      status: String,
      error: String
    }]
  },
  
  // Time Analysis
  timeAnalysis: {
    timeSpent: Number, // in minutes
    efficiency: String,
    timeManagement: String
  },

  // Commit & Late Commit Analysis
  commitAnalysis: {
    totalCommits: Number,
    lastCommitAt: Date,
    lastCommitHash: String,
    lastCommitMessage: String,
    timerEndAt: Date,
    hasLateCommits: Boolean,
    minutesLate: Number,
    latePenaltyMarks: Number,
    lateCommits: [{
      hash: String,
      date: Date,
      message: String,
      author: String,
      minutesAfterTimer: Number
    }],
    summary: String
  },
  
  // Overall Feedback
  overallFeedback: {
    summary: String,
    topStrengths: [String],
    areasForImprovement: [String],
    nextSteps: [String],
    recommendedResources: [String]
  },
  
  // Plagiarism Check (future enhancement)
  plagiarismCheck: {
    checked: Boolean,
    score: Number,
    sources: [{
      url: String,
      similarity: Number
    }]
  },
  
  // Evaluation Metadata
  evaluatedAt: {
    type: Date,
    default: Date.now
  },
  evaluationVersion: {
    type: String,
    default: '1.0'
  },
  aiModel: {
    type: String,
    default: 'gpt-4'
  },
  
  // Manual Override (admin can adjust scores)
  manualOverride: {
    enabled: Boolean,
    adjustedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adjustedAt: Date,
    originalScore: Number,
    adjustedScore: Number,
    reason: String
  }
}, {
  timestamps: true
});

// Indexes
evaluationResultSchema.index({ submissionId: 1 });
evaluationResultSchema.index({ assignmentId: 1 });
evaluationResultSchema.index({ studentId: 1 });
evaluationResultSchema.index({ assignmentId: 1, percentage: -1 });

// Calculate grade based on percentage
evaluationResultSchema.pre('save', function(next) {
  if (this.isModified('percentage')) {
    const percent = this.percentage;
    if (percent >= 90) this.grade = 'A+';
    else if (percent >= 85) this.grade = 'A';
    else if (percent >= 80) this.grade = 'B+';
    else if (percent >= 70) this.grade = 'B';
    else if (percent >= 60) this.grade = 'C+';
    else if (percent >= 50) this.grade = 'C';
    else if (percent >= 40) this.grade = 'D';
    else this.grade = 'F';
  }
  next();
});

module.exports = mongoose.model('EvaluationResult', evaluationResultSchema);
