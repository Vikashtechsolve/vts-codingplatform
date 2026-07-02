const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const ProjectSubmission = require('../models/ProjectSubmission');
const EvaluationJob = require('../models/EvaluationJob');
const EvaluationResult = require('../models/EvaluationResult');
const User = require('../models/User');
const { auth: authenticateToken, authorize: authorizeRoles } = require('../middleware/auth');
const {
  addEvaluationJob,
  getQueueStats,
  freshProcessingSteps
} = require('../workers/evaluationWorker');

// ==========================================
// STUDENT ROUTES - Submit Projects
// ==========================================

/**
 * POST /api/project-submissions
 * Submit project for evaluation
 */
router.post('/', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const {
      assignmentId,
      githubRepoUrl,
      branchName,
      liveUrl,
      studentNotes
    } = req.body;

    // Validation
    if (!assignmentId || !githubRepoUrl) {
      return res.status(400).json({
        success: false,
        message: 'Assignment ID and GitHub repository URL are required'
      });
    }

    // Validate GitHub URL format
    const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!githubUrlPattern.test(githubRepoUrl.replace(/\.git$/, ''))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GitHub repository URL format'
      });
    }

    // Get assignment
    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    if (assignment.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Assignment is not active'
      });
    }

    // Get student enrollment
    const student = await User.findById(req.user._id);
    const enrollment = student.enrolledAssignments.find(
      ea => ea.assignmentId.toString() === assignmentId
    );

    if (!enrollment) {
      return res.status(403).json({
        success: false,
        message: 'Assignment not assigned to you'
      });
    }

    // Check if already submitted
    if (enrollment.status === 'submitted' || enrollment.status === 'evaluated') {
      return res.status(400).json({
        success: false,
        message: 'Assignment already submitted. Contact your instructor for resubmission.'
      });
    }

    // Check if assignment was started
    if (!enrollment.startedAt) {
      return res.status(400).json({
        success: false,
        message: 'You must start the assignment before submitting'
      });
    }

    const now = new Date();
    const startedAt = new Date(enrollment.startedAt);
    const assignmentDeadline = new Date(enrollment.deadline);
    const allowedTimeMs = assignment.duration * 60 * 1000;
    const timerEndAt = new Date(Math.min(
      startedAt.getTime() + allowedTimeMs,
      assignmentDeadline.getTime()
    ));

    const minutesLate = (now - timerEndAt) / (1000 * 60);

    if (minutesLate > 0) {
      return res.status(400).json({
        success: false,
        message: `Submission not accepted. The timer has ended. You must submit your GitHub repository link before the timer ends. Late submissions are not allowed.`
      });
    }

    const evaluateAfter = new Date(timerEndAt.getTime() + 30 * 60 * 1000);

    const normalizedGithubUrl = githubRepoUrl.replace(/\.git$/, '').trim().toLowerCase().replace(/\/$/, '');

    const existingWithSameUrl = await ProjectSubmission.find({
      assignmentId,
      status: { $in: ['pending_evaluation', 'evaluating', 'evaluated'] }
    });

    const isDuplicateUrl = existingWithSameUrl.some((sub) => {
      const subUrl = (sub.githubRepoUrl || '').replace(/\.git$/, '').trim().toLowerCase().replace(/\/$/, '');
      return subUrl === normalizedGithubUrl && sub.studentId.toString() !== req.user._id.toString();
    });

    if (isDuplicateUrl) {
      return res.status(400).json({
        success: false,
        message: 'This GitHub repository URL has already been submitted by another student for this assignment. Each student must submit their own unique repository.'
      });
    }

    // Check for existing pending submission (same student - allow update via PATCH)
    const existingSubmission = await ProjectSubmission.findOne({
      assignmentId,
      studentId: req.user._id,
      status: { $in: ['pending_evaluation', 'evaluating'] }
    });

    if (existingSubmission) {
      return res.status(400).json({
        success: false,
        message: 'A submission is already being evaluated'
      });
    }

    // Create submission
    const submission = new ProjectSubmission({
      assignmentId,
      studentId: req.user._id,
      vendorId: assignment.vendorId,
      githubRepoUrl: githubRepoUrl.replace(/\.git$/, '').trim(),
      branchName: branchName || 'main',
      liveUrl: liveUrl || '',
      assignedAt: enrollment.assignedAt,
      startedAt: enrollment.startedAt,
      submittedAt: now,
      deadline: enrollment.deadline,
      timerEndAt,
      evaluateAfter,
      status: 'pending_evaluation',
      studentNotes: studentNotes || ''
    });

    await submission.save();

    // Update student enrollment
    enrollment.status = 'submitted';
    enrollment.submittedAt = now;
    enrollment.submissionId = submission._id;
    await student.save();

    // Update assignment statistics
    await Assignment.updateOne(
      { _id: assignmentId },
      { $inc: { totalSubmitted: 1 } }
    );

    // Create evaluation job
    const evaluationJob = new EvaluationJob({
      submissionId: submission._id,
      assignmentId,
      studentId: req.user._id,
      status: 'queued',
      priority: 5
    });

    await evaluationJob.save();

    // Update submission with job ID
    submission.evaluationJobId = evaluationJob._id;
    await submission.save();

    const delayMs = Math.max(0, evaluateAfter - now);

    // Add to evaluation queue (delayed: runs 30 min after timer ends)
    try {
      await addEvaluationJob(submission._id.toString(), 5, delayMs);
      console.log(`📋 Evaluation job queued for submission ${submission._id} (runs in ${Math.round(delayMs / 60000)} min)`);
    } catch (queueErr) {
      console.error('❌ Failed to add evaluation job to queue:', queueErr.message);
      console.log('💡 Ensure Redis is running. Use Retry Evaluation from admin panel.');
    }

    res.status(201).json({
      success: true,
      message: 'Project submitted successfully! Evaluation will begin shortly.',
      submission: {
        _id: submission._id,
        assignmentId: submission.assignmentId,
        githubRepoUrl: submission.githubRepoUrl,
        submittedAt: submission.submittedAt,
        status: submission.status
      },
      evaluationJob: {
        _id: evaluationJob._id,
        status: evaluationJob.status
      }
    });
  } catch (error) {
    console.error('Error submitting project:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit project',
      error: error.message
    });
  }
});

/**
 * PATCH /api/project-submissions/:id
 * Update submission (repo URL, etc.) - only allowed until timer ends
 */
router.patch('/:id', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { githubRepoUrl, branchName, liveUrl, studentNotes } = req.body;
    const submission = await ProjectSubmission.findById(req.params.id)
      .populate('assignmentId');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }
    if (submission.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (submission.status !== 'pending_evaluation') {
      return res.status(400).json({
        success: false,
        message: 'Can only update submissions that are pending evaluation'
      });
    }

    const now = new Date();
    const timerEndAt = submission.timerEndAt ? new Date(submission.timerEndAt) : null;
    if (!timerEndAt || now > timerEndAt) {
      return res.status(400).json({
        success: false,
        message: 'You can no longer update your submission. The timer has ended.'
      });
    }

    if (githubRepoUrl) {
      const githubUrlPattern = /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
      if (!githubUrlPattern.test(githubRepoUrl.replace(/\.git$/, ''))) {
        return res.status(400).json({ success: false, message: 'Invalid GitHub repository URL format' });
      }
      const normalizedNew = githubRepoUrl.replace(/\.git$/, '').trim().toLowerCase().replace(/\/$/, '');
      const existingWithSameUrl = await ProjectSubmission.find({
        assignmentId: submission.assignmentId,
        status: { $in: ['pending_evaluation', 'evaluating', 'evaluated'] }
      });
      const isDuplicate = existingWithSameUrl.some((sub) => {
        const subUrl = (sub.githubRepoUrl || '').replace(/\.git$/, '').trim().toLowerCase().replace(/\/$/, '');
        return subUrl === normalizedNew && sub.studentId.toString() !== req.user._id.toString();
      });
      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: 'This GitHub URL has already been submitted by another student for this assignment.'
        });
      }
      submission.githubRepoUrl = githubRepoUrl.replace(/\.git$/, '').trim();
    }
    if (branchName !== undefined) submission.branchName = branchName || 'main';
    if (liveUrl !== undefined) submission.liveUrl = liveUrl || '';
    if (studentNotes !== undefined) submission.studentNotes = studentNotes || '';

    await submission.save();

    res.json({
      success: true,
      message: 'Submission updated. Evaluation will use your latest repository.',
      submission: {
        _id: submission._id,
        githubRepoUrl: submission.githubRepoUrl,
        branchName: submission.branchName
      }
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    res.status(500).json({ success: false, message: 'Failed to update submission', error: error.message });
  }
});

/**
 * GET /api/project-submissions/my-submissions
 * Get student's submissions
 */
router.get('/my-submissions', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const submissions = await ProjectSubmission.find({
      studentId: req.user._id
    })
      .populate('assignmentId', 'title category difficulty totalMarks deadline')
      .populate('evaluationJobId')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
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

/**
 * GET /api/project-submissions/:id
 * Get submission details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const submission = await ProjectSubmission.findById(req.params.id)
      .populate('assignmentId')
      .populate('studentId', 'name email enrollmentNumber')
      .populate('evaluationJobId');

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check access permission (compare as strings)
    const subStudentId = (submission.studentId?._id || submission.studentId)?.toString();
    if (req.user.role === 'student' && subStudentId !== req.user._id?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'vendor_admin' && 
        submission.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      submission
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submission',
      error: error.message
    });
  }
});

/**
 * GET /api/project-submissions/:id/result
 * Get evaluation result for submission
 */
router.get('/:id/result', authenticateToken, async (req, res) => {
  try {
    const submission = await ProjectSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check access permission (compare as strings - ObjectId !== string)
    const resultStudentId = (submission.studentId?._id || submission.studentId)?.toString();
    if (req.user.role === 'student' && resultStudentId !== req.user._id?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.user.role === 'vendor_admin' && 
        submission.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if evaluated
    if (submission.status !== 'evaluated') {
      return res.status(400).json({
        success: false,
        message: 'Submission not yet evaluated',
        status: submission.status
      });
    }

    // Get evaluation result
    const result = await EvaluationResult.findOne({ submissionId: req.params.id })
      .populate('assignmentId', 'title category difficulty totalMarks')
      .populate('studentId', 'name email enrollmentNumber');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Evaluation result not found'
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error fetching evaluation result:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evaluation result',
      error: error.message
    });
  }
});

/**
 * GET /api/project-submissions/:id/status
 * Get evaluation status
 */
router.get('/:id/status', authenticateToken, async (req, res) => {
  try {
    const submission = await ProjectSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    // Check access permission (compare as strings)
    const statusStudentId = (submission.studentId?._id || submission.studentId)?.toString();
    if (req.user.role === 'student' && statusStudentId !== req.user._id?.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const evaluationJob = await EvaluationJob.findById(submission.evaluationJobId);

    res.json({
      success: true,
      submission: {
        _id: submission._id,
        status: submission.status,
        submittedAt: submission.submittedAt
      },
      evaluationJob: evaluationJob ? {
        _id: evaluationJob._id,
        status: evaluationJob.status,
        processingSteps: evaluationJob.processingSteps,
        queuedAt: evaluationJob.queuedAt,
        startedAt: evaluationJob.startedAt,
        completedAt: evaluationJob.completedAt,
        error: evaluationJob.error
      } : null
    });
  } catch (error) {
    console.error('Error fetching evaluation status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evaluation status',
      error: error.message
    });
  }
});

// ==========================================
// ADMIN ROUTES - View All Submissions
// ==========================================

/**
 * GET /api/project-submissions/assignment/:assignmentId
 * Get all submissions for an assignment (admin)
 */
router.get('/assignment/:assignmentId', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);

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

    const submissions = await ProjectSubmission.find({
      assignmentId: req.params.assignmentId
    })
      .populate('studentId', 'name email enrollmentNumber')
      .populate('evaluationJobId')
      .sort({ submittedAt: -1 });

    // Get evaluation results for evaluated submissions
    const submissionIds = submissions
      .filter(s => s.status === 'evaluated')
      .map(s => s._id);

    const results = await EvaluationResult.find({
      submissionId: { $in: submissionIds }
    }).select('submissionId totalScore percentage grade');

    // Map results to submissions
    const submissionsWithResults = submissions.map(submission => {
      const result = results.find(r => r.submissionId.toString() === submission._id.toString());
      
      return {
        ...submission.toObject(),
        evaluationResult: result ? {
          totalScore: result.totalScore,
          percentage: result.percentage,
          grade: result.grade
        } : null
      };
    });

    res.json({
      success: true,
      submissions: submissionsWithResults
    });
  } catch (error) {
    console.error('Error fetching assignment submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message
    });
  }
});

/**
 * GET /api/project-submissions/queue/stats
 * Get evaluation queue statistics (admin)
 */
router.get('/queue/stats', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const queueStats = await getQueueStats();

    // Get pending evaluations for this vendor
    const pendingEvaluations = await EvaluationJob.find({
      status: { $in: ['queued', 'processing'] }
    })
      .populate('assignmentId', 'title vendorId')
      .sort({ priority: -1, queuedAt: 1 });

    // Filter by vendor
    const vendorPendingEvaluations = pendingEvaluations.filter(
      job => job.assignmentId && job.assignmentId.vendorId.toString() === req.user.vendorId.toString()
    );

    res.json({
      success: true,
      queueStats,
      vendorPendingEvaluations: vendorPendingEvaluations.length,
      pendingJobs: vendorPendingEvaluations.map(job => ({
        _id: job._id,
        assignmentTitle: job.assignmentId?.title || 'Unknown',
        status: job.status,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt
      }))
    });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queue statistics',
      error: error.message
    });
  }
});

/**
 * POST /api/project-submissions/:id/retry-evaluation
 * Retry failed evaluation (admin)
 */
router.post('/:id/retry-evaluation', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const submission = await ProjectSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }

    if (submission.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (submission.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: 'Can only retry failed evaluations'
      });
    }

    // Reset submission status
    submission.status = 'pending_evaluation';
    await submission.save();

    // Reset or create new evaluation job
    let evaluationJob = await EvaluationJob.findById(submission.evaluationJobId);
    
    if (evaluationJob) {
      evaluationJob.status = 'queued';
      evaluationJob.error = null;
      evaluationJob.errorDetails = null;
      evaluationJob.processingSteps = freshProcessingSteps();
      evaluationJob.startedAt = undefined;
      evaluationJob.completedAt = undefined;
      evaluationJob.retryCount += 1;
      evaluationJob.queuedAt = new Date();
      await evaluationJob.save();
    } else {
      evaluationJob = new EvaluationJob({
        submissionId: submission._id,
        assignmentId: submission.assignmentId,
        studentId: submission.studentId,
        status: 'queued'
      });
      await evaluationJob.save();
      
      submission.evaluationJobId = evaluationJob._id;
      await submission.save();
    }

    // Add to queue
    await addEvaluationJob(submission._id.toString(), 8); // Higher priority for retries

    res.json({
      success: true,
      message: 'Evaluation retry queued successfully'
    });
  } catch (error) {
    console.error('Error retrying evaluation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry evaluation',
      error: error.message
    });
  }
});

module.exports = router;
