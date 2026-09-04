const {
  pickOfficialQuizResult,
  applyOfficialQuizProgress,
} = require('./courseQuizAttempts');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const first = {
  _id: 'a',
  status: 'completed',
  submittedAt: '2026-08-01T10:00:00.000Z',
  totalScore: 12,
  maxScore: 20,
};
const practice = {
  _id: 'b',
  status: 'completed',
  submittedAt: '2026-08-01T12:00:00.000Z',
  totalScore: 20,
  maxScore: 20,
};

assert(pickOfficialQuizResult([practice, first])._id === 'a', 'earliest is official');
assert(pickOfficialQuizResult([{ ...first, status: 'in_progress' }, practice])._id === 'b', 'skip in-progress');

const vendorPrior = {
  _id: 'vendor',
  status: 'completed',
  submittedAt: '2026-07-01T10:00:00.000Z',
  totalScore: 20,
  maxScore: 20,
};
const courseFirst = {
  ...first,
  courseId: 'c1',
  moduleId: 'm1',
};
assert(
  pickOfficialQuizResult([vendorPrior, courseFirst], { courseId: 'c1', moduleId: 'm1' })._id === 'a',
  'course scope ignores earlier vendor result'
);

const mod = { quizStatus: 'available' };
const firstApply = applyOfficialQuizProgress(mod, {
  currentResult: first,
  officialResult: first,
  attemptCount: 1,
});
assert(firstApply.practice === false, 'first is official');
assert(mod.resultId === 'a', 'stores first result');
assert(mod.quizScore === 12, 'stores first score');
assert(mod.latestResultId === 'a', 'latest starts as official');

const secondApply = applyOfficialQuizProgress(mod, {
  currentResult: practice,
  officialResult: first,
  attemptCount: 2,
});
assert(secondApply.practice === true, 'second is practice');
assert(mod.resultId === 'a', 'official result stays first');
assert(mod.quizScore === 12, 'official score stays first');
assert(mod.quizPercentage === 60, '12/20 stays 60');
assert(mod.latestResultId === 'b', 'latest tracks practice');
assert(mod.quizAttemptCount === 2, 'attempt count');

applyOfficialQuizProgress(mod, {
  currentResult: first,
  officialResult: first,
  attemptCount: 2,
});
assert(mod.latestResultId === 'b', 're-sync official does not clobber latest practice');
assert(mod.quizScore === 12, 'score still first');

console.log('courseQuizAttempts.test.js: all passed');
