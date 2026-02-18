const mongoose = require('mongoose');

const hintSchema = new mongoose.Schema({
  text: { type: String, required: true },
  penaltyPercent: { type: Number, default: 5, min: 0, max: 50 }
}, { _id: false });

const systemDesignProblemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  problemStatement: {
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
    enum: [
      'url_shortener', 'chat_system', 'ecommerce', 'social_media',
      'streaming', 'payment_system', 'notification_system', 'file_storage',
      'search_engine', 'rate_limiter', 'ride_sharing', 'food_delivery',
      'library_management', 'parking_lot', 'hotel_booking', 'custom'
    ],
    required: true
  },
  constraints: {
    estimatedUsers: { type: String, default: '' },
    estimatedQPS: { type: String, default: '' },
    storageNeeds: { type: String, default: '' },
    latencyRequirement: { type: String, default: '' },
    availabilityTarget: { type: String, default: '' }
  },
  businessContext: {
    type: String,
    default: ''
  },
  duration: {
    type: Number,
    required: true,
    default: 90,
    min: 15,
    max: 300
  },

  sectionWeights: {
    requirements: { type: Number, default: 10 },
    capacityEstimation: { type: Number, default: 10 },
    coreEntities: { type: Number, default: 8 },
    apiDesign: { type: Number, default: 10 },
    architecture: { type: Number, default: 18 },
    dataFlow: { type: Number, default: 8 },
    databaseDesign: { type: Number, default: 12 },
    scalingStrategy: { type: Number, default: 10 },
    deepDive: { type: Number, default: 7 },
    tradeoffs: { type: Number, default: 7 }
  },

  referenceAnswer: {
    requirements: { type: mongoose.Schema.Types.Mixed, default: null },
    capacityEstimation: { type: mongoose.Schema.Types.Mixed, default: null },
    coreEntities: { type: mongoose.Schema.Types.Mixed, default: null },
    apiDesign: { type: mongoose.Schema.Types.Mixed, default: null },
    architecture: { type: mongoose.Schema.Types.Mixed, default: null },
    dataFlow: { type: mongoose.Schema.Types.Mixed, default: null },
    databaseDesign: { type: mongoose.Schema.Types.Mixed, default: null },
    scalingStrategy: { type: mongoose.Schema.Types.Mixed, default: null },
    deepDive: { type: mongoose.Schema.Types.Mixed, default: null },
    tradeoffs: { type: mongoose.Schema.Types.Mixed, default: null }
  },

  dataFlowScenarios: [{
    type: String,
    trim: true
  }],

  deepDiveOptions: [{
    type: String,
    trim: true
  }],

  hints: {
    requirements: [hintSchema],
    capacityEstimation: [hintSchema],
    coreEntities: [hintSchema],
    apiDesign: [hintSchema],
    architecture: [hintSchema],
    dataFlow: [hintSchema],
    databaseDesign: [hintSchema],
    scalingStrategy: [hintSchema],
    deepDive: [hintSchema],
    tradeoffs: [hintSchema]
  },

  architectureTemplates: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    diagramData: { type: mongoose.Schema.Types.Mixed }
  }],

  validationRules: {
    requireLoadBalancer: { type: Boolean, default: true },
    requireCache: { type: Boolean, default: false },
    requireMessageQueue: { type: Boolean, default: false },
    requireCDN: { type: Boolean, default: false },
    requireDatabase: { type: Boolean, default: true },
    requireAPIGateway: { type: Boolean, default: false },
    customRules: [{ type: String }]
  },

  evaluationConfig: {
    strictness: {
      type: String,
      enum: ['strict', 'moderate', 'lenient'],
      default: 'moderate'
    },
    model: {
      type: String,
      default: ''
    },
    enableFollowUp: {
      type: Boolean,
      default: true
    },
    followUpCount: {
      type: Number,
      default: 3,
      min: 1,
      max: 5
    }
  },

  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isGlobal: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  assignedClassrooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classroom'
  }],
  startDate: Date,
  endDate: Date,

  totalAssigned: { type: Number, default: 0 },
  totalSubmitted: { type: Number, default: 0 },
  totalEvaluated: { type: Number, default: 0 }
}, {
  timestamps: true
});

systemDesignProblemSchema.index({ vendorId: 1, isActive: 1 });
systemDesignProblemSchema.index({ category: 1, difficulty: 1 });
systemDesignProblemSchema.index({ createdBy: 1 });
systemDesignProblemSchema.index({ assignedTo: 1 });
systemDesignProblemSchema.index({ assignedClassrooms: 1 });

module.exports = mongoose.model('SystemDesignProblem', systemDesignProblemSchema);
