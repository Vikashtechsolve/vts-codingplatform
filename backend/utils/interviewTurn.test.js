const { planNextInterviewTurn } = require('./interviewTurn');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

const queued = { questionText: 'How would you debug a slow API?', questionId: 'q2' };

const mid = planNextInterviewTurn({
  transcript: 'I would check logs, then the database, then add a metric.',
  mainAskedBefore: 0,
  planned: 6,
  followUpsRemaining: 2,
  queueHead: queued,
  topic: 'Node.js',
});
assert(mid.completed === false, 'mid interview continues');
assert(mid.consumeQueue === false, 'follow-up does not drop the queue');
assert(mid.wantsGeneratedFollowUp === true, 'real answer asks for a generated follow-up');
assert(mid.nextQuestion === null, 'follow-up text comes from the answer, not the queue');

const full = planNextInterviewTurn({
  transcript: 'I would start with the slow query log, confirm the missing index on the user lookup, add that index in a safe migration, and then watch the latency metric with the on-call team for the next hour before calling the incident done.',
  mainAskedBefore: 0,
  planned: 6,
  followUpsRemaining: 2,
  queueHead: queued,
  topic: 'Node.js',
});
assert(full.wantsGeneratedFollowUp === false, 'a full answer does not wait on a follow-up');
assert(full.consumeQueue === true, 'a full answer advances to the prepared question');
assert(full.nextQuestion.questionText === queued.questionText, 'next main question is the queued one');

const noFollowUp = planNextInterviewTurn({
  transcript: 'I would check logs, then the database, then add a metric.',
  mainAskedBefore: 0,
  planned: 6,
  allowFollowUp: false,
  queueHead: queued,
  topic: 'Node.js',
});
assert(noFollowUp.consumeQueue === true, 'without follow-ups, use the queue');
assert(noFollowUp.nextQuestion.questionText === queued.questionText, 'next is queued text');

const thin = planNextInterviewTurn({
  transcript: 'um yeah',
  mainAskedBefore: 0,
  planned: 6,
  followUpsRemaining: 2,
  queueHead: queued,
  topic: 'Node.js',
});
assert(thin.nextQuestion.isFollowUp === true, 'thin answer gets one follow-up');
assert(thin.consumeQueue === false, 'follow-up does not drop the queue');

const afterFollowUp = planNextInterviewTurn({
  transcript: 'I would look at the slow query and add an index.',
  isFollowUp: true,
  mainAskedBefore: 1,
  planned: 6,
  queueHead: queued,
});
assert(afterFollowUp.consumeQueue === true, 'after follow-up, advance the queue');
assert(afterFollowUp.completed === false, 'not finished');

const last = planNextInterviewTurn({
  transcript: 'I would explain the tradeoff and pick the simpler design.',
  mainAskedBefore: 5,
  planned: 6,
  followUpsRemaining: 1,
  queueHead: queued,
});
assert(last.completed === false, 'last main question still gets one follow-up');
assert(last.wantsGeneratedFollowUp === true, 'last follow-up is generated');
assert(last.consumeQueue === false, 'queue waits until the follow-up is answered');

const lastDone = planNextInterviewTurn({
  transcript: 'I would explain the tradeoff and then ship the simpler design.',
  isFollowUp: true,
  mainAskedBefore: 6,
  planned: 6,
  queueHead: queued,
});
assert(lastDone.completed === true, 'after the last follow-up the interview ends');
assert(lastDone.nextQuestion === null, 'no extra question');

const emptyQueue = planNextInterviewTurn({
  transcript: 'I would start with the user flow and then the data model.',
  mainAskedBefore: 1,
  planned: 6,
  queueHead: null,
  topic: 'system design',
});
assert(emptyQueue.completed === false, 'empty queue does not end early');
assert(emptyQueue.usedFallback === true, 'fallback question is used');
assert(emptyQueue.nextQuestion.questionText.length > 20, 'fallback has text');

console.log('interviewTurn.test.js ok');
