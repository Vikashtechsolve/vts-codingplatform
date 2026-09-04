const mongoose = require('mongoose');

const testVendorAllocationSchema = new mongoose.Schema(
  {
    testId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
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

testVendorAllocationSchema.index({ testId: 1, vendorId: 1 }, { unique: true });
testVendorAllocationSchema.index({ vendorId: 1, isActive: 1 });

module.exports = mongoose.model('TestVendorAllocation', testVendorAllocationSchema);
