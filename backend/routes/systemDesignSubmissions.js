const express = require('express');
const router = express.Router();
const SystemDesignProblem = require('../models/SystemDesignProblem');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const { auth: authenticateToken, authorize: authorizeRoles } = require('../middleware/auth');
const Contest = require('../models/Contest');
const {
  enforceContestWindowIfApplicable,
  syncParticipantOnSystemDesignStart,
  markParticipantCompleted,
  getParticipant,
} = require('../utils/contestService');

/**
 * POST /api/system-design-submissions/start/:problemId
 * Start a system design attempt
 */
router.post('/start/:problemId', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { problemId } = req.params;
    const studentId = req.user._id;

    const problem = await SystemDesignProblem.findById(problemId);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem not found' });
    }

    if (!problem.isActive) {
      return res.status(400).json({ success: false, message: 'This problem is no longer active' });
    }

    const contestId = req.body?.contestId || req.query?.contestId;
    let activeContest = null;
    try {
      activeContest = await enforceContestWindowIfApplicable(
        contestId,
        'system_design',
        problemId,
        studentId
      );
    } catch (contestErr) {
      return res.status(contestErr.status || 403).json({
        success: false,
        message: contestErr.message,
        code: contestErr.code,
      });
    }

    // Check if already started
    let submission = await SystemDesignSubmission.findOne({ problemId, studentId });
    if (submission && submission.status !== 'not_started') {
      return res.json({
        success: true,
        message: 'Resuming existing submission',
        submission
      });
    }

    if (!submission) {
      // Initialize scaling strategy checklist
      const defaultStrategies = [
        'Horizontal Scaling', 'Vertical Scaling', 'Load Balancing',
        'Database Sharding', 'Read Replicas', 'Caching',
        'CDN', 'Rate Limiting', 'Auto-scaling',
        'Connection Pooling', 'Database Federation', 'Async Processing'
      ];

      submission = new SystemDesignSubmission({
        problemId,
        studentId,
        vendorId: problem.vendorId,
        status: 'in_progress',
        startedAt: new Date(),
        currentStep: 0,
        sections: {
          requirements: { functional: [], nonFunctional: {} },
          capacityEstimation: {},
          coreEntities: [],
          apiDesign: [],
          architecture: { diagramData: null, textExplanation: '', components: [] },
          dataFlow: problem.dataFlowScenarios.map(scenario => ({
            scenario,
            steps: [{ order: 1, description: '' }]
          })),
          databaseDesign: [],
          scalingStrategy: {
            strategies: defaultStrategies.map(name => ({
              name,
              selected: false,
              explanation: ''
            })),
            additionalNotes: ''
          },
          deepDive: { topic: '', explanation: '' },
          tradeoffs: []
        }
      });
    } else {
      submission.status = 'in_progress';
      submission.startedAt = new Date();
    }

    await submission.save();

    if (activeContest) {
      await syncParticipantOnSystemDesignStart(activeContest._id, studentId, submission._id);
    }

    res.status(201).json({
      success: true,
      message: 'System design attempt started',
      submission,
      contestId: activeContest?._id,
      attemptWindowEnd: activeContest?.attemptWindowEnd,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key - submission already exists, fetch and return it
      const submission = await SystemDesignSubmission.findOne({
        problemId: req.params.problemId,
        studentId: req.user._id
      });
      return res.json({ success: true, message: 'Resuming existing submission', submission });
    }
    console.error('Error starting system design:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start system design',
      error: error.message
    });
  }
});

/**
 * PUT /api/system-design-submissions/:submissionId/save-section
 * Auto-save a section
 */
router.put('/:submissionId/save-section', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { section, data, timeSpent } = req.body;
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found or not in progress' });
    }

    const validSections = [
      'requirements', 'capacityEstimation', 'coreEntities', 'apiDesign',
      'architecture', 'dataFlow', 'databaseDesign', 'scalingStrategy',
      'deepDive', 'tradeoffs'
    ];

    if (!validSections.includes(section)) {
      return res.status(400).json({ success: false, message: 'Invalid section name' });
    }

    // Update section data
    submission.sections[section] = data;

    // Update time spent on this section
    if (timeSpent && typeof timeSpent === 'number') {
      submission.sectionTimeSpent[section] = timeSpent;
    }

    // Recalculate total time
    const totalTime = Object.values(submission.sectionTimeSpent.toObject()).reduce((a, b) => a + b, 0);
    submission.timeSpent = totalTime;

    submission.markModified('sections');
    submission.markModified('sectionTimeSpent');
    await submission.save();

    res.json({
      success: true,
      message: `Section "${section}" saved`,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save section',
      error: error.message
    });
  }
});

/**
 * PUT /api/system-design-submissions/:submissionId/update-step
 * Update current step tracker
 */
router.put('/:submissionId/update-step', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { step } = req.body;
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    submission.currentStep = Math.max(submission.currentStep, step);
    await submission.save();

    res.json({ success: true, currentStep: submission.currentStep });
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ success: false, message: 'Failed to update step' });
  }
});

/**
 * POST /api/system-design-submissions/:submissionId/use-hint
 * Record hint usage
 */
router.post('/:submissionId/use-hint', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { section, hintIndex } = req.body;
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Check if hint already used
    const alreadyUsed = submission.hintsUsed.some(
      h => h.section === section && h.hintIndex === hintIndex
    );

    if (alreadyUsed) {
      return res.json({ success: true, message: 'Hint already unlocked', alreadyUsed: true });
    }

    // Get the hint from the problem
    const problem = await SystemDesignProblem.findById(submission.problemId);
    const sectionHints = problem?.hints?.[section] || [];
    const hint = sectionHints[hintIndex];

    if (!hint) {
      return res.status(404).json({ success: false, message: 'Hint not found' });
    }

    submission.hintsUsed.push({
      section,
      hintIndex,
      timestamp: new Date()
    });

    await submission.save();

    res.json({
      success: true,
      hint: hint.text,
      penaltyPercent: hint.penaltyPercent,
      totalHintsUsed: submission.hintsUsed.length
    });
  } catch (error) {
    console.error('Error using hint:', error);
    res.status(500).json({ success: false, message: 'Failed to use hint' });
  }
});

/**
 * POST /api/system-design-submissions/:submissionId/submit
 * Final submit and trigger AI evaluation
 */
router.post('/:submissionId/submit', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found or already submitted' });
    }

    submission.status = 'submitted';
    submission.submittedAt = new Date();
    submission.timeSpent = Math.round((submission.submittedAt - submission.startedAt) / 1000);
    await submission.save();

    const submitContestId = req.body?.contestId || req.query?.contestId;
    if (submitContestId) {
      await markParticipantCompleted(submitContestId, req.user._id, {
        model: 'SystemDesignSubmission',
        id: submission._id,
      });
    } else {
      const linkedContest = await Contest.findOne({
        assessmentType: 'system_design',
        assessmentId: submission.problemId,
        status: 'published',
      });
      if (linkedContest) {
        const linkedParticipant = await getParticipant(linkedContest._id, req.user._id);
        if (linkedParticipant) {
          await markParticipantCompleted(linkedContest._id, req.user._id, {
            model: 'SystemDesignSubmission',
            id: submission._id,
          });
        }
      }
    }

    // Update problem stats
    await SystemDesignProblem.findByIdAndUpdate(submission.problemId, {
      $inc: { totalSubmitted: 1 }
    });

    // Trigger AI evaluation asynchronously
    evaluateSubmission(submission._id).catch(err => {
      console.error('Background evaluation error:', err);
    });

    res.json({
      success: true,
      message: 'Submission received. AI evaluation in progress.',
      submissionId: submission._id
    });
  } catch (error) {
    console.error('Error submitting:', error);
    res.status(500).json({ success: false, message: 'Failed to submit' });
  }
});

/**
 * Background AI evaluation function
 */
async function evaluateSubmission(submissionId) {
  try {
    const submission = await SystemDesignSubmission.findById(submissionId);
    if (!submission) return;

    submission.status = 'evaluating';
    await submission.save();

    const problem = await SystemDesignProblem.findById(submission.problemId);
    if (!problem) return;

    // Import and run evaluator
    const { evaluateSystemDesign } = require('../utils/systemDesignEvaluator');
    const result = await evaluateSystemDesign(submission, problem);

    // Apply evaluation results
    const sectionNames = [
      'requirements', 'capacityEstimation', 'coreEntities', 'apiDesign',
      'architecture', 'dataFlow', 'databaseDesign', 'scalingStrategy',
      'deepDive', 'tradeoffs'
    ];

    sectionNames.forEach(section => {
      if (result.sections[section]) {
        submission.evaluation[section] = result.sections[section];
      }
    });

    // Calculate hint penalty
    let hintPenalty = 0;
    submission.hintsUsed.forEach(hintUsage => {
      const sectionHints = problem.hints?.[hintUsage.section] || [];
      const hint = sectionHints[hintUsage.hintIndex];
      if (hint) {
        hintPenalty += hint.penaltyPercent || 5;
      }
    });
    submission.evaluation.hintPenalty = Math.min(hintPenalty, 30);

    // Calculate weighted total score
    let totalWeightedScore = 0;
    let totalWeight = 0;

    sectionNames.forEach(section => {
      const weight = problem.sectionWeights[section] || 0;
      const score = submission.evaluation[section]?.score || 0;
      totalWeightedScore += (score / 10) * weight;
      totalWeight += weight;
    });

    const rawPercentage = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
    const finalPercentage = Math.max(0, rawPercentage - submission.evaluation.hintPenalty);

    submission.totalScore = Math.round(finalPercentage);
    submission.maxScore = 100;
    submission.percentage = Math.round(finalPercentage * 10) / 10;

    // Set skill radar
    submission.evaluation.skillRadar = {
      requirements: submission.evaluation.requirements?.score || 0,
      estimation: submission.evaluation.capacityEstimation?.score || 0,
      modeling: submission.evaluation.coreEntities?.score || 0,
      apiDesign: submission.evaluation.apiDesign?.score || 0,
      architecture: submission.evaluation.architecture?.score || 0,
      databases: submission.evaluation.databaseDesign?.score || 0,
      scaling: submission.evaluation.scalingStrategy?.score || 0,
      tradeoffs: submission.evaluation.tradeoffs?.score || 0
    };

    submission.evaluation.overallFeedback = result.overallFeedback || '';

    // Generate follow-up questions if enabled
    if (problem.evaluationConfig?.enableFollowUp && result.followUpQuestions) {
      submission.followUpQuestions = result.followUpQuestions.map(q => ({
        question: q,
        answer: '',
        score: 0,
        feedback: ''
      }));
      submission.status = 'follow_up';
    } else {
      submission.status = 'evaluated';
    }

    submission.markModified('evaluation');
    submission.markModified('followUpQuestions');
    await submission.save();

    // Update problem stats
    if (submission.status === 'evaluated') {
      await SystemDesignProblem.findByIdAndUpdate(submission.problemId, {
        $inc: { totalEvaluated: 1 }
      });
    }
  } catch (error) {
    console.error('Evaluation error for submission:', submissionId, error);
    // Mark as evaluated with error
    await SystemDesignSubmission.findByIdAndUpdate(submissionId, {
      status: 'evaluated',
      'evaluation.overallFeedback': 'Evaluation encountered an error. Please contact your administrator.'
    });
  }
}

/**
 * POST /api/system-design-submissions/:submissionId/follow-up-answer
 * Submit answer to a follow-up question
 */
router.post('/:submissionId/follow-up-answer', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { questionIndex, answer } = req.body;
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      studentId: req.user._id,
      status: 'follow_up'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found or not in follow-up phase' });
    }

    if (questionIndex < 0 || questionIndex >= submission.followUpQuestions.length) {
      return res.status(400).json({ success: false, message: 'Invalid question index' });
    }

    submission.followUpQuestions[questionIndex].answer = answer;
    submission.followUpQuestions[questionIndex].answeredAt = new Date();

    // Evaluate the follow-up answer
    const problem = await SystemDesignProblem.findById(submission.problemId);
    const { evaluateFollowUpAnswer } = require('../utils/systemDesignEvaluator');

    const evalResult = await evaluateFollowUpAnswer(
      submission.followUpQuestions[questionIndex].question,
      answer,
      submission.sections,
      problem
    );

    submission.followUpQuestions[questionIndex].score = evalResult.score;
    submission.followUpQuestions[questionIndex].feedback = evalResult.feedback;

    // Check if all follow-ups answered
    const allAnswered = submission.followUpQuestions.every(q => q.answer);
    if (allAnswered) {
      // Calculate follow-up score
      const avgFollowUp = submission.followUpQuestions.reduce((sum, q) => sum + q.score, 0)
        / submission.followUpQuestions.length;
      submission.evaluation.followUpScore = Math.round(avgFollowUp * 10) / 10;
      submission.status = 'evaluated';

      await SystemDesignProblem.findByIdAndUpdate(submission.problemId, {
        $inc: { totalEvaluated: 1 }
      });
    }

    submission.markModified('followUpQuestions');
    submission.markModified('evaluation');
    await submission.save();

    res.json({
      success: true,
      score: evalResult.score,
      feedback: evalResult.feedback,
      allAnswered,
      followUpScore: allAnswered ? submission.evaluation.followUpScore : undefined
    });
  } catch (error) {
    console.error('Error answering follow-up:', error);
    res.status(500).json({ success: false, message: 'Failed to process follow-up answer' });
  }
});

/**
 * GET /api/system-design-submissions/my-submissions
 * Get all submissions for current student
 */
router.get('/my-submissions', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const submissions = await SystemDesignSubmission.find({ studentId: req.user._id })
      .populate('problemId', 'title category difficulty duration')
      .select('problemId status totalScore percentage currentStep startedAt submittedAt')
      .sort({ updatedAt: -1 });

    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submissions' });
  }
});

/**
 * GET /api/system-design-submissions/:submissionId
 * Get submission details
 */
router.get('/:submissionId', authenticateToken, async (req, res) => {
  try {
    const query = { _id: req.params.submissionId };

    // Students can only see their own
    if (req.user.role === 'student') {
      query.studentId = req.user._id;
    } else if (req.user.role === 'vendor_admin') {
      query.vendorId = req.user.vendorId;
    }

    const submission = await SystemDesignSubmission.findOne(query)
      .populate('problemId')
      .populate('studentId', 'name email');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // For evaluation results, include reference answer for comparison (admin or evaluated student)
    let referenceAnswer = null;
    if (submission.status === 'evaluated' || req.user.role === 'vendor_admin') {
      const problem = await SystemDesignProblem.findById(submission.problemId._id || submission.problemId)
        .select('referenceAnswer sectionWeights');
      referenceAnswer = problem?.referenceAnswer;
    }

    res.json({
      success: true,
      submission,
      referenceAnswer
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch submission' });
  }
});

/**
 * PUT /api/system-design-submissions/:submissionId/override
 * Manual score override (admin)
 */
router.put('/:submissionId/override', authenticateToken, authorizeRoles('vendor_admin'), async (req, res) => {
  try {
    const { section, score, feedback } = req.body;
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      vendorId: req.user.vendorId
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Update the override
    if (!submission.manualOverride.overrides) {
      submission.manualOverride.overrides = [];
    }

    const existingIdx = submission.manualOverride.overrides.findIndex(o => o.section === section);
    if (existingIdx >= 0) {
      submission.manualOverride.overrides[existingIdx] = { section, score, feedback };
    } else {
      submission.manualOverride.overrides.push({ section, score, feedback });
    }

    submission.manualOverride.isManual = true;
    submission.manualOverride.updatedBy = req.user._id;
    submission.manualOverride.updatedAt = new Date();

    // Update the section score
    if (submission.evaluation[section]) {
      submission.evaluation[section].score = score;
      if (feedback) submission.evaluation[section].feedback = feedback;
    }

    // Recalculate total score
    const problem = await SystemDesignProblem.findById(submission.problemId);
    const sectionNames = [
      'requirements', 'capacityEstimation', 'coreEntities', 'apiDesign',
      'architecture', 'dataFlow', 'databaseDesign', 'scalingStrategy',
      'deepDive', 'tradeoffs'
    ];

    let totalWeightedScore = 0;
    let totalWeight = 0;
    sectionNames.forEach(s => {
      const weight = problem.sectionWeights[s] || 0;
      const sScore = submission.evaluation[s]?.score || 0;
      totalWeightedScore += (sScore / 10) * weight;
      totalWeight += weight;
    });

    const rawPercentage = totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
    const finalPercentage = Math.max(0, rawPercentage - (submission.evaluation.hintPenalty || 0));
    submission.totalScore = Math.round(finalPercentage);
    submission.percentage = Math.round(finalPercentage * 10) / 10;

    submission.markModified('evaluation');
    submission.markModified('manualOverride');
    await submission.save();

    res.json({
      success: true,
      message: 'Score overridden successfully',
      totalScore: submission.totalScore,
      percentage: submission.percentage
    });
  } catch (error) {
    console.error('Error overriding score:', error);
    res.status(500).json({ success: false, message: 'Failed to override score' });
  }
});

/**
 * POST /api/system-design-submissions/:submissionId/violation
 * Report exam violation
 */
router.post('/:submissionId/violation', authenticateToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { type, details } = req.body;
    const submission = await SystemDesignSubmission.findOne({
      _id: req.params.submissionId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const { MAX_VIOLATIONS, normalizeViolationType } = require('../utils/examViolations');

    submission.violations.push({
      type: normalizeViolationType(type),
      details: details || '',
      timestamp: new Date()
    });
    submission.violationCount = submission.violations.length;

    // Auto-submit if too many violations
    if (submission.violationCount >= MAX_VIOLATIONS) {
      submission.status = 'submitted';
      submission.submittedAt = new Date();
      submission.autoSubmitted = true;
      submission.timeSpent = Math.round((submission.submittedAt - submission.startedAt) / 1000);

      await submission.save();

      // Trigger evaluation
      evaluateSubmission(submission._id).catch(err => {
        console.error('Background evaluation error:', err);
      });

      return res.json({
        success: true,
        message: 'Auto-submitted due to violations',
        autoSubmitted: true,
        violationCount: submission.violationCount
      });
    }

    await submission.save();

    res.json({
      success: true,
      violationCount: submission.violationCount,
      maxViolations: MAX_VIOLATIONS,
      autoSubmitted: false
    });
  } catch (error) {
    console.error('Error recording violation:', error);
    res.status(500).json({ success: false, message: 'Failed to record violation' });
  }
});

module.exports = router;
