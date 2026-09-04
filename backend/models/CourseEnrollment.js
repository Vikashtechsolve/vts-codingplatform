const mongoose = require('mongoose');

const courseEnrollmentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['classroom', 'individual'],
      required: true,
    },
    classroomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classroom',
      default: null,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['active', 'revoked'],
      default: 'active',
      index: true,
    },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true }
);

courseEnrollmentSchema.index(
  { courseId: 1, studentId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
courseEnrollmentSchema.index({ vendorId: 1, status: 1, assignedAt: -1 });
courseEnrollmentSchema.index({ studentId: 1, status: 1 });

module.exports = mongoose.model('CourseEnrollment', courseEnrollmentSchema);
