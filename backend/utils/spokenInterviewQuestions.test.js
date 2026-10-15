const {
  looksLikeUnspokenInterviewTask,
  stripQuestionWrapper,
} = require('./spokenInterviewQuestions');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(
  looksLikeUnspokenInterviewTask('Write a Python function that calculates compound interest for given P, R, T.'),
  'coding implement rejected'
);
assert(
  looksLikeUnspokenInterviewTask(
    'A train covers 120 km in 2 hours. Calculate the speed if it then travels 60 km in 45 minutes.'
  ),
  'aptitude word problem rejected'
);
assert(
  looksLikeUnspokenInterviewTask('What is the output of this code snippet for n = 5?'),
  'output-of-code rejected'
);
assert(
  looksLikeUnspokenInterviewTask('Implement a function to reverse a linked list in Java.'),
  'leetcode-style rejected'
);

const brief =
  'Q1. Write a program to find profit if CP=200 and SP=250. Q2. Calculate simple interest.';
assert(
  looksLikeUnspokenInterviewTask(
    'Q1. Write a program to find profit if CP=200 and SP=250. Q2. Calculate simple interest.',
    brief
  ),
  'copied brief rejected'
);

assert(
  !looksLikeUnspokenInterviewTask(
    'How would you explain compound interest to a junior on your team, and when does that idea show up in product work?'
  ),
  'spoken finance theme allowed'
);
assert(
  !looksLikeUnspokenInterviewTask(
    'Walk me through how you would approach finding duplicates in a large list, including tradeoffs you would consider.'
  ),
  'spoken algorithm approach allowed'
);
assert(
  !looksLikeUnspokenInterviewTask(
    'Tell me about a time a production bug related to payments surprised you. How did you debug it?'
  ),
  'behavioral allowed'
);

assert(
  stripQuestionWrapper('1. How would you explain REST to a teammate?') ===
    'How would you explain REST to a teammate?',
  'strips numbering'
);

console.log('spokenInterviewQuestions.test.js ok');
