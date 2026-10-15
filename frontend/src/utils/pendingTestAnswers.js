const isEmptyAnswer = (value) => {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const questionIdOf = (question) => {
  const raw = question?.questionId?._id ?? question?.questionId;
  return raw == null ? '' : String(raw);
};

const answersEqual = (left, right) => {
  if (isEmptyAnswer(left) && isEmptyAnswer(right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
};

/**
 * Build the payload to persist one local question draft.
 * Returns null when there is nothing worth sending.
 */
export const localAnswerPayload = (question, entry = {}, options = {}) => {
  if (!question) return null;
  const questionId = questionIdOf(question);
  if (!questionId) return null;
  const type = question.type;
  const qDoc = question.questionId && typeof question.questionId === 'object' ? question.questionId : {};

  if (type === 'theory') {
    if (typeof entry.textAnswer !== 'string') return null;
    return { questionId, answer: entry.textAnswer };
  }

  if (type === 'sql') {
    if (typeof entry.sql !== 'string') return null;
    return { questionId, answer: entry.sql };
  }

  if (type === 'coding') {
    const lang =
      options.language ||
      entry.language ||
      qDoc.allowedLanguages?.[0] ||
      'python';
    const code =
      options.code != null
        ? options.code
        : (entry.codeByLanguage?.[lang] ?? entry.code ?? '');
    const starter = qDoc.starterCode?.[lang] ?? '';
    const matchesStarter = String(code) === String(starter);
    const hasServer = !isEmptyAnswer(options.serverAnswer);
    if (isEmptyAnswer(code) && !hasServer) return null;
    if (matchesStarter && !entry.attempted && !hasServer) return null;
    return { questionId, answer: code, language: lang };
  }

  if (type === 'mcq') {
    if (entry.selectedOption === undefined || entry.selectedOption === null) return null;
    return { questionId, answer: entry.selectedOption };
  }

  if (type === 'aptitude') {
    const questionType = qDoc.questionType;
    if (questionType === 'numeric') {
      if (entry.numericAnswer === '' || entry.numericAnswer == null) return null;
      return { questionId, answer: entry.numericAnswer };
    }
    if (questionType === 'multi') {
      const selected = Array.isArray(entry.selectedOptions) ? entry.selectedOptions : [];
      if (!selected.length) return null;
      return { questionId, answer: selected };
    }
    if (entry.selectedOption === undefined || entry.selectedOption === null) return null;
    return { questionId, answer: entry.selectedOption };
  }

  return null;
};

/**
 * Diff local drafts against last-known server answers.
 * Only returns payloads that still need to be persisted.
 */
export const buildPendingAnswerPayloads = ({
  sections = [],
  answers = {},
  resultAnswers = [],
  currentCoding,
} = {}) => {
  const serverById = new Map(
    (resultAnswers || []).map((row) => [String(row.questionId), row])
  );
  const payloads = [];

  sections.forEach((section) => {
    (section.questions || []).forEach((question) => {
      const qKey = questionIdOf(question);
      const entry = answers[qKey] || {};
      const server = serverById.get(qKey);
      const extra = { serverAnswer: server?.answer };
      if (currentCoding && String(currentCoding.questionId) === qKey) {
        extra.language = currentCoding.language;
        extra.code = currentCoding.code;
      }
      const payload = localAnswerPayload(question, entry, extra);
      if (!payload) return;
      if (
        answersEqual(payload.answer, server?.answer) &&
        (payload.language == null || payload.language === server?.language)
      ) {
        return;
      }
      payloads.push(payload);
    });
  });

  return payloads;
};

export const mergePersistedAnswers = (resultAnswers = [], payloads = []) => {
  const next = (resultAnswers || []).map((row) => ({ ...row }));
  payloads.forEach((payload) => {
    const idx = next.findIndex((row) => String(row.questionId) === String(payload.questionId));
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        answer: payload.answer,
        ...(payload.language ? { language: payload.language } : {}),
      };
    } else {
      next.push({
        questionId: payload.questionId,
        answer: payload.answer,
        language: payload.language,
      });
    }
  });
  return next;
};
