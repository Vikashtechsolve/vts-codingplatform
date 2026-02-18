const mongoose = require('mongoose');

const systemDesignSubmissionSchema = new mongoose.Schema({
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SystemDesignProblem',
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
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'submitted', 'evaluating', 'follow_up', 'evaluated'],
    default: 'not_started'
  },
  startedAt: Date,
  submittedAt: Date,
  timeSpent: { type: Number, default: 0 },
  currentStep: { type: Number, default: 0, min: 0, max: 11 },

  sectionTimeSpent: {
    requirements: { type: Number, default: 0 },
    capacityEstimation: { type: Number, default: 0 },
    coreEntities: { type: Number, default: 0 },
    apiDesign: { type: Number, default: 0 },
    architecture: { type: Number, default: 0 },
    dataFlow: { type: Number, default: 0 },
    databaseDesign: { type: Number, default: 0 },
    scalingStrategy: { type: Number, default: 0 },
    deepDive: { type: Number, default: 0 },
    tradeoffs: { type: Number, default: 0 }
  },

  hintsUsed: [{
    section: { type: String, required: true },
    hintIndex: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  }],

  sections: {
    requirements: {
      functional: [{
        id: String,
        text: String
      }],
      nonFunctional: {
        scalability: { type: String, default: '' },
        availability: { type: String, default: '' },
        consistency: { type: String, default: '' },
        latency: { type: String, default: '' }
      }
    },
    capacityEstimation: {
      estimatedQPS: { type: String, default: '' },
      readWriteRatio: { type: String, default: '' },
      storageEstimate: { type: String, default: '' },
      bandwidthEstimate: { type: String, default: '' },
      memoryEstimate: { type: String, default: '' },
      calculations: { type: String, default: '' }
    },
    coreEntities: [{
      name: { type: String, default: '' },
      fields: [{
        name: { type: String, default: '' },
        type: { type: String, default: '' }
      }],
      relationships: { type: String, default: '' },
      notes: { type: String, default: '' }
    }],
    apiDesign: [{
      method: { type: String, default: 'GET' },
      endpoint: { type: String, default: '' },
      requestBody: { type: String, default: '' },
      responseBody: { type: String, default: '' },
      description: { type: String, default: '' },
      authRequired: { type: Boolean, default: false }
    }],
    architecture: {
      diagramData: { type: mongoose.Schema.Types.Mixed, default: null },
      textExplanation: { type: String, default: '' },
      components: [String],
      templateUsed: { type: String, default: '' }
    },
    dataFlow: [{
      scenario: { type: String, default: '' },
      steps: [{
        order: { type: Number },
        description: { type: String, default: '' }
      }]
    }],
    databaseDesign: [{
      entity: { type: String, default: '' },
      dbType: { type: String, default: '' },
      justification: { type: String, default: '' },
      schema: { type: String, default: '' },
      indexing: { type: String, default: '' },
      partitioning: { type: String, default: '' },
      replication: { type: String, default: '' }
    }],
    scalingStrategy: {
      strategies: [{
        name: { type: String, default: '' },
        selected: { type: Boolean, default: false },
        explanation: { type: String, default: '' }
      }],
      additionalNotes: { type: String, default: '' }
    },
    deepDive: {
      topic: { type: String, default: '' },
      explanation: { type: String, default: '' }
    },
    tradeoffs: [{
      decision: { type: String, default: '' },
      optionChosen: { type: String, default: '' },
      optionRejected: { type: String, default: '' },
      reasoning: { type: String, default: '' }
    }]
  },

  followUpQuestions: [{
    question: { type: String, required: true },
    answer: { type: String, default: '' },
    score: { type: Number, default: 0 },
    feedback: { type: String, default: '' },
    answeredAt: Date
  }],

  architectureWarnings: [{
    type_name: { type: String },
    message: { type: String },
    dismissed: { type: Boolean, default: false }
  }],

  evaluation: {
    requirements: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    capacityEstimation: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    coreEntities: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    apiDesign: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    architecture: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    dataFlow: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    databaseDesign: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    scalingStrategy: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    deepDive: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    tradeoffs: {
      score: { type: Number, default: 0 },
      maxScore: { type: Number, default: 10 },
      feedback: { type: String, default: '' },
      strengths: [String],
      improvements: [String],
      missingConcepts: [String]
    },
    followUpScore: { type: Number, default: 0 },
    hintPenalty: { type: Number, default: 0 },
    overallFeedback: { type: String, default: '' },
    skillRadar: {
      requirements: { type: Number, default: 0 },
      estimation: { type: Number, default: 0 },
      modeling: { type: Number, default: 0 },
      apiDesign: { type: Number, default: 0 },
      architecture: { type: Number, default: 0 },
      databases: { type: Number, default: 0 },
      scaling: { type: Number, default: 0 },
      tradeoffs: { type: Number, default: 0 }
    }
  },

  totalScore: { type: Number, default: 0 },
  maxScore: { type: Number, default: 100 },
  percentage: { type: Number, default: 0 },

  violations: [{
    type: {
      type: String,
      enum: ['tab_switch', 'window_blur', 'copy_paste', 'shortcut_key', 'fullscreen_exit', 'multiple_screens', 'screen_share', 'remote_access'],
      required: true
    },
    timestamp: { type: Date, default: Date.now },
    details: String
  }],
  violationCount: { type: Number, default: 0 },
  autoSubmitted: { type: Boolean, default: false },

  manualOverride: {
    isManual: { type: Boolean, default: false },
    overrides: [{
      section: String,
      score: Number,
      feedback: String
    }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: Date
  }
}, {
  timestamps: true
});

systemDesignSubmissionSchema.index({ problemId: 1, studentId: 1 }, { unique: true });
systemDesignSubmissionSchema.index({ studentId: 1, status: 1 });
systemDesignSubmissionSchema.index({ vendorId: 1, problemId: 1 });
systemDesignSubmissionSchema.index({ status: 1 });

module.exports = mongoose.model('SystemDesignSubmission', systemDesignSubmissionSchema);
