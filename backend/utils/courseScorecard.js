function roundPct(score, max) {
  const s = Number(score) || 0;
  const m = Number(max) || 0;
  if (m <= 0) return 0;
  return Math.round((s / m) * 100);
}

function scoreFromResult(result) {
  if (!result) return null;
  const totalScore = Number(result.totalScore) || 0;
  const maxScore = Number(result.maxScore) || 0;
  const percentage =
    maxScore > 0 ? roundPct(totalScore, maxScore) : Math.round(Number(result.percentage) || 0);
  return {
    resultId: result._id || result.resultId || null,
    totalScore,
    maxScore,
    percentage,
  };
}

/**
 * Build per-quiz + overall course scorecard from module payloads.
 * Overall is points-weighted across submitted quizzes only.
 */
function buildCourseScorecard(modules = []) {
  const quizModules = modules.filter((m) => m.hasQuiz);
  let totalScore = 0;
  let maxScore = 0;
  let quizzesSubmitted = 0;

  const quizzes = quizModules.map((mod) => {
    const submitted = mod.quizStatus === 'submitted';
    const score = submitted ? mod.quizScore || null : null;
    if (submitted) quizzesSubmitted += 1;
    if (score && (Number(score.maxScore) || 0) > 0) {
      totalScore += Number(score.totalScore) || 0;
      maxScore += Number(score.maxScore) || 0;
    }
    return {
      moduleId: mod._id,
      title: mod.title,
      status: mod.quizStatus || 'none',
      score,
    };
  });

  return {
    quizzesTotal: quizModules.length,
    quizzesSubmitted,
    totalScore,
    maxScore,
    percentage: roundPct(totalScore, maxScore),
    quizzes,
  };
}

module.exports = {
  roundPct,
  scoreFromResult,
  buildCourseScorecard,
};
