const VALID_CODING_LANGUAGES = ['java', 'cpp', 'c', 'python'];

/**
 * Resolve languages students may use. Some legacy questions store starter code for
 * multiple languages while allowedLanguages in the DB is empty or incomplete.
 */
function getEffectiveAllowedLanguages(question) {
  if (!question) return ['python'];

  const fromField = Array.isArray(question.allowedLanguages)
    ? question.allowedLanguages.filter((lang) => VALID_CODING_LANGUAGES.includes(lang))
    : [];

  const starter =
    question.starterCode && typeof question.starterCode === 'object'
      ? question.starterCode
      : {};

  const fromStarter = VALID_CODING_LANGUAGES.filter(
    (lang) => String(starter[lang] || '').trim().length > 0
  );

  const merged = Array.from(new Set([...fromField, ...fromStarter]));
  return merged.length > 0 ? merged : ['python'];
}

module.exports = {
  VALID_CODING_LANGUAGES,
  getEffectiveAllowedLanguages,
};
