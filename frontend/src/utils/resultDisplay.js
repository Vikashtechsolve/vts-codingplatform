export const RESULT_DISPLAY = {
  DETAILED: 'detailed',
  SCORE_ONLY: 'score_only',
};

export const SCORE_ONLY_TEST_TYPES = ['coding', 'mixed'];

export function getResultDisplay(test) {
  const type = test?.type;
  if (!SCORE_ONLY_TEST_TYPES.includes(type)) {
    return RESULT_DISPLAY.DETAILED;
  }
  return test?.settings?.resultDisplay === RESULT_DISPLAY.SCORE_ONLY
    ? RESULT_DISPLAY.SCORE_ONLY
    : RESULT_DISPLAY.DETAILED;
}

export function isScoreOnlyResult(test, result) {
  if (result?.resultDisplay === RESULT_DISPLAY.SCORE_ONLY) {
    return true;
  }
  return getResultDisplay(test) === RESULT_DISPLAY.SCORE_ONLY;
}

export function supportsResultDisplayOption(testType) {
  return SCORE_ONLY_TEST_TYPES.includes(testType);
}
