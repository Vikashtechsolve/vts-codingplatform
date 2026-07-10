/** Default marks per interview question (matches InterviewQuestion.points). */
export const DEFAULT_INTERVIEW_QUESTION_POINTS = 10;

/** Convert AI rubric percent (0–100) to question marks. */
export function percentToInterviewPoints(percent, maxPoints = DEFAULT_INTERVIEW_QUESTION_POINTS) {
  const pct = Number(percent);
  if (!Number.isFinite(pct)) return 0;
  const max = Number(maxPoints) > 0 ? Number(maxPoints) : DEFAULT_INTERVIEW_QUESTION_POINTS;
  return Math.round((Math.min(100, Math.max(0, pct)) / 100) * max);
}

/** Points display for one interview answer card. */
export function getInterviewAnswerScoreDisplay(answer) {
  const maxPoints = answer?.maxPoints ?? DEFAULT_INTERVIEW_QUESTION_POINTS;
  const percent = answer?.evaluation?.overall;
  const points =
    answer?.points != null && Number.isFinite(Number(answer.points))
      ? Math.round(Number(answer.points))
      : percentToInterviewPoints(percent, maxPoints);

  return {
    points,
    maxPoints,
    percent: Number.isFinite(Number(percent)) ? Math.round(Number(percent)) : null,
  };
}
