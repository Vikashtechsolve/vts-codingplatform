const Result = require('../models/Result');
const InterviewSession = require('../models/InterviewSession');
const ProjectSubmission = require('../models/ProjectSubmission');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const EvaluationJob = require('../models/EvaluationJob');
const { scoreFromResult } = require('./courseScorecard');

function roundPct(score, max) {
  const s = Number(score) || 0;
  const m = Number(max) || 0;
  if (m <= 0) return 0;
  return Math.round((s / m) * 100);
}

function scoreFromInterviewSession(session) {
  if (!session) return null;
  const pct = Math.round(Number(session.readinessPercent) || Number(session.overallScore) || 0);
  return {
    resultId: session._id,
    totalScore: pct,
    maxScore: 100,
    percentage: pct,
  };
}

async function scoreFromProjectSubmission(submission, assignment) {
  if (!submission) return null;
  const maxScore = Number(assignment?.totalMarks) || 100;
  let totalScore = 0;
  if (submission.evaluationJobId) {
    const job = await EvaluationJob.findById(submission.evaluationJobId)
      .select('result totalScore percentage')
      .lean();
    if (job?.totalScore != null) totalScore = Number(job.totalScore);
    else if (job?.result?.totalScore != null) totalScore = Number(job.result.totalScore);
    else if (job?.percentage != null) totalScore = Math.round((Number(job.percentage) / 100) * maxScore);
  }
  const pct = maxScore > 0 ? roundPct(totalScore, maxScore) : 0;
  return {
    resultId: submission._id,
    totalScore,
    maxScore,
    percentage: pct,
  };
}

function scoreFromSystemDesignSubmission(submission) {
  if (!submission) return null;
  const totalScore = Number(submission.totalScore) || 0;
  const maxScore = 100;
  const pct = Math.round(Number(submission.percentage) || roundPct(totalScore, maxScore));
  return {
    resultId: submission._id,
    totalScore,
    maxScore,
    percentage: pct,
  };
}

async function loadOfficialSubmissionScore(assessmentType, submissionId, extras = {}) {
  if (!submissionId) return null;
  if (assessmentType === 'test') {
    const result = await Result.findById(submissionId)
      .select('totalScore maxScore percentage status')
      .lean();
    return scoreFromResult(result);
  }
  if (assessmentType === 'interview') {
    const session = await InterviewSession.findById(submissionId)
      .select('overallScore readinessPercent status')
      .lean();
    return scoreFromInterviewSession(session);
  }
  if (assessmentType === 'assignment') {
    const submission = await ProjectSubmission.findById(submissionId).lean();
    return scoreFromProjectSubmission(submission, extras.assignment);
  }
  if (assessmentType === 'system_design') {
    const submission = await SystemDesignSubmission.findById(submissionId)
      .select('totalScore percentage status')
      .lean();
    return scoreFromSystemDesignSubmission(submission);
  }
  return null;
}

/**
 * Persist first-attempt module assessment on progress (tests use resultId; others use submissionId).
 */
function applyOfficialAssessmentProgress(modProg, {
  assessmentType,
  currentSubmissionId,
  officialSubmissionId,
  quizScore,
  attemptCount,
}) {
  const practice =
    officialSubmissionId &&
    currentSubmissionId &&
    String(currentSubmissionId) !== String(officialSubmissionId);

  modProg.quizStatus = 'submitted';
  modProg.assessmentType = assessmentType;
  if (assessmentType === 'test') {
    modProg.resultId = officialSubmissionId;
    if (!practice) modProg.latestResultId = officialSubmissionId;
    else modProg.latestResultId = currentSubmissionId;
  } else {
    modProg.submissionId = officialSubmissionId;
    modProg.resultId = null;
    if (!practice) modProg.latestResultId = officialSubmissionId;
    else modProg.latestResultId = currentSubmissionId;
  }
  if (!modProg.submittedAt) modProg.submittedAt = new Date();

  if (quizScore) {
    modProg.quizScore = quizScore.totalScore;
    modProg.quizMaxScore = quizScore.maxScore;
    modProg.quizPercentage = quizScore.percentage;
  }
  if (Number.isFinite(Number(attemptCount))) {
    modProg.quizAttemptCount = Number(attemptCount);
  }

  return { practice, quizScore };
}

module.exports = {
  scoreFromInterviewSession,
  scoreFromProjectSubmission,
  scoreFromSystemDesignSubmission,
  loadOfficialSubmissionScore,
  applyOfficialAssessmentProgress,
};
