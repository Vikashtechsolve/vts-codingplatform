const InterviewVendorAllocation = require('../models/InterviewVendorAllocation');
const AssignmentVendorAllocation = require('../models/AssignmentVendorAllocation');
const SystemDesignVendorAllocation = require('../models/SystemDesignVendorAllocation');

async function getAllocatedIds(AllocationModel, resourceField, vendorId) {
  const rows = await AllocationModel.find({ vendorId, isActive: true })
    .select(resourceField)
    .lean();
  return rows.map((row) => row[resourceField]);
}

function canVendorAccessResource(resource, vendorId) {
  if (!resource || !vendorId) return false;
  if (resource.source !== 'platform') {
    return resource.vendorId && String(resource.vendorId) === String(vendorId);
  }
  return false;
}

async function canVendorAccessInterview(interview, vendorId) {
  if (!interview || !vendorId) return false;
  if (interview.source !== 'platform') {
    return interview.vendorId && String(interview.vendorId) === String(vendorId);
  }
  const doc = await InterviewVendorAllocation.findOne({
    interviewId: interview._id,
    vendorId,
    isActive: true,
  }).select('_id');
  return !!doc;
}

async function canVendorAccessAssignment(assignment, vendorId) {
  if (!assignment || !vendorId) return false;
  if (assignment.source !== 'platform') {
    return assignment.vendorId && String(assignment.vendorId) === String(vendorId);
  }
  const doc = await AssignmentVendorAllocation.findOne({
    assignmentId: assignment._id,
    vendorId,
    isActive: true,
  }).select('_id');
  return !!doc;
}

async function canVendorAccessSystemDesign(problem, vendorId) {
  if (!problem || !vendorId) return false;
  if (problem.source !== 'platform') {
    return problem.vendorId && String(problem.vendorId) === String(vendorId);
  }
  const doc = await SystemDesignVendorAllocation.findOne({
    problemId: problem._id,
    vendorId,
    isActive: true,
  }).select('_id');
  return !!doc;
}

async function getAllocatedPlatformInterviewIds(vendorId) {
  return getAllocatedIds(InterviewVendorAllocation, 'interviewId', vendorId);
}

async function getAllocatedPlatformAssignmentIds(vendorId) {
  return getAllocatedIds(AssignmentVendorAllocation, 'assignmentId', vendorId);
}

async function getAllocatedPlatformSystemDesignIds(vendorId) {
  return getAllocatedIds(SystemDesignVendorAllocation, 'problemId', vendorId);
}

function vendorOwnedOrAllocatedFilter(vendorId, allocatedIds) {
  return {
    $or: [{ vendorId }, { _id: { $in: allocatedIds }, source: 'platform' }],
  };
}

module.exports = {
  canVendorAccessResource,
  canVendorAccessInterview,
  canVendorAccessAssignment,
  canVendorAccessSystemDesign,
  getAllocatedPlatformInterviewIds,
  getAllocatedPlatformAssignmentIds,
  getAllocatedPlatformSystemDesignIds,
  vendorOwnedOrAllocatedFilter,
};
