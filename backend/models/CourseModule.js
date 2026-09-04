const mongoose = require('mongoose');

const courseModuleSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    order: { type: Number, required: true, min: 0 },
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      default: null,
    },
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
    },
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      default: null,
    },
    systemDesignProblemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SystemDesignProblem',
      default: null,
    },
    lectureOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CourseLecture' }],
  },
  { timestamps: true }
);

courseModuleSchema.index({ courseId: 1, order: 1 });
// Reverse lookups: "which modules link this assessment?" (student access checks)
courseModuleSchema.index({ testId: 1 }, { sparse: true });
courseModuleSchema.index({ interviewId: 1 }, { sparse: true });
courseModuleSchema.index({ assignmentId: 1 }, { sparse: true });
courseModuleSchema.index({ systemDesignProblemId: 1 }, { sparse: true });

module.exports = mongoose.model('CourseModule', courseModuleSchema);
