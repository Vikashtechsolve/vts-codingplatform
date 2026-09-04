const mongoose = require('mongoose');

const watchedIntervalSchema = new mongoose.Schema(
  {
    start: { type: Number, required: true, min: 0 },
    end: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const lectureProgressSchema = new mongoose.Schema(
  {
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseLecture',
      required: true,
    },
    watchedSecondsUnique: { type: Number, default: 0, min: 0 },
    maxPosition: { type: Number, default: 0, min: 0 },
    reportedDurationSec: { type: Number, default: 0, min: 0 },
    intervals: { type: [watchedIntervalSchema], default: [] },
    notesOpened: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const moduleProgressSchema = new mongoose.Schema(
  {
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseModule',
      required: true,
    },
    lecturesCompleted: { type: Number, default: 0, min: 0 },
    quizStatus: {
      type: String,
      enum: ['none', 'locked', 'available', 'submitted'],
      default: 'none',
    },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Result',
      default: null,
    },
    assessmentType: {
      type: String,
      enum: ['test', 'interview', 'assignment', 'system_design', null],
      default: null,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    latestResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Result',
      default: null,
    },
    quizAttemptCount: { type: Number, default: 0, min: 0 },
    quizScore: { type: Number, default: null },
    quizMaxScore: { type: Number, default: null },
    quizPercentage: { type: Number, default: null },
    submittedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const courseProgressSchema = new mongoose.Schema(
  {
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseEnrollment',
      required: true,
      unique: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
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
    currentModuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseModule',
      default: null,
    },
    percentComplete: { type: Number, default: 0, min: 0, max: 100 },
    lectures: { type: [lectureProgressSchema], default: [] },
    modules: { type: [moduleProgressSchema], default: [] },
    completedAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null },
  },
  { timestamps: true }
);

courseProgressSchema.index({ courseId: 1, studentId: 1 });
courseProgressSchema.index({ vendorId: 1, courseId: 1 });

module.exports = mongoose.model('CourseProgress', courseProgressSchema);
