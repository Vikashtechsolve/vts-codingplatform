const mongoose = require('mongoose');

const topicMasterySchema = new mongoose.Schema(
  {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTopic' },
    slug: String,
    label: String,
    solved: { type: Number, default: 0 },
    attempted: { type: Number, default: 0 },
    masteryScore: { type: Number, default: 0 },
    strength: {
      type: String,
      enum: ['weak', 'developing', 'strong', 'mastered'],
      default: 'weak',
    },
    lastAttemptAt: Date,
  },
  { _id: false }
);

const studentPracticeProfileSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    codingScore: { type: Number, default: 0, index: true },
    problemsSolved: { type: Number, default: 0 },
    problemsAttempted: { type: Number, default: 0 },
    successRate: { type: Number, default: 0 },
    totalCodingTimeMs: { type: Number, default: 0 },
    avgSolveTimeMs: { type: Number, default: 0 },
    difficulty: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 },
    },
    topicMastery: [topicMasterySchema],
    solvedQuestionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' }],
    attemptedQuestionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' }],
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastPracticeDate: { type: String, default: null },
    },
    dailyGoal: {
      target: { type: Number, default: 2 },
      completedToday: { type: Number, default: 0 },
      date: { type: String, default: null },
    },
    weeklyProgress: [
      {
        date: String,
        solved: { type: Number, default: 0 },
        attempted: { type: Number, default: 0 },
        timeMs: { type: Number, default: 0 },
      },
    ],
    recentSubmissions: [
      {
        submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PracticeSubmission' },
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingQuestion' },
        title: String,
        status: String,
        submittedAt: Date,
      },
    ],
    weakTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTopic' }],
    strongTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PracticeTopic' }],
  },
  { timestamps: true }
);

studentPracticeProfileSchema.index({ vendorId: 1, codingScore: -1 });

module.exports = mongoose.model('StudentPracticeProfile', studentPracticeProfileSchema);
