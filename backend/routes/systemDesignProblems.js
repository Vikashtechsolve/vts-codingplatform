const express = require('express');
const router = express.Router();
const SystemDesignProblem = require('../models/SystemDesignProblem');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { auth: authenticateToken, authorize: authorizeRoles } = require('../middleware/auth');

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

    const query = { vendorId: req.user.vendorId };
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const problems = await SystemDesignProblem.find(query)
      .populate('createdBy', 'name email')
      .select('-referenceAnswer')
      .sort({ createdAt: -1 });

    res.json({ success: true, problems });
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

    // Get submissions for these problems
    const submissions = await SystemDesignSubmission.find({
      studentId,
      problemId: { $in: problems.map(p => p._id) }
    }).select('problemId status totalScore percentage currentStep');

    const submissionMap = {};
    submissions.forEach(s => {
      submissionMap[s.problemId.toString()] = s;
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
      if (problem.vendorId.toString() !== req.user.vendorId.toString()) {
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
    const problem = await SystemDesignProblem.findOne({
      _id: req.params.id,
      vendorId: req.user.vendorId
    });

    if (!problem) {
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
    const problem = await SystemDesignProblem.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user.vendorId
    });

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    // Also delete all submissions for this problem
    await SystemDesignSubmission.deleteMany({ problemId: req.params.id });

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

    const problem = await SystemDesignProblem.findOne({
      _id: req.params.id,
      vendorId: req.user.vendorId
    });

    if (!problem) {
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
    const problem = await SystemDesignProblem.findOne({
      _id: req.params.id,
      vendorId: req.user.vendorId
    });

    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    const submissions = await SystemDesignSubmission.find({ problemId: req.params.id })
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
