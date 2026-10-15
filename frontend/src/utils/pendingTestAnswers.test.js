import {
  localAnswerPayload,
  buildPendingAnswerPayloads,
  mergePersistedAnswers,
} from './pendingTestAnswers';

const theoryQ = (id) => ({
  type: 'theory',
  questionId: { _id: id },
});

describe('localAnswerPayload', () => {
  test('returns theory text even when Save was never clicked', () => {
    expect(localAnswerPayload(theoryQ('t1'), { textAnswer: 'OSI has seven layers' })).toEqual({
      questionId: 't1',
      answer: 'OSI has seven layers',
    });
  });

  test('skips theory with no local draft', () => {
    expect(localAnswerPayload(theoryQ('t1'), {})).toBeNull();
  });

  test('skips untouched coding starter', () => {
    const q = {
      type: 'coding',
      questionId: {
        _id: 'c1',
        allowedLanguages: ['python'],
        starterCode: { python: 'print(1)' },
      },
    };
    expect(localAnswerPayload(q, { language: 'python', code: 'print(1)', codeByLanguage: { python: 'print(1)' } })).toBeNull();
  });
});

describe('buildPendingAnswerPayloads', () => {
  test('includes unsaved theory that is missing on the server', () => {
    const payloads = buildPendingAnswerPayloads({
      sections: [{ questions: [theoryQ('t1'), theoryQ('t2')] }],
      answers: {
        t1: { textAnswer: 'typed locally, never saved' },
        t2: { textAnswer: '' },
      },
      resultAnswers: [
        { questionId: 't1', answer: '' },
        { questionId: 't2', answer: '' },
      ],
    });
    expect(payloads).toEqual([
      { questionId: 't1', answer: 'typed locally, never saved' },
    ]);
  });

  test('skips theory that already matches the server', () => {
    const payloads = buildPendingAnswerPayloads({
      sections: [{ questions: [theoryQ('t1')] }],
      answers: { t1: { textAnswer: 'already saved' } },
      resultAnswers: [{ questionId: 't1', answer: 'already saved' }],
    });
    expect(payloads).toEqual([]);
  });

  test('includes current coding editor value over stale map', () => {
    const q = {
      type: 'coding',
      questionId: { _id: 'c1', allowedLanguages: ['python'], starterCode: { python: '' } },
    };
    const payloads = buildPendingAnswerPayloads({
      sections: [{ questions: [q] }],
      answers: { c1: { language: 'python', code: 'old', codeByLanguage: { python: 'old' } } },
      resultAnswers: [{ questionId: 'c1', answer: '' }],
      currentCoding: { questionId: 'c1', language: 'python', code: 'def solve(): pass' },
    });
    expect(payloads).toEqual([
      { questionId: 'c1', answer: 'def solve(): pass', language: 'python' },
    ]);
  });
});

describe('mergePersistedAnswers', () => {
  test('updates the matching server row', () => {
    expect(
      mergePersistedAnswers(
        [{ questionId: 't1', answer: '' }],
        [{ questionId: 't1', answer: 'now saved' }]
      )
    ).toEqual([{ questionId: 't1', answer: 'now saved' }]);
  });
});
