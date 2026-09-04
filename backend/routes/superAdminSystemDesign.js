const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const SystemDesignVendorAllocation = require('../models/SystemDesignVendorAllocation');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const Vendor = require('../models/Vendor');

const { parsePagination, isPaginatedRequest, paginatedFind } = require('../utils/pagination');

const router = express.Router();
router.use(auth);
router.use(authorize('super_admin'));

async function getPlatformProblemOr404(id, res) {
  const problem = await SystemDesignProblem.findOne({ _id: id, source: 'platform' });
  if (!problem) {
    res.status(404).json({ message: 'Platform system design problem not found' });
    return null;
  }
  return problem;
}

router.get('/', async (req, res) => {
  try {
    const filter = { source: 'platform' };
    if (isPaginatedRequest(req.query)) {
      const { page, limit, search } = parsePagination(req.query, {
        defaultLimit: 20,
        maxLimit: 50,
      });
      const payload = await paginatedFind(SystemDesignProblem, {
        filter,
        search,
        searchFields: ['title', 'category'],
        select: 'title difficulty duration category createdAt',
        page,
        limit,
      });
      return res.json(payload);
    }

    const problems = await SystemDesignProblem.find(filter)
      .populate('createdBy', 'name email')
      .select('-referenceAnswer')
      .sort({ createdAt: -1 })
      .lean();

    const ids = problems.map((p) => p._id);
    const counts = await SystemDesignVendorAllocation.aggregate([
      { $match: { problemId: { $in: ids }, isActive: true } },
      { $group: { _id: '$problemId', count: { $sum: 1 } } },
    ]);
    const countMap = Object.fromEntries(counts.map((row) => [String(row._id), row.count]));

    res.json(
      problems.map((item) => ({
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
  body('problemStatement').trim().notEmpty(),
  body('difficulty').isIn(['easy', 'medium', 'hard']),
  body('duration').isInt({ min: 15 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const problem = await SystemDesignProblem.create({
      ...req.body,
      source: 'platform',
      vendorId: null,
      createdBy: req.user._id,
      isActive: true,
    });

    res.status(201).json(problem);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const problem = await getPlatformProblemOr404(req.params.id, res);
    if (!problem) return;
    const populated = await SystemDesignProblem.findById(problem._id).populate(
      'createdBy',
      'name email'
    );
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const problem = await getPlatformProblemOr404(req.params.id, res);
    if (!problem) return;

    const blocked = ['_id', 'vendorId', 'source', 'createdBy'];
    Object.keys(req.body).forEach((key) => {
      if (!blocked.includes(key) && req.body[key] !== undefined) {
        problem[key] = req.body[key];
      }
    });

    await problem.save();
    res.json(problem);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const problem = await getPlatformProblemOr404(req.params.id, res);
    if (!problem) return;

    await SystemDesignSubmission.deleteMany({ problemId: problem._id });
    await SystemDesignVendorAllocation.deleteMany({ problemId: problem._id });
    await SystemDesignProblem.findByIdAndDelete(problem._id);
    res.json({ message: 'Platform system design problem deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/allocations', async (req, res) => {
  try {
    const problem = await getPlatformProblemOr404(req.params.id, res);
    if (!problem) return;

    const items = await SystemDesignVendorAllocation.find({
      problemId: problem._id,
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

    const problem = await getPlatformProblemOr404(req.params.id, res);
    if (!problem) return;

    const vendorIds = req.body.vendorIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('_id');
    const found = new Set(vendors.map((v) => String(v._id)));

    const results = [];
    for (const vendorId of vendorIds) {
      if (!found.has(String(vendorId))) continue;
      const doc = await SystemDesignVendorAllocation.findOneAndUpdate(
        { problemId: problem._id, vendorId },
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
    const problem = await getPlatformProblemOr404(req.params.id, res);
    if (!problem) return;

    const doc = await SystemDesignVendorAllocation.findOneAndUpdate(
      { problemId: problem._id, vendorId: req.params.vendorId },
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
