function sanitizePracticeQuestion(q) {
  if (!q) return null;
  const obj = typeof q.toObject === 'function' ? q.toObject() : { ...q };
  delete obj.solution;
  if (Array.isArray(obj.testCases)) {
    obj.testCases = obj.testCases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.isHidden ? undefined : tc.expectedOutput,
      isHidden: !!tc.isHidden,
      points: tc.points,
    }));
  }
  return obj;
}

function sanitizePracticeQuestionList(q) {
  const obj = sanitizePracticeQuestion(q);
  if (!obj) return null;
  delete obj.testCases;
  return obj;
}

module.exports = {
  sanitizePracticeQuestion,
  sanitizePracticeQuestionList,
};
