const mongoose = require('mongoose');

const practiceSubmissionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CodingQuestion',
      required: true,
      index: true,
    },
    code: { type: String, required: true },
    language: {
      type: String,
      enum: ['java', 'cpp', 'c', 'python'],
      required: true,
    },
    status: {
      type: String,
      enum: ['accepted', 'wrong_answer', 'runtime_error', 'compile_error', 'timeout'],
      required: true,
    },
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    timeSpentMs: { type: Number, default: 0 },
    attemptNumber: { type: Number, default: 1 },
    isFirstSolve: { type: Boolean, default: false },
    source: {
      type: String,
      enum: ['practice', 'test_backfill'],
      default: 'practice',
    },
    submittedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

practiceSubmissionSchema.index({ studentId: 1, questionId: 1, submittedAt: -1 });
practiceSubmissionSchema.index({ studentId: 1, status: 1, submittedAt: -1 });

module.exports = mongoose.model('PracticeSubmission', practiceSubmissionSchema);
