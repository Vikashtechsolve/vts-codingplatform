const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const AssignmentVendorAllocation = require('../models/AssignmentVendorAllocation');
const ProjectSubmission = require('../models/ProjectSubmission');
const Vendor = require('../models/Vendor');

const { parsePagination, isPaginatedRequest, paginatedFind } = require('../utils/pagination');

const router = express.Router();
router.use(auth);
router.use(authorize('super_admin'));

async function getPlatformAssignmentOr404(id, res) {
  const assignment = await Assignment.findOne({ _id: id, source: 'platform' });
  if (!assignment) {
    res.status(404).json({ message: 'Platform assignment not found' });
    return null;
  }
  return assignment;
}

router.get('/', async (req, res) => {
  try {
    const filter = { source: 'platform' };
    if (isPaginatedRequest(req.query)) {
      const { page, limit, search } = parsePagination(req.query, {
        defaultLimit: 20,
        maxLimit: 50,
      });
      const payload = await paginatedFind(Assignment, {
        filter,
        search,
        searchFields: ['title', 'category'],
        select: 'title category difficulty duration totalMarks createdAt',
        page,
        limit,
      });
      return res.json(payload);
    }

    const assignments = await Assignment.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const ids = assignments.map((a) => a._id);
    const counts = await AssignmentVendorAllocation.aggregate([
      { $match: { assignmentId: { $in: ids }, isActive: true } },
      { $group: { _id: '$assignmentId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row.count]));

    res.json(
      assignments.map((item) => ({
        ...item,
        allocatedVendorCount: countMap[String(item._id)] || 0,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', [
  body('title').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('difficulty').isIn(['easy', 'medium', 'hard']),
  body('category').isIn(['frontend', 'backend', 'fullstack', 'mobile', 'devops', 'data-science']),
  body('duration').isInt({ min: 1 }),
  body('totalMarks').isInt({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const assignment = await Assignment.create({
      ...req.body,
      source: 'platform',
      vendorId: null,
      createdBy: req.user._id,
      status: req.body.status || 'active',
    });

    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const assignment = await getPlatformAssignmentOr404(req.params.id, res);
    if (!assignment) return;
    const populated = await Assignment.findById(assignment._id).populate('createdBy', 'name email');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const assignment = await getPlatformAssignmentOr404(req.params.id, res);
    if (!assignment) return;

    const allowed = [
      'title', 'description', 'difficulty', 'category', 'allowedTechStack',
      'duration', 'totalMarks', 'featureChecklist', 'evaluationWeights',
      'repositoryRules', 'additionalInstructions', 'status', 'assignmentType',
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) assignment[key] = req.body[key];
    }
    if (req.body.deadline !== undefined) assignment.deadline = req.body.deadline;

    await assignment.save();
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const assignment = await getPlatformAssignmentOr404(req.params.id, res);
    if (!assignment) return;

    await ProjectSubmission.deleteMany({ assignmentId: assignment._id });
    await AssignmentVendorAllocation.deleteMany({ assignmentId: assignment._id });
    await Assignment.findByIdAndDelete(assignment._id);
    res.json({ message: 'Platform assignment deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/allocations', async (req, res) => {
  try {
    const assignment = await getPlatformAssignmentOr404(req.params.id, res);
    if (!assignment) return;

    const items = await AssignmentVendorAllocation.find({
      assignmentId: assignment._id,
      isActive: true,
    })
      .populate('vendorId', 'name companyName email isActive')
      .sort({ allocatedAt: -1 })
      .lean();

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/allocations', [
  body('vendorIds').isArray({ min: 1 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const assignment = await getPlatformAssignmentOr404(req.params.id, res);
    if (!assignment) return;

    const vendorIds = req.body.vendorIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('_id');
    const found = new Set(vendors.map((v) => String(v._id)));

    const results = [];
    for (const vendorId of vendorIds) {
      if (!found.has(String(vendorId))) continue;
      const doc = await AssignmentVendorAllocation.findOneAndUpdate(
        { assignmentId: assignment._id, vendorId },
        {
          $set: {
            isActive: true,
            allocatedBy: req.user._id,
            allocatedAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );
      results.push(doc);
    }

    res.status(201).json({ items: results });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/allocations/:vendorId', async (req, res) => {
  try {
    const assignment = await getPlatformAssignmentOr404(req.params.id, res);
    if (!assignment) return;

    const doc = await AssignmentVendorAllocation.findOneAndUpdate(
      { assignmentId: assignment._id, vendorId: req.params.vendorId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Allocation not found' });
    res.json({ success: true, allocation: doc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
