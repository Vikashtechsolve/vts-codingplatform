const mongoose = require('mongoose');

const systemDesignVendorAllocationSchema = new mongoose.Schema(
  {
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SystemDesignProblem',
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

systemDesignVendorAllocationSchema.index({ problemId: 1, vendorId: 1 }, { unique: true });
systemDesignVendorAllocationSchema.index({ vendorId: 1, isActive: 1 });

module.exports = mongoose.model('SystemDesignVendorAllocation', systemDesignVendorAllocationSchema);
