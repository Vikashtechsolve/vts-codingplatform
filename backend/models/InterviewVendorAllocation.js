const mongoose = require('mongoose');

const interviewVendorAllocationSchema = new mongoose.Schema(
  {
    interviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
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
  },
  { timestamps: true }
);

interviewVendorAllocationSchema.index({ interviewId: 1, vendorId: 1 }, { unique: true });
interviewVendorAllocationSchema.index({ vendorId: 1, isActive: 1 });

module.exports = mongoose.model('InterviewVendorAllocation', interviewVendorAllocationSchema);
