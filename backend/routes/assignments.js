const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Classroom = require('../models/Classroom');
const ProjectSubmission = require('../models/ProjectSubmission');
const EvaluationJob = require('../models/EvaluationJob');
const EvaluationResult = require('../models/EvaluationResult');
const { auth: authenticateToken, authorize: authorizeRoles } = require('../middleware/auth');

// ==========================================
// ADMIN ROUTES - Create & Manage Assignments
// ==========================================

/**
 * GET /api/assignments
 * Get all assignments for vendor admin
 */
router.get('/', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const { status, category, difficulty } = req.query;
    
    const query = { vendorId: req.user.vendorId };
    
    if (status) query.status = status;
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const assignments = await Assignment.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      assignments
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message
    });
  }
});

/**
 * GET /api/assignments/:id
 * Get single assignment details
 * For students: includes enrollment (startedAt, deadline, status) for timer
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check access permission
    if (req.user.role === 'vendor_admin' && 
        assignment.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const response = { success: true, assignment };

    // For students, include their enrollment for timer
    if (req.user.role === 'student') {
      const student = await User.findById(req.user._id);
      const enrollment = student?.enrolledAssignments?.find(
        ea => ea.assignmentId?.toString() === req.params.id
      );
      if (enrollment) {
        const startedAt = enrollment.startedAt ? new Date(enrollment.startedAt) : null;
        const assignmentDeadline = new Date(enrollment.deadline);
        const durationMs = assignment.duration * 60 * 1000;
        const timerEndAt = startedAt
          ? new Date(Math.min(startedAt.getTime() + durationMs, assignmentDeadline.getTime()))
          : null;
        const evaluateAfter = timerEndAt ? new Date(timerEndAt.getTime() + 30 * 60 * 1000) : null;
        response.enrollment = {
          status: enrollment.status,
          startedAt: enrollment.startedAt,
          deadline: enrollment.deadline,
          submissionId: enrollment.submissionId,
          timerEndAt: timerEndAt?.toISOString(),
          evaluateAfter: evaluateAfter?.toISOString()
        };
        if (enrollment.submissionId) {
          const ProjectSubmission = require('../models/ProjectSubmission');
          const sub = await ProjectSubmission.findById(enrollment.submissionId)
            .select('githubRepoUrl branchName');
          if (sub) {
            response.enrollment.currentSubmission = {
              githubRepoUrl: sub.githubRepoUrl,
              branchName: sub.branchName
            };
          }
        }
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignment',
      error: error.message
    });
  }
});

/**
 * POST /api/assignments
 * Create new assignment
 */
router.post('/', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const {
      title,
      description,
      difficulty,
      category,
      allowedTechStack,
      deadline,
      duration,
      totalMarks,
      featureChecklist,
      evaluationWeights,
      repositoryRules,
      additionalInstructions,
      assignmentType
    } = req.body;

    // Validation
    if (!title || !description || !difficulty || !category || !deadline || !duration || !totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing'
      });
    }

    if (!featureChecklist || featureChecklist.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one feature must be defined in the checklist'
      });
    }

    // Validate total marks match feature marks
    const featureTotalMarks = featureChecklist.reduce((sum, f) => sum + (f.marks || 0), 0);
    if (Math.abs(featureTotalMarks - totalMarks) > 5) {
      return res.status(400).json({
        success: false,
        message: `Feature marks (${featureTotalMarks}) should roughly match total marks (${totalMarks})`
      });
    }

    // Validate evaluation weights total 100%
    if (evaluationWeights) {
      const weightsTotal = Object.values(evaluationWeights).reduce((sum, w) => sum + w, 0);
      if (Math.abs(weightsTotal - 100) > 1) {
        return res.status(400).json({
          success: false,
          message: 'Evaluation weights must total 100%'
        });
      }
    }

    const assignment = new Assignment({
      title,
      description,
      difficulty,
      category,
      allowedTechStack: allowedTechStack || [],
      deadline: new Date(deadline),
      duration,
      totalMarks,
      featureChecklist,
      evaluationWeights: evaluationWeights || undefined,
      repositoryRules: repositoryRules || undefined,
      additionalInstructions: additionalInstructions || '',
      assignmentType: assignmentType || 'individual',
      vendorId: req.user.vendorId,
      createdBy: req.user._id,
      status: 'active'
    });

    await assignment.save();

    res.status(201).json({
      success: true,
      message: 'Assignment created successfully',
      assignment
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create assignment',
      error: error.message
    });
  }
});

/**
 * PUT /api/assignments/:id
 * Update assignment
 */
router.put('/:id', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check ownership
    if (assignment.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'difficulty', 'category', 'allowedTechStack',
      'deadline', 'duration', 'totalMarks', 'featureChecklist', 'evaluationWeights',
      'repositoryRules', 'additionalInstructions', 'status'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        assignment[field] = req.body[field];
      }
    });

    await assignment.save();

    res.json({
      success: true,
      message: 'Assignment updated successfully',
      assignment
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update assignment',
      error: error.message
    });
  }
});

/**
 * DELETE /api/assignments/:id
 * Delete assignment
 */
router.delete('/:id', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    // Check ownership
    if (assignment.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const assignmentId = assignment._id;

    // Cascade delete: remove all related data
    await EvaluationResult.deleteMany({ assignmentId });
    await EvaluationJob.deleteMany({ assignmentId });
    await ProjectSubmission.deleteMany({ assignmentId });

    // Remove assignment from all users' enrolledAssignments
    await User.updateMany(
      { 'enrolledAssignments.assignmentId': assignmentId },
      { $pull: { enrolledAssignments: { assignmentId } } }
    );

    await Assignment.deleteOne({ _id: assignmentId });

    res.json({
      success: true,
      message: 'Assignment and all related submissions/results have been deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete assignment',
      error: error.message
    });
  }
});

/**
 * POST /api/assignments/:id/activate
 * Activate assignment (make it available for students)
 */
router.post('/:id/activate', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (assignment.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    assignment.status = 'active';
    await assignment.save();

    res.json({
      success: true,
      message: 'Assignment activated successfully',
      assignment
    });
  } catch (error) {
    console.error('Error activating assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate assignment',
      error: error.message
    });
  }
});

/**
 * POST /api/assignments/:id/assign
 * Assign assignment to students
 */
router.post('/:id/assign', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const { studentIds, classroomId, classroomIds } = req.body;

    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (assignment.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (assignment.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Cannot assign archived assignment'
      });
    }
    if (assignment.status === 'draft') {
      assignment.status = 'active';
      await assignment.save();
    }

    const classroomIdList = [
      ...(Array.isArray(classroomIds) ? classroomIds : []),
      ...(classroomId ? [classroomId] : []),
    ].filter(Boolean);

    const targetStudentIdSet = new Set();

    for (const cid of classroomIdList) {
      const classroom = await Classroom.findById(cid);
      if (!classroom || classroom.vendorId.toString() !== req.user.vendorId.toString()) {
        return res.status(404).json({
          success: false,
          message: 'Classroom not found',
        });
      }
      (classroom.students || []).forEach((sid) => targetStudentIdSet.add(sid.toString()));
    }

    if (studentIds && studentIds.length > 0) {
      studentIds.forEach((sid) => targetStudentIdSet.add(sid.toString()));
    }

    if (targetStudentIdSet.size === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one classroom with students or individual students',
      });
    }

    const targetStudentIds = [...targetStudentIdSet];

    // Assign to students
    let assignedCount = 0;
    let alreadyAssignedCount = 0;

    for (const studentId of targetStudentIds) {
      const student = await User.findById(studentId);
      
      if (!student || student.role !== 'student') {
        continue;
      }

      // Check if already assigned
      const alreadyAssigned = student.enrolledAssignments.some(
        ea => ea.assignmentId.toString() === assignment._id.toString()
      );

      if (alreadyAssigned) {
        alreadyAssignedCount++;
        continue;
      }

      // Add to student's enrolled assignments
      student.enrolledAssignments.push({
        assignmentId: assignment._id,
        assignedAt: new Date(),
        status: 'assigned',
        deadline: assignment.deadline
      });

      await student.save();
      assignedCount++;
    }

    // Update assignment statistics
    assignment.totalAssigned += assignedCount;
    await assignment.save();

    res.json({
      success: true,
      message: `Assignment assigned to ${assignedCount} student(s)`,
      assignedCount,
      alreadyAssignedCount
    });
  } catch (error) {
    console.error('Error assigning assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign assignment',
      error: error.message
    });
  }
});

/**
 * GET /api/assignments/:id/students
 * Get students assigned to this assignment
 */
router.get('/:id/students', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (assignment.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find all students with this assignment
    const students = await User.find({
      role: 'student',
      vendorId: req.user.vendorId,
      'enrolledAssignments.assignmentId': assignment._id
    }).select('name email enrolledAssignments');

    // Map student data with assignment status
    const studentData = students.map(student => {
      const enrollment = student.enrolledAssignments.find(
        ea => ea.assignmentId.toString() === assignment._id.toString()
      );

      return {
        _id: student._id,
        name: student.name,
        email: student.email,
        assignedAt: enrollment.assignedAt,
        status: enrollment.status,
        startedAt: enrollment.startedAt,
        submittedAt: enrollment.submittedAt,
        submissionId: enrollment.submissionId
      };
    });

    res.json({
      success: true,
      students: studentData
    });
  } catch (error) {
    console.error('Error fetching assigned students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned students',
      error: error.message
    });
  }
});

// ==========================================
// STUDENT ROUTES - View Assigned Assignments
// ==========================================

/**
 * GET /api/assignments/student/my-assignments
 * Get student's assigned assignments
 */
router.get('/student/my-assignments', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const student = await User.findById(req.user._id)
      .populate('enrolledAssignments.assignmentId')
      .populate('enrolledAssignments.submissionId');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const assignments = student.enrolledAssignments
      .filter(ea => ea.assignmentId) // Filter out null assignments
      .map(ea => {
        const assignment = ea.assignmentId;
        const startedAt = ea.startedAt ? new Date(ea.startedAt) : null;
        const deadlineDate = new Date(ea.deadline);
        const durationMs = assignment?.duration ? assignment.duration * 60 * 1000 : 0;
        const timerEndAt = startedAt && durationMs
          ? new Date(Math.min(startedAt.getTime() + durationMs, deadlineDate.getTime()))
          : null;
        return {
          assignment,
          enrollmentStatus: ea.status,
          assignedAt: ea.assignedAt,
          startedAt: ea.startedAt,
          submittedAt: ea.submittedAt,
          deadline: ea.deadline,
          submission: ea.submissionId,
          timerEndAt: timerEndAt?.toISOString?.() || null,
          isOverdue: new Date() > deadlineDate && ea.status !== 'evaluated'
        };
      });

    res.json({
      success: true,
      assignments
    });
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments',
      error: error.message
    });
  }
});

/**
 * POST /api/assignments/:id/start
 * Student starts working on assignment (starts timer)
 */
router.post('/:id/start', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const student = await User.findById(req.user._id);
    
    const enrollment = student.enrolledAssignments.find(
      ea => ea.assignmentId.toString() === req.params.id
    );

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not assigned to you'
      });
    }

    if (enrollment.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Assignment already started or completed'
      });
    }

    // Check if deadline passed
    if (new Date() > new Date(enrollment.deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Assignment deadline has passed'
      });
    }

    // Update status
    enrollment.status = 'in_progress';
    enrollment.startedAt = new Date();

    await student.save();

    res.json({
      success: true,
      message: 'Assignment started. Timer is now running!',
      startedAt: enrollment.startedAt,
      deadline: enrollment.deadline
    });
  } catch (error) {
    console.error('Error starting assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start assignment',
      error: error.message
    });
  }
});

module.exports = router;
