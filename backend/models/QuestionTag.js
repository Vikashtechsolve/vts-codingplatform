const mongoose = require('mongoose');

const questionTagSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
      index: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    label: {
      type: String,
      required: true,
      trim: true
    },
    usageCount: {
      type: Number,
      default: 1
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

questionTagSchema.index({ vendorId: 1, slug: 1 }, { unique: true });
questionTagSchema.index({ vendorId: 1, usageCount: -1, label: 1 });

module.exports = mongoose.model('QuestionTag', questionTagSchema);
