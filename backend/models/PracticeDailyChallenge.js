const mongoose = require('mongoose');

const practiceDailyChallengeSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, index: true },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodingQuestion',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PracticeDailyChallenge', practiceDailyChallengeSchema);
