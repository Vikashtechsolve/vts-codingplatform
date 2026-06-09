const mongoose = require('mongoose');
const crypto = require('crypto');

const contestSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  assessmentType: {
    type: String,
    enum: ['test', 'interview', 'assignment', 'system_design'],
    required: true,
  },
  assessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'ended'],
    default: 'draft',
  },
  registrationOpensAt: {
    type: Date,
    default: null,
  },
  registrationClosesAt: {
    type: Date,
    default: null,
  },
  attemptWindowStart: {
    type: Date,
    required: true,
  },
  attemptWindowEnd: {
    type: Date,
    required: true,
  },
  settings: {
    maxParticipants: {
      type: Number,
      default: null,
    },
    collectPhone: {
      type: Boolean,
      default: false,
    },
    collectCollege: {
      type: Boolean,
      default: false,
    },
    collectRollNumber: {
      type: Boolean,
      default: false,
    },
    showLeaderboard: {
      type: Boolean,
      default: false,
    },
    allowRetakes: {
      type: Boolean,
      default: false,
    },
  },
}, {
  timestamps: true,
});

contestSchema.statics.generateSlug = function generateSlug() {
  return crypto.randomBytes(16).toString('hex');
};

module.exports = mongoose.model('Contest', contestSchema);
