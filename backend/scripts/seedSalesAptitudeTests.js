/**
 * Create 5 aptitude tests for sales@skilltrixa.com from existing questions.
 * No startDate / endDate. Titles do not share a common prefix.
 *
 * Usage:
 *   node scripts/seedSalesAptitudeTests.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Classroom = require('../models/Classroom');
const Test = require('../models/Test');
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

const SPECS = [
  {
    title: 'Freshers Quant Screening',
    description: 'Easy-to-medium quantitative questions for a campus screening round. Open window — no deadline.',
    duration: 40,
    count: 20,
    preferDifficulty: ['easy', 'medium'],
    needles: ['quantitative'],
  },
  {
    title: 'Speed Distance Boats Paper',
    description: 'Time-speed-distance, boats and streams, and related quantitative items.',
    duration: 30,
    count: 15,
    needles: ['speed', 'distance', 'boat', 'stream'],
  },
  {
    title: 'Work Time Pipes Round',
    description: 'Time and work, pipes and cisterns, and ages.',
    duration: 30,
    count: 15,
    needles: ['work', 'pipe', 'cistern', 'age'],
  },
  {
    title: 'Profit Loss and Interest Set',
    description: 'Percentages, profit and loss, simple and compound interest, ratio and proportion.',
    duration: 30,
    count: 15,
    needles: ['percent', 'profit', 'loss', 'interest', 'ratio', 'proportion'],
  },
  {
    title: 'Number Series and Figures',
    description: 'Number series, mensuration, probability, permutations, and a few reasoning items.',
    duration: 30,
    count: 15,
    needles: ['series', 'mensuration', 'probabilit', 'permutation', 'combination', 'logical', 'analytical'],
  },
];

function idStr(value) {
  return value?.toString?.() || String(value);
}

function haystack(question) {
  return [
    question.section,
    question.subCategory,
    ...(question.tags || []),
  ]
    .map((s) => String(s || '').toLowerCase())
    .join(' | ');
}

function difficultyRank(difficulty) {
  if (difficulty === 'easy') return 0;
  if (difficulty === 'medium') return 1;
  return 2;
}

function takeAptitude(pool, used, spec) {
  const needles = (spec.needles || []).map((n) => n.toLowerCase());
  const preferDiff = spec.preferDifficulty || null;
  const unused = pool.filter((q) => !used.has(idStr(q._id)));

  const themed = unused.filter((q) => needles.some((n) => haystack(q).includes(n)));
  const rest = unused.filter((q) => !themed.includes(q));

  const sortFn = (a, b) => {
    if (preferDiff) {
      const aPref = preferDiff.includes(a.difficulty) ? 0 : 1;
      const bPref = preferDiff.includes(b.difficulty) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
    }
    return difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || idStr(a._id).localeCompare(idStr(b._id));
  };

  const ordered = [...themed.sort(sortFn), ...rest.sort(sortFn)];
  const picked = ordered.slice(0, spec.count);
  if (picked.length < spec.count) {
    throw new Error(`${spec.title}: need ${spec.count} questions, found ${picked.length}`);
  }
  picked.forEach((q) => used.add(idStr(q._id)));
  return picked;
}

async function allocateToClassroom(tests, vendorId, assignedBy) {
  const classroom = await Classroom.findOne({
    vendorId,
    isActive: true,
    name: new RegExp(`^${CLASSROOM_NAME}$`, 'i'),
  });
  if (!classroom) {
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
  const titles = SPECS.map((s) => s.title);
  const existing = await Test.find({ vendorId, title: { $in: titles } }).select('title').lean();
  if (existing.length) {
    throw new Error(`Tests already exist: ${existing.map((t) => t.title).join('; ')}`);
  }

  const pool = await AptitudeQuestion.find({
    $or: [{ vendorId }, { isGlobal: true }],
  })
    .select('_id section subCategory difficulty tags')
    .lean();

  const used = new Set();
  const docs = SPECS.map((spec) => {
    const picked = takeAptitude(pool, used, spec);
    return {
      title: spec.title,
      description: spec.description,
      vendorId,
      createdBy,
      source: 'vendor',
      type: 'aptitude',
      duration: spec.duration,
      questions: picked.map((q, i) => ({
        type: 'aptitude',
        questionId: q._id,
        questionType: 'AptitudeQuestion',
        points: 10,
        order: i + 1,
      })),
      isActive: true,
      settings: { ...SETTINGS },
    };
  });

  const created = await Test.insertMany(docs, { ordered: true });
  await Vendor.findByIdAndUpdate(vendorId, { $inc: { 'stats.totalTests': created.length } });
  const allocation = await allocateToClassroom(created, vendorId, createdBy);

  console.log(JSON.stringify({
    created: created.length,
    allocation,
    tests: created.map((t) => ({
      title: t.title,
      duration: t.duration,
      questions: t.questions.length,
      marks: t.questions.reduce((sum, q) => sum + (q.points || 0), 0),
      startDate: t.startDate || null,
      endDate: t.endDate || null,
    })),
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
