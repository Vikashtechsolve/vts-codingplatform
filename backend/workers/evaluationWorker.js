const Queue = require('bull');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const Assignment = require('../models/Assignment');
const ProjectSubmission = require('../models/ProjectSubmission');
const EvaluationJob = require('../models/EvaluationJob');
const EvaluationResult = require('../models/EvaluationResult');
const User = require('../models/User');
const githubCloner = require('../utils/githubCloner');
const aiEvaluator = require('../utils/aiEvaluator');
const scoringEngine = require('../utils/scoringEngine');
const { getBullQueueOptions } = require('../config/redis');

const evaluationQueue = new Queue('project-evaluation', getBullQueueOptions());

evaluationQueue.on('ready', () => {
  console.log('✅ Redis: Connected. Evaluation queue ready.');
});

let lastErrorLog = 0;
const ERROR_LOG_INTERVAL_MS = 60000;
evaluationQueue.on('error', (err) => {
  const now = Date.now();
  if (now - lastErrorLog > ERROR_LOG_INTERVAL_MS) {
    lastErrorLog = now;
    const msg = err.message || String(err);
    console.error('❌ Redis: Connection error:', msg);
    console.error('   Ensure REDIS_URL is set correctly (Railway public URL).');
  }
});

/**
 * Process evaluation job
 */
evaluationQueue.process(async (job) => {
  const { submissionId } = job.data;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting evaluation for submission: ${submissionId}`);
  console.log(`${'='.repeat(60)}\n`);

  let evaluationJob = null;
  let repoPath = null;
  let importantFiles = [];
  let coreFiles = [];

  try {
    // Update job progress
    await job.progress(5);

    // Get evaluation job (cast to ObjectId for reliable lookup)
    const submissionObjId = mongoose.Types.ObjectId.isValid(submissionId)
      ? new mongoose.Types.ObjectId(submissionId)
      : submissionId;
    evaluationJob = await EvaluationJob.findOne({ submissionId: submissionObjId });
    if (!evaluationJob) {
      throw new Error('Evaluation job not found');
    }

    // Update job status
    evaluationJob.status = 'processing';
    evaluationJob.startedAt = new Date();
    await evaluationJob.save();

    // Get submission and assignment
    const submission = await ProjectSubmission.findById(submissionId);
    const assignment = await Assignment.findById(submission.assignmentId);

    if (!submission || !assignment) {
      throw new Error('Submission or assignment not found');
    }

    // Update submission status
    submission.status = 'evaluating';
    await submission.save();

    await job.progress(10);

    // ==========================================
    // STEP 1: Clone Repository
    // ==========================================
    console.log('📥 Step 1: Cloning repository...');
    evaluationJob.processingSteps.repoCloning.status = 'in_progress';
    evaluationJob.processingSteps.repoCloning.startedAt = new Date();
    await evaluationJob.save();

    try {
      const cloneResult = await githubCloner.cloneRepository(
        submission.githubRepoUrl,
        submission.branchName,
        submissionId.toString()
      );

      repoPath = cloneResult.path;

      // Update submission with metadata
      submission.repositoryValidation = submission.repositoryValidation || {};
      submission.repositoryValidation.commitCount = cloneResult.metadata.commitCount;
      const lastCommitAt = cloneResult.metadata?.lastCommit?.date
        ? new Date(cloneResult.metadata.lastCommit.date)
        : null;
      submission.repositoryValidation.lastCommitAt = lastCommitAt;
      submission.repositoryValidation.lastCommitHash = cloneResult.metadata.lastCommit?.hash;
      submission.repositoryValidation.lastCommitMessage = cloneResult.metadata.lastCommit?.message;

      // Late commit detection: compare last commit time with timer end
      const timerEndAt = submission.timerEndAt ? new Date(submission.timerEndAt) : null;
      let latePenaltyMarks = 0;
      let lateCommitMinutes = 0;
      let lateCommitsList = [];

      if (lastCommitAt && timerEndAt && lastCommitAt > timerEndAt) {
        lateCommitMinutes = Math.round(((lastCommitAt - timerEndAt) / (1000 * 60)) * 10) / 10;
        if (lateCommitMinutes <= 5) {
          latePenaltyMarks = 10;
        } else if (lateCommitMinutes <= 10) {
          latePenaltyMarks = 20;
        } else {
          latePenaltyMarks = assignment.totalMarks; // Results in 0 marks
        }
        submission.latePenaltyMarks = latePenaltyMarks;
        submission.lateSubmissionMinutes = lateCommitMinutes;
        submission.isLateSubmission = true;

        // Get commit log to identify all late commits
        const commitLog = await githubCloner.getCommitLog(repoPath, 100);
        lateCommitsList = commitLog
          .filter(c => new Date(c.date) > timerEndAt)
          .map(c => ({
            hash: c.hash,
            date: new Date(c.date),
            message: c.message,
            author: c.author,
            minutesAfterTimer: Math.round(((new Date(c.date) - timerEndAt) / (1000 * 60)) * 10) / 10
          }));
      }
      submission.lateCommitsData = lateCommitsList;
      await submission.save();

      evaluationJob.processingSteps.repoCloning.status = 'completed';
      evaluationJob.processingSteps.repoCloning.completedAt = new Date();
      await evaluationJob.save();

      console.log('✅ Repository cloned successfully');
    } catch (error) {
      evaluationJob.processingSteps.repoCloning.status = 'failed';
      evaluationJob.processingSteps.repoCloning.error = error.message;
      await evaluationJob.save();
      throw error;
    }

    await job.progress(25);

    // ==========================================
    // STEP 2: Repository Analysis
    // ==========================================
    console.log('🔍 Step 2: Analyzing repository...');
    evaluationJob.processingSteps.repoAnalysis.status = 'in_progress';
    evaluationJob.processingSteps.repoAnalysis.startedAt = new Date();
    await evaluationJob.save();

    try {
      // Validate repository
      const validation = await githubCloner.validateRepository(
        repoPath,
        assignment.repositoryRules
      );

      // Get folder structure
      const folderStructure = await githubCloner.getFolderStructure(repoPath);

      // Detect tech stack
      const techStack = await githubCloner.detectTechStack(repoPath);

      // Count lines of code
      const locStats = await githubCloner.countLinesOfCode(repoPath);

      // Get important files (stored in outer scope for Step 3/4)
      importantFiles = await githubCloner.getImportantFiles(repoPath);

      // Get core files
      coreFiles = await githubCloner.getCoreFiles(repoPath);

      // Update submission with analysis
      submission.repositoryValidation = {
        ...submission.repositoryValidation,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
        branchExists: true,
        hasReadme: validation.checks.hasReadme,
        hasEnvExample: validation.checks.hasEnvExample,
        containsSecrets: validation.checks.containsSecrets
      };

      submission.repositoryAnalysis = {
        folderStructure,
        detectedTechStack: techStack,
        fileCount: locStats.fileCount,
        linesOfCode: locStats.totalLines,
        packageFiles: importantFiles,
        coreFiles: coreFiles.map(f => ({
          path: f.path,
          content: f.content.substring(0, 1000), // Limit stored content
          size: f.size
        }))
      };

      await submission.save();

      evaluationJob.processingSteps.repoAnalysis.status = 'completed';
      evaluationJob.processingSteps.repoAnalysis.completedAt = new Date();
      await evaluationJob.save();

      console.log('✅ Repository analysis completed');
      console.log(`   Tech Stack: ${techStack.join(', ')}`);
      console.log(`   Files: ${locStats.fileCount}, LOC: ${locStats.totalLines}`);
    } catch (error) {
      evaluationJob.processingSteps.repoAnalysis.status = 'failed';
      evaluationJob.processingSteps.repoAnalysis.error = error.message;
      await evaluationJob.save();
      throw error;
    }

    await job.progress(50);

    // ==========================================
    // STEP 3: AI Evaluation
    // ==========================================
    console.log('🤖 Step 3: Running AI evaluation...');
    evaluationJob.processingSteps.aiEvaluation.status = 'in_progress';
    evaluationJob.processingSteps.aiEvaluation.startedAt = new Date();
    await evaluationJob.save();

    let aiEvalResult;
    try {
      aiEvalResult = await aiEvaluator.evaluateProject({
        assignment: assignment.toObject(),
        repositoryAnalysis: submission.repositoryAnalysis,
        folderStructure: submission.repositoryAnalysis.folderStructure,
        importantFiles: importantFiles,
        coreFiles: coreFiles
      });

      evaluationJob.processingSteps.aiEvaluation.status = 'completed';
      evaluationJob.processingSteps.aiEvaluation.completedAt = new Date();
      evaluationJob.processingSteps.aiEvaluation.tokensUsed = aiEvalResult.tokensUsed;
      evaluationJob.processingSteps.aiEvaluation.cost = parseFloat(aiEvalResult.cost.totalCost);
      await evaluationJob.save();

      console.log('✅ AI evaluation completed');
      console.log(`   Tokens used: ${aiEvalResult.tokensUsed}`);
      console.log(`   Cost: $${aiEvalResult.cost.totalCost}`);
    } catch (error) {
      evaluationJob.processingSteps.aiEvaluation.status = 'failed';
      evaluationJob.processingSteps.aiEvaluation.error = error.message;
      await evaluationJob.save();
      throw error;
    }

    await job.progress(75);

    // ==========================================
    // STEP 4: Additional Evaluations
    // ==========================================
    console.log('📊 Step 4: Running additional evaluations...');

    // Evaluate git practices
    let gitAnalysis = null;
    try {
      const simpleGit = require('simple-git');
      const git = simpleGit(repoPath);
      const log = await git.log();
      
      const commits = log.all.map(commit => ({
        hash: commit.hash,
        message: commit.message,
        date: commit.date
      }));

      const gitEval = await aiEvaluator.evaluateGitPractices(commits);

      gitAnalysis = {
        commitQuality: {
          score: gitEval.qualityScore || 5,
          goodCommits: gitEval.goodCommits || 0,
          poorCommits: gitEval.poorCommits || 0,
          examples: gitEval.examples || []
        },
        branchingStrategy: {
          score: 8,
          analysis: 'Standard branching used'
        },
        commitFrequency: {
          score: 8,
          totalCommits: commits.length,
          commitsPerDay: 0
        }
      };
    } catch (error) {
      console.error('Git analysis error:', error);
    }

    // Evaluate documentation
    let documentationAnalysis = null;
    try {
      const readmeFile = importantFiles.find(f => 
        f.name.toLowerCase().includes('readme')
      );

      if (readmeFile) {
        const readmeEval = await aiEvaluator.evaluateReadme(readmeFile.content);

        documentationAnalysis = {
          readmeQuality: {
            score: readmeEval.score || 5,
            hasSetupInstructions: readmeEval.hasSetupInstructions || false,
            hasFeatureDescription: readmeEval.hasFeatureDescription || false,
            hasUsageExamples: readmeEval.hasUsageExamples || false,
            hasDependencies: readmeEval.hasDependencies || false,
            feedback: readmeEval.feedback || ''
          },
          codeComments: {
            score: 7,
            commentedFunctions: 0,
            totalFunctions: 0,
            quality: 'Good'
          }
        };
      }
    } catch (error) {
      console.error('Documentation analysis error:', error);
    }

    await job.progress(85);

    // ==========================================
    // STEP 5: Calculate Final Score
    // ==========================================
    console.log('🎯 Step 5: Calculating final score...');
    evaluationJob.processingSteps.scoring.status = 'in_progress';
    evaluationJob.processingSteps.scoring.startedAt = new Date();
    await evaluationJob.save();

    try {
      const finalResult = scoringEngine.calculateFinalScore({
        assignment: assignment.toObject(),
        aiEvaluation: aiEvalResult.evaluation,
        repositoryValidation: submission.repositoryValidation,
        gitAnalysis,
        documentationAnalysis
      });

      let totalScore = finalResult.totalScore;
      const latePenalty = submission.latePenaltyMarks || 0;
      if (latePenalty > 0) {
        totalScore = Math.max(0, totalScore - latePenalty);
      }
      const totalPossibleScore = finalResult.totalPossibleScore;
      const percentage = totalPossibleScore > 0
        ? Math.round((totalScore / totalPossibleScore) * 10000) / 100
        : 0;
      const grade = scoringEngine._calculateGrade(percentage);

      const overallFeedbackWithPenalty = { ...(finalResult.overallFeedback || {}) };
      const lateMinutes = submission.lateSubmissionMinutes || 0;
      const displayPenalty = latePenalty >= assignment.totalMarks ? assignment.totalMarks : latePenalty;
      if (latePenalty > 0) {
        const penaltyReason = lateMinutes > 10
          ? `Commits made ${lateMinutes} min after timer ended. No marks awarded.`
          : `${displayPenalty} marks deducted for late commits (last commit was ${lateMinutes} min after timer ended).`;
        overallFeedbackWithPenalty.summary = (overallFeedbackWithPenalty.summary || '') +
          `\n\n⚠️ Late commit penalty: ${penaltyReason}`;
      }

      // Build commit analysis for feedback
      const timerEndAt = submission.timerEndAt ? new Date(submission.timerEndAt) : null;
      const lastCommitAt = submission.repositoryValidation?.lastCommitAt;
      const commitAnalysis = {
        totalCommits: submission.repositoryValidation?.commitCount || 0,
        lastCommitAt,
        lastCommitHash: submission.repositoryValidation?.lastCommitHash,
        lastCommitMessage: submission.repositoryValidation?.lastCommitMessage,
        timerEndAt,
        hasLateCommits: latePenalty > 0,
        minutesLate: lateMinutes,
        latePenaltyMarks: displayPenalty,
        lateCommits: (submission.lateCommitsData || []).map(c => ({
          hash: c.hash,
          date: c.date,
          message: c.message,
          author: c.author,
          minutesAfterTimer: c.minutesAfterTimer
        })),
        summary: latePenalty > 0
          ? `Your last commit was made ${lateMinutes} minutes after the timer ended. ${displayPenalty >= assignment.totalMarks ? 'No marks awarded.' : `${displayPenalty} marks deducted.`}`
          : 'All commits were made before the timer ended. No penalty applied.'
      };

      // Calculate time spent
      const timeSpent = submission.submittedAt && submission.startedAt
        ? (submission.submittedAt - submission.startedAt) / (1000 * 60) // minutes
        : null;

      // Create evaluation result
      const evaluationResult = new EvaluationResult({
        submissionId: submission._id,
        assignmentId: assignment._id,
        studentId: submission.studentId,
        evaluationJobId: evaluationJob._id,
        totalScore,
        totalPossibleScore,
        percentage,
        grade,
        categoryScores: finalResult.categoryScores,
        featureEvaluation: finalResult.featureEvaluation,
        aiAnalysis: finalResult.aiAnalysis,
        gitAnalysis: finalResult.gitAnalysis,
        documentationAnalysis: finalResult.documentationAnalysis,
        timeAnalysis: timeSpent ? {
          timeSpent: Math.round(timeSpent),
          efficiency: latePenalty > 0 ? 'Late commits' : 'Good',
          timeManagement: latePenalty > 0
            ? `Last commit ${lateMinutes} min after timer (-${displayPenalty} marks)`
            : 'Completed on time'
        } : undefined,
        commitAnalysis,
        overallFeedback: overallFeedbackWithPenalty,
        evaluatedAt: new Date(),
        aiModel: 'gpt-4-turbo'
      });

      await evaluationResult.save();

      // Update evaluation job
      evaluationJob.status = 'completed';
      evaluationJob.completedAt = new Date();
      evaluationJob.evaluationResultId = evaluationResult._id;
      evaluationJob.processingSteps.scoring.status = 'completed';
      evaluationJob.processingSteps.scoring.completedAt = new Date();
      
      const executionTime = (evaluationJob.completedAt - evaluationJob.startedAt) / 1000;
      evaluationJob.executionTime = executionTime;
      
      await evaluationJob.save();

      // Update submission
      submission.status = 'evaluated';
      await submission.save();

      // Update user enrollment status
      await User.updateOne(
        { 
          _id: submission.studentId,
          'enrolledAssignments.assignmentId': assignment._id 
        },
        {
          $set: {
            'enrolledAssignments.$.status': 'evaluated',
            'enrolledAssignments.$.submittedAt': submission.submittedAt
          }
        }
      );

      // Update assignment statistics
      await Assignment.updateOne(
        { _id: assignment._id },
        { $inc: { totalEvaluated: 1 } }
      );

      console.log('✅ Scoring completed');
      if (latePenalty > 0) {
        console.log(`   Late penalty: -${latePenalty} marks`);
      }
      console.log(`   Total Score: ${totalScore}/${totalPossibleScore}`);
      console.log(`   Percentage: ${percentage}%`);
      console.log(`   Grade: ${grade}`);

    } catch (error) {
      evaluationJob.processingSteps.scoring.status = 'failed';
      evaluationJob.processingSteps.scoring.error = error.message;
      await evaluationJob.save();
      throw error;
    }

    await job.progress(100);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Evaluation completed successfully for submission: ${submissionId}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      submissionId,
      evaluationJobId: evaluationJob._id
    };

  } catch (error) {
    console.error(`\n❌ Evaluation failed for submission: ${submissionId}`);
    console.error(`Error: ${error.message}\n`);

    // Update evaluation job with error
    if (evaluationJob) {
      evaluationJob.status = 'failed';
      evaluationJob.completedAt = new Date();
      evaluationJob.error = error.message;
      evaluationJob.errorDetails = {
        message: error.message,
        stack: error.stack
      };
      evaluationJob.retryCount += 1;
      await evaluationJob.save();
    }

    // Update submission status
    try {
      await ProjectSubmission.updateOne(
        { _id: submissionId },
        { status: 'failed' }
      );
    } catch (updateError) {
      console.error('Failed to update submission status:', updateError);
    }

    throw error;

  } finally {
    // Cleanup: Remove cloned repository
    if (repoPath) {
      try {
        await githubCloner.cleanupRepo(submissionId.toString());
        console.log('🧹 Cleanup completed');
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
  }
});

// Queue event handlers
evaluationQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completed:`, result);
});

evaluationQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

evaluationQueue.on('stalled', (job) => {
  console.warn(`⚠️  Job ${job.id} stalled`);
});

/**
 * Add evaluation job to queue
 * @param {string} submissionId - Submission ID
 * @param {number} priority - Job priority (1-10)
 * @param {number} delayMs - Delay in milliseconds before job runs (for delayed evaluation)
 */
async function addEvaluationJob(submissionId, priority = 5, delayMs = 0) {
  const opts = { priority, jobId: submissionId.toString() };
  if (delayMs > 0) {
    opts.delay = delayMs;
  }
  const job = await evaluationQueue.add({ submissionId }, opts);

  console.log(`📋 Evaluation job added to queue: ${job.id}${delayMs > 0 ? ` (delayed ${Math.round(delayMs / 60000)} min)` : ''}`);
  return job;
}

/**
 * Get queue statistics
 */
async function getQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    evaluationQueue.getWaitingCount(),
    evaluationQueue.getActiveCount(),
    evaluationQueue.getCompletedCount(),
    evaluationQueue.getFailedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed
  };
}

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  console.log('📴 SIGTERM received, closing worker gracefully...');
  await evaluationQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, closing worker gracefully...');
  await evaluationQueue.close();
  process.exit(0);
});

// Connect to MongoDB if not already connected
if (mongoose.connection.readyState === 0) {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/coding-platform';
  console.log('🔌 Connecting to MongoDB...');
  
  mongoose.connect(mongoURI)
    .then(() => {
      console.log('✅ MongoDB Connected (Worker)');
      console.log('🎯 Evaluation worker ready and waiting for jobs...');
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      process.exit(1);
    });
} else {
  console.log('✅ MongoDB already connected');
  console.log('🎯 Evaluation worker ready and waiting for jobs...');
}

module.exports = {
  evaluationQueue,
  addEvaluationJob,
  getQueueStats
};
