const express = require('express');
const router = express.Router();
const SystemDesignProblem = require('../models/SystemDesignProblem');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { auth: authenticateToken, authorize: authorizeRoles } = require('../middleware/auth');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  canVendorAccessSystemDesign,
  getAllocatedPlatformSystemDesignIds,
  vendorOwnedOrAllocatedFilter,
} = require('../utils/platformAssessmentAccess');

// ==========================================
// ADMIN ROUTES - Create & Manage Problems
// ==========================================

/**
 * POST /api/system-design-problems
 * Create a new system design problem
 */
router.post('/', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const problem = new SystemDesignProblem({
      ...req.body,
      vendorId: req.user.vendorId,
      createdBy: req.user._id
    });

    await problem.save();

    res.status(201).json({
      success: true,
      message: 'System design problem created successfully',
      problem
    });
  } catch (error) {
    console.error('Error creating system design problem:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create problem',
      error: error.message
    });
  }
});

/**
 * GET /api/system-design-problems
 * Get all problems for vendor admin
 */
router.get('/', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const { category, difficulty, isActive } = req.query;
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 30,
      maxLimit: 100,
    });

    const allocatedIds = await getAllocatedPlatformSystemDesignIds(req.user.vendorId);
    const query = {
      ...vendorOwnedOrAllocatedFilter(req.user.vendorId, allocatedIds),
    };
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.title = new RegExp(escaped, 'i');
    }

    const [problems, total] = await Promise.all([
      SystemDesignProblem.find(query)
        .populate('createdBy', 'name email')
        .select('-referenceAnswer')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SystemDesignProblem.countDocuments(query),
    ]);

    res.json({
      success: true,
      ...paginatedResponse({
        items: problems.map((item) => ({
          ...item,
          isPlatformSystemDesign: item.source === 'platform',
        })),
        page,
        limit,
        total,
      }),
      problems,
    });
  } catch (error) {
    console.error('Error fetching system design problems:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch problems',
      error: error.message
    });
  }
});

/**
 * GET /api/system-design-problems/student-list
 * Get assigned problems for current student
 */
router.get('/student-list', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const studentId = req.user._id;

    // Get classrooms the student belongs to
    const student = await User.findById(studentId);
    const classroomIds = student?.classrooms || [];

    // Find problems assigned to this student or their classrooms
    const problems = await SystemDesignProblem.find({
      isActive: true,
      $or: [
        { assignedTo: studentId },
        { assignedClassrooms: { $in: classroomIds } }
      ]
    })
      .select('-referenceAnswer -hints -validationRules -evaluationConfig -architectureTemplates')
      .sort({ createdAt: -1 });

    // Get submissions for these problems (sorted so the latest wins below)
    const submissions = await SystemDesignSubmission.find({
      studentId,
      problemId: { $in: problems.map(p => p._id) }
    })
      .select('problemId status totalScore percentage currentStep courseId createdAt')
      .sort({ createdAt: 1 });

    const submissionMap = {};
    submissions.forEach(s => {
      const key = s.problemId.toString();
      const existing = submissionMap[key];
      // Prefer direct (non-course) submissions for the assigned list; among
      // the same kind, the most recent one wins
      if (existing && !existing.courseId && s.courseId) return;
      submissionMap[key] = s;
    });

    const problemsWithStatus = problems.map(p => {
      const sub = submissionMap[p._id.toString()];
      return {
        ...p.toObject(),
        submission: sub ? {
          _id: sub._id,
          status: sub.status,
          totalScore: sub.totalScore,
          percentage: sub.percentage,
          currentStep: sub.currentStep
        } : null
      };
    });

    res.json({ success: true, problems: problemsWithStatus });
  } catch (error) {
    console.error('Error fetching student system design problems:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch problems',
      error: error.message
    });
  }
});

/**
 * GET /api/system-design-problems/:id
 * Get problem details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    let selectFields = '';
    // Students should not see reference answers
    if (req.user.role === 'student') {
      selectFields = '-referenceAnswer';
    }

    const problem = await SystemDesignProblem.findById(req.params.id)
      .select(selectFields)
      .populate('createdBy', 'name email');

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    // Check access: admin must belong to same vendor, student must be assigned
    if (req.user.role === 'vendor_admin') {
      const allowed = await canVendorAccessSystemDesign(problem, req.user.vendorId);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    } else if (req.user.role === 'student') {
      const isAssigned = problem.assignedTo.some(id => id.toString() === req.user._id.toString());
      if (!isAssigned) {
        // Check classroom assignment
        const student = await User.findById(req.user._id);
        const studentClassrooms = student?.classrooms || [];
        const classroomAssigned = problem.assignedClassrooms.some(
          cId => studentClassrooms.some(sc => sc.toString() === cId.toString())
        );
        if (!classroomAssigned) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }
    }

    res.json({ success: true, problem });
  } catch (error) {
    console.error('Error fetching problem:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch problem',
      error: error.message
    });
  }
});

/**
 * PUT /api/system-design-problems/:id
 * Update a problem
 */
router.put('/:id', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const problem = await SystemDesignProblem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    if (problem.source === 'platform') {
      return res.status(403).json({
        success: false,
        message: 'Platform system design problems cannot be edited by vendors',
      });
    }

    if (String(problem.vendorId) !== String(req.user.vendorId)) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const updatableFields = [
      'title', 'problemStatement', 'difficulty', 'category', 'constraints',
      'businessContext', 'duration', 'sectionWeights', 'referenceAnswer',
      'dataFlowScenarios', 'deepDiveOptions', 'hints', 'architectureTemplates',
      'validationRules', 'evaluationConfig', 'isActive', 'startDate', 'endDate'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        problem[field] = req.body[field];
      }
    });

    await problem.save();

    res.json({
      success: true,
      message: 'Problem updated successfully',
      problem
    });
  } catch (error) {
    console.error('Error updating problem:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update problem',
      error: error.message
    });
  }
});

/**
 * DELETE /api/system-design-problems/:id
 * Delete a problem
 */
router.delete('/:id', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const problem = await SystemDesignProblem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    if (problem.source === 'platform') {
      return res.status(403).json({
        success: false,
        message: 'Platform system design problems cannot be deleted by vendors',
      });
    }

    if (String(problem.vendorId) !== String(req.user.vendorId)) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    await SystemDesignProblem.findByIdAndDelete(problem._id);
    await SystemDesignSubmission.deleteMany({ problemId: problem._id });

    res.json({
      success: true,
      message: 'Problem and associated submissions deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting problem:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete problem',
      error: error.message
    });
  }
});

/**
 * POST /api/system-design-problems/:id/assign
 * Assign problem to students/classrooms
 */
router.post('/:id/assign', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const { studentIds, classroomIds } = req.body;

    const problem = await SystemDesignProblem.findById(req.params.id);

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const allowed = await canVendorAccessSystemDesign(problem, req.user.vendorId);
    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    let newStudentIds = [];

    // Assign individual students
    if (studentIds && studentIds.length > 0) {
      const uniqueIds = studentIds.filter(
        id => !problem.assignedTo.some(existing => existing.toString() === id)
      );
      problem.assignedTo.push(...uniqueIds);
      newStudentIds.push(...uniqueIds);
    }

    // Assign classrooms and get their student IDs
    if (classroomIds && classroomIds.length > 0) {
      const uniqueClassroomIds = classroomIds.filter(
        id => !problem.assignedClassrooms.some(existing => existing.toString() === id)
      );
      problem.assignedClassrooms.push(...uniqueClassroomIds);

      // Get students from classrooms
      const classrooms = await Classroom.find({ _id: { $in: uniqueClassroomIds } });
      classrooms.forEach(c => {
        if (c.students) {
          c.students.forEach(sId => {
            if (!newStudentIds.includes(sId.toString())) {
              newStudentIds.push(sId.toString());
            }
          });
        }
      });
    }

    problem.totalAssigned = problem.assignedTo.length;
    await problem.save();

    res.json({
      success: true,
      message: `Problem assigned to ${newStudentIds.length} new student(s)`,
      totalAssigned: problem.totalAssigned
    });
  } catch (error) {
    console.error('Error assigning problem:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign problem',
      error: error.message
    });
  }
});

/**
 * GET /api/system-design-problems/:id/submissions
 * Get all submissions for a problem (admin)
 */
router.get('/:id/submissions', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    // Handles vendor-owned and platform-allocated problems (no vendorId on platform docs)
    const problem = await SystemDesignProblem.findById(req.params.id);
    const allowed = problem
      ? await canVendorAccessSystemDesign(problem, req.user.vendorId)
      : false;

    if (!allowed) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const submissions = await SystemDesignSubmission.find({
      problemId: req.params.id,
      // Scope to this vendor's students (platform problems are shared)
      vendorId: req.user.vendorId
    })
      .populate('studentId', 'name email enrollmentNumber')
      .select('-sections -followUpQuestions')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      problem: {
        _id: problem._id,
        title: problem.title,
        difficulty: problem.difficulty,
        category: problem.category,
        totalAssigned: problem.totalAssigned
      },
      submissions
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
});

module.exports = router;
