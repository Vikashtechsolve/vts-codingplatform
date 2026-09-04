const mongoose = require('mongoose');

const courseVendorAllocationSchema = new mongoose.Schema(
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
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    allocatedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true, index: true },
    dueAt: { type: Date, default: null },
    visibility: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
    },
  },
  { timestamps: true }
);

courseVendorAllocationSchema.index({ courseId: 1, vendorId: 1 }, { unique: true });
courseVendorAllocationSchema.index({ vendorId: 1, isActive: 1 });

module.exports = mongoose.model('CourseVendorAllocation', courseVendorAllocationSchema);
