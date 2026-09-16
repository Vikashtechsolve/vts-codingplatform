const mongoose = require('mongoose');

const practiceTopicSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['fundamentals', 'intermediate', 'advanced'],
      default: 'fundamentals',
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

practiceTopicSchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('PracticeTopic', practiceTopicSchema);
