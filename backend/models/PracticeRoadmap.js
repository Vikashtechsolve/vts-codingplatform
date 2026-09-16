const mongoose = require('mongoose');

const practiceRoadmapSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    steps: [
      {
        topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTopic' },
        questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' }],
        order: { type: Number, default: 0 },
      },
    ],
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PracticeRoadmap', practiceRoadmapSchema);
