const { fallbackReaction, closingLine, wordCount } = require('./interviewReaction');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(wordCount('(No verbal response)') === 0, 'empty marker is 0 words');
assert(wordCount('I would add an index on user_id') === 7, 'counts words');

const silent = fallbackReaction({ transcript: '', isFollowUp: false });
assert(silent.verdict === 'empty', 'silence is empty');
assert(/didn.?t catch/i.test(silent.reaction), 'silence gets a spoken reaction');

const thin = fallbackReaction({ transcript: 'yeah maybe', isFollowUp: false });
assert(thin.verdict === 'partial', 'short answer is partial');
assert(thin.followUpQuestion, 'short answer asks for more');

const solid = fallbackReaction({
  transcript: 'I would start with the slow query log, confirm the missing index, add a migration, and watch latency with the team for an hour before closing the incident.',
  isFollowUp: false,
});
assert(solid.verdict === 'good', 'full answer is good');
assert(!solid.followUpQuestion, 'full answer does not invent a follow-up');
assert(solid.transition, 'full answer has a transition into the next question');

const close = closingLine('That was a really clear walkthrough of the index.');
assert(/thank you/i.test(close), 'closing thanks the candidate');
assert(/end/i.test(close), 'closing signals the end');

console.log('interviewReaction.test.js ok');
