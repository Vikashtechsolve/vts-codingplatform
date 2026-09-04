/**
 * Create 10 coding tests and 10 mixed tests for sales@skilltrixa.com
 * from existing questions. No startDate / endDate (open anytime).
 *
 * Usage:
 *   node scripts/seedSalesCodingMixedTests.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Classroom = require('../models/Classroom');
const Test = require('../models/Test');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');

const VENDOR_ADMIN_EMAIL = 'sales@skilltrixa.com';
const CLASSROOM_NAME = 'Demo classroom';

const SETTINGS = {
  allowMultipleAttempts: false,
  autoSubmitAtWindowEnd: true,
  showResults: true,
  resultDisplay: 'detailed',
  shuffleQuestions: false,
  practiceMode: false,
};

const CODING_SPECS = [
  {
    title: 'Coding Assessment — Arrays Fundamentals',
    description: 'Easy array problems: hashing, two-sum patterns, in-place updates, and a single stock trade.',
    duration: 75,
    questions: [
      { title: 'Two Sum', difficulty: 'easy' },
      { title: 'Contains Duplicate' },
      { title: 'Move Zeroes' },
      { title: 'Best Time to Buy and Sell Stock', difficulty: 'easy' },
    ],
  },
  {
    title: 'Coding Assessment — Strings & Anagrams',
    description: 'String scanning, palindromes, anagrams, and character frequency.',
    duration: 75,
    questions: [
      { title: 'Valid Palindrome' },
      { title: 'Valid Anagram' },
      { title: 'Merge Strings Alternately' },
      { title: 'Find the First Unique Character' },
    ],
  },
  {
    title: 'Coding Assessment — Hashing & Frequency',
    description: 'Sets, maps, and frequency counting on arrays and strings.',
    duration: 75,
    questions: [
      { title: 'Unique Number of Occurrences' },
      { title: 'Single Number' },
      { title: 'Duplicate Product ID Detector' },
      { title: 'Valid Parentheses', difficulty: 'easy' },
    ],
  },
  {
    title: 'Coding Assessment — Two Pointers',
    description: 'Sorted two-sum, container water, 3Sum, and k-sum pairs.',
    duration: 90,
    questions: [
      { title: 'Two Sum II (Sorted Array)' },
      { title: 'Container With Most Water' },
      { title: '3Sum' },
      { title: 'Max Number of K-Sum Pairs' },
    ],
  },
  {
    title: 'Coding Assessment — Sliding Window',
    description: 'Variable and fixed windows on strings and binary arrays.',
    duration: 90,
    questions: [
      { title: 'Longest Substring Without Repeating Characters' },
      { title: 'Max Consecutive Ones III' },
      { title: 'Minimum Size Subarray Sum' },
      { title: 'Longest Repeating Character Replacement' },
    ],
  },
  {
    title: 'Coding Assessment — Stacks & Monotonic Structures',
    description: 'Parentheses, asteroid collision, next greater element, and histogram-style area.',
    duration: 90,
    questions: [
      { title: 'Temple Gate Lock Checker' },
      { title: 'Asteroid Collision', difficulty: 'medium' },
      { title: 'Next Greater Element to the Right' },
      { title: 'Maximum Land for the Village Fair' },
    ],
  },
  {
    title: 'Coding Assessment — Linked Lists & Trees',
    description: 'Cycle detection, k-group reverse, tree mirroring, and right-side view.',
    duration: 90,
    questions: [
      { title: 'Find the Starting Point of the Loop' },
      { title: 'Reverse Every K Train Coaches' },
      { title: 'Mirror Family Tree' },
      { title: 'Buildings Visible from the Right Side' },
    ],
  },
  {
    title: 'Coding Assessment — Binary Search',
    description: 'Search-on-answer and classic binary search on arrays.',
    duration: 90,
    questions: [
      { title: 'Banana Festival Challenge' },
      { title: "Wood Cutter's Perfect Blade Height" },
      { title: 'The Lost Number in the Sorted Kingdom' },
      { title: 'Increasing Triplet Subsequence' },
    ],
  },
  {
    title: 'Coding Assessment — Prefix, Greedy & Subarrays',
    description: 'Products, Kadane, triplets, and windowed energy/profit.',
    duration: 90,
    questions: [
      { title: 'Product of Array Except Self', difficulty: 'medium' },
      { title: 'Maximum Subarray Sum' },
      { title: 'Maximum Product of a Triplet' },
      { title: 'Festival Energy Rush' },
    ],
  },
  {
    title: 'Coding Assessment — Advanced Problem Solving',
    description: 'Harder DSA: trapping rain water, minimum window, DP, and deque windows.',
    duration: 120,
    questions: [
      { title: 'Trapping Rain Water' },
      { title: 'Minimum Window Substring' },
      { title: 'The Treasure Balloons' },
      { title: 'Highest Sales in Every Time Window' },
    ],
  },
];

const MIXED_SPECS = [
  {
    title: 'Mixed Assessment — Campus DSA + Core CS',
    description: 'Three coding problems plus MCQs on arrays, algorithms, and data structures. Open window — no deadline.',
    duration: 90,
    coding: [
      { title: 'Kids With the Greatest Number of Candies' },
      { title: 'Move Zeros to End' },
      { title: 'Longest Consecutive Sequence' },
    ],
    mcqNeedles: ['array', 'algorithm', 'data structure', 'dsa', 'string', 'sorting', 'binary search', 'recursion'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — Frontend Engineering Screen',
    description: 'Coding plus HTML, CSS, JavaScript, and React MCQs.',
    duration: 90,
    coding: [
      { title: 'Greatest Common Divisor of Strings' },
      { title: 'Can Place Flowers' },
      { title: 'Equal Row and Column Pairs', difficulty: 'medium' },
    ],
    mcqNeedles: ['javascript', 'react', 'html', 'css', 'dom', 'es6', 'async'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — Backend & API Screen',
    description: 'Coding plus Node, Express, auth, and MongoDB MCQs.',
    duration: 90,
    coding: [
      { title: 'Group Users by Role' },
      { title: 'In-Memory CRUD Handler' },
      { title: 'Fix User Validation' },
    ],
    mcqNeedles: ['express', 'mongodb', 'authentication', 'backend', 'mern', 'node', 'api', 'jwt'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — Python Programming Screen',
    description: 'Coding plus Python language, collections, and control-flow MCQs.',
    duration: 90,
    coding: [
      { title: 'Group Students by Grade' },
      { title: 'Pass–Fail Student Classifier' },
      { title: 'Count Even Numbers in an Array' },
    ],
    mcqNeedles: ['python', 'list', 'dictionary', 'comprehension', 'function', 'oop'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — Data Science & ML Screen',
    description: 'Coding plus ML, Pandas, NumPy, and evaluation-metric MCQs.',
    duration: 90,
    coding: [
      { title: 'Fix Classification Metrics' },
      { title: 'Fix Accuracy / Precision / Recall' },
      { title: 'RAG Best Chunk Retrieval' },
    ],
    mcqNeedles: ['machine learning', 'pandas', 'numpy', 'deep learning', 'data cleaning', 'neural', 'clustering'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — Cybersecurity Fundamentals',
    description: 'Coding plus security, cryptography, and network-defence MCQs.',
    duration: 90,
    coding: [
      { title: 'Post Office Email Delivery' },
      { title: 'Common Packet Size' },
      { title: 'The Mysterious Spell' },
    ],
    mcqNeedles: ['security', 'cyber', 'cryptograph', 'forensic', 'authentication', 'network security'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — DBMS & Storage Concepts',
    description: 'Coding plus DBMS, SQL, and MongoDB MCQs.',
    duration: 90,
    coding: [
      { title: 'The Royal Inventory' },
      { title: 'The Treasure Chest Counter' },
      { title: 'The Collector\'s Challenge' },
    ],
    mcqNeedles: ['dbms', 'sql', 'mongodb', 'database', 'ddl', 'dml'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — OS, Networks & OOP',
    description: 'Coding plus operating systems, computer networks, and OOP MCQs.',
    duration: 90,
    coding: [
      { title: 'Special Festival Number' },
      { title: 'Boxes Packed with Chocolates' },
      { title: 'The Ancient Kingdom\'s Secret Number' },
    ],
    mcqNeedles: ['operating system', 'network', 'oop', 'object-oriented', 'computer networks', 'os'],
    mcqCount: 10,
    aptitudeCount: 0,
  },
  {
    title: 'Mixed Assessment — Aptitude + DSA',
    description: 'Quantitative aptitude with two coding problems. Open window — no deadline.',
    duration: 90,
    coding: [
      { title: 'Maximum Number of Vowels in a Substring of Given Length', difficulty: 'medium' },
      { title: 'Max Number of K-Sum Pairs' },
    ],
    mcqNeedles: [],
    mcqCount: 0,
    aptitudeCount: 20,
  },
  {
    title: 'Mixed Assessment — Full Stack Campus Drive',
    description: 'Coding plus a spread of CS, web, and aptitude questions for a campus-drive style paper.',
    duration: 120,
    coding: [
      { title: 'Longest Consecutive Binary Streak' },
      { title: 'The Merchant\'s Journey' },
      { title: 'The Mountain Expedition' },
    ],
    mcqNeedles: ['javascript', 'react', 'python', 'algorithm', 'operating system', 'dbms'],
    mcqCount: 8,
    aptitudeCount: 10,
  },
];

function idStr(value) {
  return value?.toString?.() || String(value);
}

function haystack(question) {
  return [question.category, ...(question.tags || [])].map((s) => String(s || '').toLowerCase()).join(' | ');
}

function takeCoding(pool, used, spec) {
  const want = spec.title.trim().toLowerCase();
  const unused = pool.filter((q) => !used.has(idStr(q._id)) && q.title.trim().toLowerCase() === want);
  const all = pool.filter((q) => q.title.trim().toLowerCase() === want);
  const candidates = unused.length ? unused : all;
  if (spec.difficulty) {
    const match = candidates.find((q) => q.difficulty === spec.difficulty);
    if (match) {
      used.add(idStr(match._id));
      return match;
    }
  }
  if (!candidates.length) {
    const close = pool
      .filter((q) => q.title.toLowerCase().includes(want.slice(0, 18)))
      .map((q) => q.title)
      .slice(0, 8);
    throw new Error(`Coding question not found: "${spec.title}"${close.length ? ` (close: ${close.join('; ')})` : ''}`);
  }
  const picked = candidates[0];
  used.add(idStr(picked._id));
  return picked;
}

function takeMcq(pool, used, count, needles) {
  if (!count) return [];
  const out = [];
  const needleList = (needles || []).map((n) => n.toLowerCase());
  const preferred = pool
    .filter((q) => !used.has(idStr(q._id)) && needleList.some((n) => haystack(q).includes(n)))
    .sort((a, b) => idStr(a._id).localeCompare(idStr(b._id)));
  for (const q of preferred) {
    if (out.length >= count) break;
    used.add(idStr(q._id));
    out.push(q);
  }
  if (out.length < count) {
    const rest = pool
      .filter((q) => !used.has(idStr(q._id)))
      .sort((a, b) => idStr(a._id).localeCompare(idStr(b._id)));
    for (const q of rest) {
      if (out.length >= count) break;
      used.add(idStr(q._id));
      out.push(q);
    }
  }
  if (out.length < count) {
    throw new Error(`Need ${count} MCQs, only found ${out.length}`);
  }
  return out;
}

function takeAptitude(pool, used, count) {
  if (!count) return [];
  const out = [];
  const rest = pool
    .filter((q) => !used.has(idStr(q._id)))
    .sort((a, b) => {
      const sectionRank = (s) => (s === 'quantitative' ? 0 : s === 'logical' ? 1 : 2);
      const diffRank = (d) => (d === 'easy' ? 0 : d === 'medium' ? 1 : 2);
      return sectionRank(a.section) - sectionRank(b.section) || diffRank(a.difficulty) - diffRank(b.difficulty);
    });
  for (const q of rest) {
    if (out.length >= count) break;
    used.add(idStr(q._id));
    out.push(q);
  }
  if (out.length < count) {
    throw new Error(`Need ${count} aptitude questions, only found ${out.length}`);
  }
  return out;
}

function codingEntry(question, order, points = 10) {
  return {
    type: 'coding',
    questionId: question._id,
    questionType: 'CodingQuestion',
    points,
    order,
  };
}

function mcqEntry(question, order, points = 2) {
  return {
    type: 'mcq',
    questionId: question._id,
    questionType: 'MCQQuestion',
    points,
    order,
  };
}

function aptitudeEntry(question, order, points = 3) {
  return {
    type: 'aptitude',
    questionId: question._id,
    questionType: 'AptitudeQuestion',
    points,
    order,
  };
}

async function allocateToClassroom(tests, vendorId, assignedBy) {
  const classroom = await Classroom.findOne({
    vendorId,
    isActive: true,
    name: new RegExp(`^${CLASSROOM_NAME}$`, 'i'),
  });
  if (!classroom) {
    console.log(`Classroom "${CLASSROOM_NAME}" not found — tests created but not assigned.`);
    return { assigned: false, enrolled: 0 };
  }

  const now = new Date();
  classroom.assignedTests = classroom.assignedTests || [];
  for (const test of tests) {
    const already = classroom.assignedTests.some((at) => idStr(at.testId) === idStr(test._id));
    if (!already) {
      classroom.assignedTests.push({ testId: test._id, assignedAt: now, assignedBy });
    }
  }
  await classroom.save();

  const studentIds = (classroom.students || []).map(idStr);
  if (!studentIds.length) return { assigned: true, enrolled: 0, classroom: classroom.name };

  const students = await User.find({ _id: { $in: studentIds }, vendorId, role: 'student' });
  let enrolled = 0;
  for (const student of students) {
    student.enrolledTests = student.enrolledTests || [];
    let changed = false;
    for (const test of tests) {
      const already = student.enrolledTests.some((et) => idStr(et.testId) === idStr(test._id));
      if (!already) {
        student.enrolledTests.push({ testId: test._id, assignedAt: now, status: 'assigned' });
        changed = true;
        enrolled += 1;
      }
    }
    if (changed) await student.save();
  }
  return { assigned: true, enrolled, classroom: classroom.name, students: students.length };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const admin = await User.findOne({ email: VENDOR_ADMIN_EMAIL, role: 'vendor_admin', isActive: true });
  if (!admin?.vendorId) throw new Error(`Vendor admin not found: ${VENDOR_ADMIN_EMAIL}`);

  const vendorId = admin.vendorId;
  const createdBy = admin._id;
  const titles = [...CODING_SPECS, ...MIXED_SPECS].map((s) => s.title);
  const existing = await Test.find({ vendorId, title: { $in: titles } }).select('title').lean();
  if (existing.length) {
    throw new Error(`Tests already exist: ${existing.map((t) => t.title).join('; ')}`);
  }

  const questionFilter = { $or: [{ vendorId }, { isGlobal: true }] };
  const [codingPool, mcqPool, aptitudePool] = await Promise.all([
    CodingQuestion.find(questionFilter).select('_id title difficulty tags').lean(),
    MCQQuestion.find(questionFilter).select('_id category tags difficulty').lean(),
    AptitudeQuestion.find(questionFilter).select('_id section difficulty').lean(),
  ]);

  const usableCoding = codingPool.filter((q) => q.title && q.title.trim().toLowerCase() !== 'ef');
  const codingUsed = new Set();
  const mcqUsed = new Set();
  const aptitudeUsed = new Set();

  const codingDocs = CODING_SPECS.map((spec) => {
    const questions = spec.questions.map((qSpec, i) =>
      codingEntry(takeCoding(usableCoding, codingUsed, qSpec), i + 1, 10)
    );
    return {
      title: spec.title,
      description: spec.description,
      vendorId,
      createdBy,
      source: 'vendor',
      type: 'coding',
      duration: spec.duration,
      questions,
      isActive: true,
      settings: { ...SETTINGS },
    };
  });

  const mixedDocs = MIXED_SPECS.map((spec) => {
    const questions = [];
    let order = 1;
    for (const qSpec of spec.coding) {
      questions.push(codingEntry(takeCoding(usableCoding, codingUsed, qSpec), order, 20));
      order += 1;
    }
    for (const q of takeMcq(mcqPool, mcqUsed, spec.mcqCount, spec.mcqNeedles)) {
      questions.push(mcqEntry(q, order, 2));
      order += 1;
    }
    for (const q of takeAptitude(aptitudePool, aptitudeUsed, spec.aptitudeCount)) {
      questions.push(aptitudeEntry(q, order, 3));
      order += 1;
    }
    if (!questions.length) throw new Error(`${spec.title} has no questions`);
    return {
      title: spec.title,
      description: spec.description,
      vendorId,
      createdBy,
      source: 'vendor',
      type: 'mixed',
      duration: spec.duration,
      questions,
      isActive: true,
      settings: { ...SETTINGS },
    };
  });

  const created = await Test.insertMany([...codingDocs, ...mixedDocs], { ordered: true });
  await Vendor.findByIdAndUpdate(vendorId, { $inc: { 'stats.totalTests': created.length } });
  const allocation = await allocateToClassroom(created, vendorId, createdBy);

  const summary = created.map((t) => ({
    type: t.type,
    title: t.title,
    duration: t.duration,
    questions: t.questions.length,
    startDate: t.startDate || null,
    endDate: t.endDate || null,
    marks: t.questions.reduce((sum, q) => sum + (q.points || 0), 0),
  }));

  console.log(JSON.stringify({ created: created.length, allocation, tests: summary }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
