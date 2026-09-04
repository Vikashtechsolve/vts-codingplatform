const mongoose = require('mongoose');

const assignmentVendorAllocationSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
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

assignmentVendorAllocationSchema.index({ assignmentId: 1, vendorId: 1 }, { unique: true });
assignmentVendorAllocationSchema.index({ vendorId: 1, isActive: 1 });

module.exports = mongoose.model('AssignmentVendorAllocation', assignmentVendorAllocationSchema);
