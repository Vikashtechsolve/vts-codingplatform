const EMPTY = new Set(['', '(no verbal response)', '(No verbal response)']);

const wordCount = (text = '') => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized || EMPTY.has(normalized)) return 0;
  return normalized.split(' ').length;
};

const EXPAND_WORD_LIMIT = 8;
/** A full spoken answer moves straight to the next main question. */
const FULL_ANSWER_WORDS = 40;

const fallbackQuestion = (topic, index) => {
  const subject = topic || 'this topic';
  const templates = [
    `Walk me through a situation where you used ${subject}. What did you do, and what would you change now?`,
    `How would you explain ${subject} to someone joining your team next week?`,
    `Describe a realistic problem involving ${subject} that could go wrong at work. How would you notice and handle it?`,
    `When two approaches to ${subject} both look reasonable, how do you decide which one to use?`,
    `Tell me about a time ${subject} work did not go as planned. What did you learn?`,
    `If a teammate disagreed with your approach to ${subject}, how would you work through that?`,
  ];
  const questionText = templates[Math.abs(index) % templates.length];
  return {
    questionId: null,
    questionText,
    spokenText: questionText,
    isFollowUp: false,
  };
};

const asQuestion = (source, isFollowUp = false) => ({
  questionId: source?.questionId || null,
  questionText: source.questionText,
  spokenText: source.spokenText || source.questionText,
  isFollowUp,
});

/**
 * Decide the next spoken turn.
 * The queue holds main questions only. A follow-up is asked first and does not
 * remove the queued question. Generated follow-ups are filled in by the route
 * from the candidate's actual words.
 */
const planNextInterviewTurn = ({
  transcript = '',
  isFollowUp = false,
  allowFollowUp = true,
  followUpsRemaining = 0,
  mainAskedBefore = 0,
  planned = 6,
  queueHead = null,
  topic = '',
} = {}) => {
  const plannedN = Math.max(1, Number(planned) || 6);
  const mainsBefore = Math.max(0, Number(mainAskedBefore) || 0);
  const thisIsMain = !isFollowUp;
  const mainsAfter = mainsBefore + (thisIsMain ? 1 : 0);
  const words = wordCount(transcript);
  const acknowledgment = words >= 25
    ? 'Thanks, that was helpful.'
    : words >= EXPAND_WORD_LIMIT
      ? 'Got it, thank you.'
      : 'Thanks for that.';

  if (thisIsMain && allowFollowUp !== false && followUpsRemaining > 0 && words < FULL_ANSWER_WORDS) {
    if (words < EXPAND_WORD_LIMIT) {
      const questionText = `Could you walk me through that in a little more detail, especially how you would handle ${topic || 'it'} in practice?`;
      return {
        completed: false,
        consumeQueue: false,
        usedFallback: false,
        wantsGeneratedFollowUp: false,
        acknowledgment: 'I want to hear a bit more on that.',
        nextQuestion: asQuestion({ questionText }, true),
      };
    }
    return {
      completed: false,
      consumeQueue: false,
      usedFallback: false,
      wantsGeneratedFollowUp: true,
      acknowledgment: 'Let me dig into that.',
      nextQuestion: null,
    };
  }

  if ((thisIsMain && mainsAfter >= plannedN) || (!thisIsMain && mainsBefore >= plannedN)) {
    return {
      completed: true,
      consumeQueue: false,
      usedFallback: false,
      wantsGeneratedFollowUp: false,
      acknowledgment,
      nextQuestion: null,
    };
  }

  if (queueHead?.questionText) {
    return {
      completed: false,
      consumeQueue: true,
      usedFallback: false,
      wantsGeneratedFollowUp: false,
      acknowledgment,
      nextQuestion: asQuestion(queueHead, false),
    };
  }

  return {
    completed: false,
    consumeQueue: false,
    usedFallback: true,
    wantsGeneratedFollowUp: false,
    acknowledgment,
    nextQuestion: fallbackQuestion(topic, mainsAfter),
  };
};

module.exports = {
  wordCount,
  EXPAND_WORD_LIMIT,
  fallbackQuestion,
  FULL_ANSWER_WORDS,
  planNextInterviewTurn,
};
