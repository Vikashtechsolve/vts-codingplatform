const { scoreFromResult } = require('./courseScorecard');

const DONE_STATUSES = ['completed', 'timeout'];

function resultTime(result) {
  const raw = result?.submittedAt || result?.createdAt;
  const ms = raw ? new Date(raw).getTime() : Number.NaN;
  return Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER;
}

function isDoneQuizResult(result) {
  return result && DONE_STATUSES.includes(result.status);
}

/** Earliest completed/timeout result is the official (first) attempt. */
function pickOfficialQuizResult(results = [], scope = null) {
  const done = results.filter(isDoneQuizResult);
  if (!done.length) return null;
  let pool = done;
  if (scope?.courseId && scope?.moduleId) {
    const stamped = done.filter(
      (r) =>
        r.courseId &&
        r.moduleId &&
        String(r.courseId) === String(scope.courseId) &&
        String(r.moduleId) === String(scope.moduleId)
    );
    if (stamped.length) pool = stamped;
  }
  return [...pool].sort((a, b) => {
    const dt = resultTime(a) - resultTime(b);
    if (dt !== 0) return dt;
    return String(a._id).localeCompare(String(b._id));
  })[0];
}

/**
 * Persist first-attempt score on module progress. Later results are practice.
 * Re-syncing the official result must not clobber latestResultId from a practice run.
 */
function applyOfficialQuizProgress(modProg, { currentResult, officialResult, attemptCount }) {
  if (!modProg || !currentResult || !officialResult) {
    throw new Error('quiz progress requires current and official results');
  }

  const officialScore = scoreFromResult(officialResult);
  const thisAttempt = scoreFromResult(currentResult);
  const practice = String(currentResult._id) !== String(officialResult._id);
  const duplicate =
    String(modProg.resultId || '') === String(officialResult._id) &&
    modProg.quizStatus === 'submitted' &&
    String(modProg.latestResultId || '') === String(currentResult._id);

  modProg.quizStatus = 'submitted';
  modProg.resultId = officialResult._id;
  if (!modProg.submittedAt) {
    modProg.submittedAt = officialResult.submittedAt || new Date();
  }
  if (officialScore) {
    modProg.quizScore = officialScore.totalScore;
    modProg.quizMaxScore = officialScore.maxScore;
    modProg.quizPercentage = officialScore.percentage;
  }
  if (practice) {
    modProg.latestResultId = currentResult._id;
  } else if (!modProg.latestResultId) {
    modProg.latestResultId = officialResult._id;
  }
  if (Number.isFinite(Number(attemptCount))) {
    modProg.quizAttemptCount = Number(attemptCount);
  }

  return {
    duplicate,
    practice,
    quizScore: officialScore,
    thisAttempt,
    attemptCount: modProg.quizAttemptCount || 0,
    officialResultId: officialResult._id,
  };
}

module.exports = {
  DONE_STATUSES,
  pickOfficialQuizResult,
  applyOfficialQuizProgress,
};
