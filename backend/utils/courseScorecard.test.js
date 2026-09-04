const { roundPct, scoreFromResult, buildCourseScorecard } = require('./courseScorecard');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(roundPct(16, 20) === 80, '16/20 is 80');
assert(roundPct(0, 0) === 0, 'empty max is 0');

const fromResult = scoreFromResult({ _id: 'r1', totalScore: 9, maxScore: 10, percentage: 88 });
assert(fromResult.percentage === 90, 'prefer points ratio');
assert(fromResult.totalScore === 9, 'total');

const empty = buildCourseScorecard([
  { _id: 'a', title: 'Intro', hasQuiz: false, quizStatus: 'none' },
]);
assert(empty.quizzesTotal === 0, 'no quizzes');
assert(empty.percentage === 0, 'no score yet');

const card = buildCourseScorecard([
  {
    _id: 'm1',
    title: 'HTML',
    hasQuiz: true,
    quizStatus: 'submitted',
    quizScore: { totalScore: 16, maxScore: 20, percentage: 80, resultId: 'r1' },
  },
  {
    _id: 'm2',
    title: 'CSS',
    hasQuiz: true,
    quizStatus: 'available',
  },
  {
    _id: 'm3',
    title: 'JS',
    hasQuiz: true,
    quizStatus: 'submitted',
    quizScore: { totalScore: 18, maxScore: 20, percentage: 90, resultId: 'r2' },
  },
]);

assert(card.quizzesTotal === 3, 'three quizzes');
assert(card.quizzesSubmitted === 2, 'two submitted');
assert(card.totalScore === 34, 'sum scores');
assert(card.maxScore === 40, 'sum max');
assert(card.percentage === 85, 'weighted overall');
assert(card.quizzes[1].score === null, 'pending quiz has no score');

console.log('courseScorecard.test.js: all passed');
