/**
 * Seed DSA practice topics. Run: node backend/scripts/seedPracticeTopics.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PracticeTopic = require('../models/PracticeTopic');

const TOPICS = [
  { slug: 'arrays', label: 'Arrays', category: 'fundamentals', order: 1 },
  { slug: 'strings', label: 'Strings', category: 'fundamentals', order: 2 },
  { slug: 'linked-lists', label: 'Linked Lists', category: 'fundamentals', order: 3 },
  { slug: 'stacks-queues', label: 'Stacks & Queues', category: 'fundamentals', order: 4 },
  { slug: 'hashing', label: 'Hashing', category: 'fundamentals', order: 5 },
  { slug: 'trees', label: 'Trees', category: 'intermediate', order: 6 },
  { slug: 'graphs', label: 'Graphs', category: 'intermediate', order: 7 },
  { slug: 'sorting', label: 'Sorting', category: 'intermediate', order: 8 },
  { slug: 'binary-search', label: 'Binary Search', category: 'intermediate', order: 9 },
  { slug: 'greedy', label: 'Greedy', category: 'intermediate', order: 10 },
  { slug: 'dynamic-programming', label: 'Dynamic Programming', category: 'advanced', order: 11 },
  { slug: 'backtracking', label: 'Backtracking', category: 'advanced', order: 12 },
  { slug: 'heap', label: 'Heap / Priority Queue', category: 'advanced', order: 13 },
  { slug: 'two-pointers', label: 'Two Pointers', category: 'fundamentals', order: 14 },
  { slug: 'sliding-window', label: 'Sliding Window', category: 'intermediate', order: 15 },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const topic of TOPICS) {
    await PracticeTopic.findOneAndUpdate({ slug: topic.slug }, topic, { upsert: true });
  }
  console.log(`Seeded ${TOPICS.length} practice topics`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
