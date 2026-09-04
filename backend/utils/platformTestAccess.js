const TestVendorAllocation = require('../models/TestVendorAllocation');

async function isPlatformTestAllocatedToVendor(testId, vendorId) {
  if (!testId || !vendorId) return false;
  const doc = await TestVendorAllocation.findOne({
    testId,
    vendorId,
    isActive: true,
  }).select('_id');
  return !!doc;
}

async function canVendorAccessTest(test, vendorId) {
  if (!test || !vendorId) return false;
  if (test.source !== 'platform') {
    return test.vendorId && String(test.vendorId) === String(vendorId);
  }
  return isPlatformTestAllocatedToVendor(test._id, vendorId);
}

async function getAllocatedPlatformTestIds(vendorId) {
  const rows = await TestVendorAllocation.find({
    vendorId,
    isActive: true,
  })
    .select('testId')
    .lean();
  return rows.map((row) => row.testId);
}

module.exports = {
  isPlatformTestAllocatedToVendor,
  canVendorAccessTest,
  getAllocatedPlatformTestIds,
};
