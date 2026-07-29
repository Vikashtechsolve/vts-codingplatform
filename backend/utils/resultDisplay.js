const SCORE_ONLY_TEST_TYPES = ['coding', 'mixed'];

function getResultDisplay(test) {
  const type = test?.type;
  if (!SCORE_ONLY_TEST_TYPES.includes(type)) {
    return 'detailed';
  }
  return test?.settings?.resultDisplay === 'score_only' ? 'score_only' : 'detailed';
}

function isScoreOnlyForStudent(test, userRole) {
  return userRole === 'student' && getResultDisplay(test) === 'score_only';
}

function stripDetailedResultForStudent(out) {
  const sanitized = { ...out };
  sanitized.answers = [];
  sanitized.sectionScores = [];
  sanitized.resultDisplay = 'score_only';
  return sanitized;
}

module.exports = {
  SCORE_ONLY_TEST_TYPES,
  getResultDisplay,
  isScoreOnlyForStudent,
  stripDetailedResultForStudent,
};
