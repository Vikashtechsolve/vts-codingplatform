/** Default marks per interview question (matches InterviewQuestion.points). */
const DEFAULT_INTERVIEW_QUESTION_POINTS = 10;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/** Convert AI rubric percent (0–100) to question marks with partial-credit floor. */
function percentToInterviewPoints(percent, maxPoints = DEFAULT_INTERVIEW_QUESTION_POINTS) {
  const pct = clamp(Number(percent) || 0, 0, 100);
  const max = Number(maxPoints) > 0 ? Number(maxPoints) : DEFAULT_INTERVIEW_QUESTION_POINTS;
  if (pct <= 0) return 0;

  const raw = (pct / 100) * max;
  // Award at least 1 mark when the rubric shows a partial attempt (>= 15%).
  if (pct >= 15 && raw > 0 && raw < 0.75) return 1;
  return Math.round(raw);
}

/** Points display for one interview answer. */
function getInterviewAnswerScoreDisplay(answer) {
  const maxPoints = answer?.maxPoints ?? DEFAULT_INTERVIEW_QUESTION_POINTS;
  const percent = answer?.evaluation?.overall;
  const points =
    answer?.points != null && Number.isFinite(Number(answer.points))
      ? Math.round(Number(answer.points))
      : percentToInterviewPoints(percent, maxPoints);

  return {
    points,
    maxPoints,
    percent: Number.isFinite(Number(percent)) ? Math.round(Number(percent)) : null
  };
}

/** Sum earned marks across all answers in a session. */
function computeSessionMarksTotals(answers = []) {
  let totalPoints = 0;
  let totalMax = 0;

  (answers || []).forEach((answer) => {
    const { points, maxPoints } = getInterviewAnswerScoreDisplay(answer);
    totalPoints += points;
    totalMax += maxPoints;
  });

  const percent = totalMax > 0 ? Math.round((totalPoints / totalMax) * 100) : 0;
  return { totalPoints, totalMax, percent };
}

module.exports = {
  DEFAULT_INTERVIEW_QUESTION_POINTS,
  percentToInterviewPoints,
  getInterviewAnswerScoreDisplay,
  computeSessionMarksTotals
};
