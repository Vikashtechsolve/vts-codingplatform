/**
 * Copy questions + all assessment types from one vendor to another.
 * Does not copy students, classrooms, results, submissions, or courses.
 *
 * Usage:
 *   node scripts/copyVendorContent.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Subject = require('../models/Subject');
const Topic = require('../models/Topic');
const QuestionTag = require('../models/QuestionTag');
const DatasetTemplate = require('../models/DatasetTemplate');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');
const TheoryQuestion = require('../models/TheoryQuestion');
const SQLQuestion = require('../models/SQLQuestion');
const InterviewQuestion = require('../models/InterviewQuestion');
const EnglishGrammarQuestion = require('../models/EnglishGrammarQuestion');
const EnglishVocabularyQuestion = require('../models/EnglishVocabularyQuestion');
const EnglishReadingQuestion = require('../models/EnglishReadingQuestion');
const EnglishEssayQuestion = require('../models/EnglishEssayQuestion');
const EnglishSpeakingQuestion = require('../models/EnglishSpeakingQuestion');
const EnglishListeningQuestion = require('../models/EnglishListeningQuestion');
const Test = require('../models/Test');
const Assignment = require('../models/Assignment');
const Interview = require('../models/Interview');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const Contest = require('../models/Contest');
const Classroom = require('../models/Classroom');

const SOURCE_EMAIL = 'tech@skilltrixa.com';
const DEST_EMAIL = 'sales@skilltrixa.com';

const QUESTION_TYPE_TO_MAP = {
  coding: 'coding',
  mcq: 'mcq',
  aptitude: 'aptitude',
  theory: 'theory',
  sql: 'sql',
  english_grammar: 'englishGrammar',
  english_vocabulary: 'englishVocabulary',
  english_reading: 'englishReading',
  english_essay: 'englishEssay',
  english_speaking: 'englishSpeaking',
  english_listening: 'englishListening',
};

const TYPE_TO_MODEL = {
  coding: CodingQuestion,
  mcq: MCQQuestion,
  aptitude: AptitudeQuestion,
  theory: TheoryQuestion,
  sql: SQLQuestion,
  english_grammar: EnglishGrammarQuestion,
  english_vocabulary: EnglishVocabularyQuestion,
  english_reading: EnglishReadingQuestion,
  english_essay: EnglishEssayQuestion,
  english_speaking: EnglishSpeakingQuestion,
  english_listening: EnglishListeningQuestion,
};

function oidMap(docs) {
  const map = new Map();
  for (const doc of docs) {
    map.set(String(doc._id), new mongoose.Types.ObjectId());
  }
  return map;
}

function mappedId(map, id) {
  if (!id) return id;
  return map.get(String(id)) || null;
}

function cloneBase(doc, newId, vendorId, createdBy, extra = {}) {
  const { _id, __v, ...rest } = doc;
  const cloned = { ...rest, _id: newId, vendorId };
  if (Object.prototype.hasOwnProperty.call(rest, 'createdBy')) {
    cloned.createdBy = createdBy;
  }
  Object.assign(cloned, extra);
  return cloned;
}

async function insertChunked(Model, docs, label, chunkSize = 150) {
  if (!docs.length) {
    console.log(`  skip ${label}: 0 docs`);
    return 0;
  }
  let inserted = 0;
  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const result = await Model.insertMany(chunk, { ordered: true });
    inserted += result.length;
    console.log(`  ${label}: ${inserted}/${docs.length}`);
  }
  if (inserted !== docs.length) {
    throw new Error(`${label}: expected ${docs.length} inserts, got ${inserted}`);
  }
  return inserted;
}

function remapTestQuestions(questions, maps) {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    const { _id, ...rest } = q;
    const mapKey = QUESTION_TYPE_TO_MAP[q.type];
    const map = mapKey ? maps[mapKey] : null;
    const remapped = map ? map.get(String(q.questionId)) : null;
    return {
      ...rest,
      questionId: remapped || q.questionId,
    };
  });
}

async function loadAdmin(email) {
  const admin = await User.findOne({ email, role: 'vendor_admin', isActive: true }).lean();
  if (!admin) {
    throw new Error(`Active vendor_admin not found: ${email}`);
  }
  if (!admin.vendorId) {
    throw new Error(`vendor_admin ${email} has no vendorId`);
  }
  const vendor = await Vendor.findById(admin.vendorId).lean();
  if (!vendor) {
    throw new Error(`Vendor document missing for ${email}`);
  }
  return { admin, vendor };
}

async function assertDestEmpty(vendorId) {
  const checks = {
    subjects: await Subject.countDocuments({ vendorId }),
    topics: await Topic.countDocuments({ vendorId }),
    questionTags: await QuestionTag.countDocuments({ vendorId }),
    datasetTemplates: await DatasetTemplate.countDocuments({ vendorId }),
    codingQuestions: await CodingQuestion.countDocuments({ vendorId }),
    mcqQuestions: await MCQQuestion.countDocuments({ vendorId }),
    aptitudeQuestions: await AptitudeQuestion.countDocuments({ vendorId }),
    theoryQuestions: await TheoryQuestion.countDocuments({ vendorId }),
    sqlQuestions: await SQLQuestion.countDocuments({ vendorId }),
    interviewQuestions: await InterviewQuestion.countDocuments({ vendorId }),
    englishGrammar: await EnglishGrammarQuestion.countDocuments({ vendorId }),
    englishVocabulary: await EnglishVocabularyQuestion.countDocuments({ vendorId }),
    englishReading: await EnglishReadingQuestion.countDocuments({ vendorId }),
    englishEssay: await EnglishEssayQuestion.countDocuments({ vendorId }),
    englishSpeaking: await EnglishSpeakingQuestion.countDocuments({ vendorId }),
    englishListening: await EnglishListeningQuestion.countDocuments({ vendorId }),
    tests: await Test.countDocuments({ vendorId }),
    assignments: await Assignment.countDocuments({ vendorId }),
    interviews: await Interview.countDocuments({ vendorId }),
    systemDesign: await SystemDesignProblem.countDocuments({ vendorId }),
    contests: await Contest.countDocuments({ vendorId }),
  };
  const nonempty = Object.entries(checks).filter(([, n]) => n > 0);
  if (nonempty.length) {
    throw new Error(
      `Destination vendor already has content (${nonempty
        .map(([k, n]) => `${k}=${n}`)
        .join(', ')}). Aborting to avoid duplicates.`
    );
  }
}

async function countVendor(vendorId) {
  const tests = await Test.find({ vendorId }).select('type').lean();
  const testsByType = {};
  for (const t of tests) {
    testsByType[t.type] = (testsByType[t.type] || 0) + 1;
  }
  return {
    subjects: await Subject.countDocuments({ vendorId }),
    topics: await Topic.countDocuments({ vendorId }),
    questionTags: await QuestionTag.countDocuments({ vendorId }),
    datasetTemplates: await DatasetTemplate.countDocuments({ vendorId }),
    codingQuestions: await CodingQuestion.countDocuments({ vendorId }),
    mcqQuestions: await MCQQuestion.countDocuments({ vendorId }),
    aptitudeQuestions: await AptitudeQuestion.countDocuments({ vendorId }),
    theoryQuestions: await TheoryQuestion.countDocuments({ vendorId }),
    sqlQuestions: await SQLQuestion.countDocuments({ vendorId }),
    interviewQuestions: await InterviewQuestion.countDocuments({ vendorId }),
    englishGrammar: await EnglishGrammarQuestion.countDocuments({ vendorId }),
    englishVocabulary: await EnglishVocabularyQuestion.countDocuments({ vendorId }),
    englishReading: await EnglishReadingQuestion.countDocuments({ vendorId }),
    englishEssay: await EnglishEssayQuestion.countDocuments({ vendorId }),
    englishSpeaking: await EnglishSpeakingQuestion.countDocuments({ vendorId }),
    englishListening: await EnglishListeningQuestion.countDocuments({ vendorId }),
    tests: tests.length,
    testsByType,
    assignments: await Assignment.countDocuments({ vendorId }),
    interviews: await Interview.countDocuments({ vendorId }),
    systemDesign: await SystemDesignProblem.countDocuments({ vendorId }),
    contests: await Contest.countDocuments({ vendorId }),
    students: await User.countDocuments({ vendorId, role: 'student' }),
    classrooms: await Classroom.countDocuments({ vendorId }),
  };
}

async function verifyDestTests(destVendorId) {
  const tests = await Test.find({ vendorId: destVendorId }).lean();
  const missing = [];
  const keptGlobal = [];
  const idsByType = {};
  const refs = [];
  for (const t of tests) {
    for (const q of t.questions || []) {
      refs.push({ test: t.title, type: q.type, id: String(q.questionId) });
      if (!idsByType[q.type]) idsByType[q.type] = new Set();
      idsByType[q.type].add(String(q.questionId));
    }
  }

  const foundByType = {};
  for (const [type, idSet] of Object.entries(idsByType)) {
    const Model = TYPE_TO_MODEL[type];
    if (!Model) {
      foundByType[type] = new Map();
      continue;
    }
    const docs = await Model.find({ _id: { $in: [...idSet] } }).select('vendorId isGlobal').lean();
    foundByType[type] = new Map(docs.map((d) => [String(d._id), d]));
  }

  for (const ref of refs) {
    if (!TYPE_TO_MODEL[ref.type]) {
      missing.push({ ...ref, reason: 'unknown type' });
      continue;
    }
    const doc = foundByType[ref.type]?.get(ref.id);
    if (!doc) {
      missing.push({ ...ref, reason: 'not found' });
      continue;
    }
    const destOwned = doc.vendorId && String(doc.vendorId) === String(destVendorId);
    const isGlobal = !doc.vendorId || doc.isGlobal === true;
    if (!destOwned && !isGlobal) {
      missing.push({ ...ref, reason: `owned by other vendor ${doc.vendorId}` });
    } else if (isGlobal && !destOwned) {
      keptGlobal.push(ref);
    }
  }

  const sqlQs = await SQLQuestion.find({ vendorId: destVendorId }).lean();
  const destTestIds = new Set(tests.map((t) => String(t._id)));
  const sqlBad = sqlQs.filter((q) => !destTestIds.has(String(q.testId)));

  const theoryQs = await TheoryQuestion.find({ vendorId: destVendorId }).lean();
  const destSubjectIds = new Set(
    (await Subject.find({ vendorId: destVendorId }).select('_id').lean()).map((s) => String(s._id))
  );
  const theoryBad = theoryQs.filter((q) => !destSubjectIds.has(String(q.subjectId)));

  return { missing, keptGlobal, sqlBad: sqlBad.length, theoryBad: theoryBad.length, testCount: tests.length };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const source = await loadAdmin(SOURCE_EMAIL);
  const dest = await loadAdmin(DEST_EMAIL);
  const srcVendorId = source.admin.vendorId;
  const destVendorId = dest.admin.vendorId;
  const destUserId = dest.admin._id;

  if (String(srcVendorId) === String(destVendorId)) {
    throw new Error('Source and destination vendors are the same');
  }

  console.log(`Source: ${SOURCE_EMAIL} vendor=${srcVendorId}`);
  console.log(`Dest:   ${DEST_EMAIL} vendor=${destVendorId}`);

  await assertDestEmpty(destVendorId);

  const [
    subjects,
    topics,
    tags,
    templates,
    coding,
    mcq,
    aptitude,
    theory,
    sql,
    interviewQuestions,
    grammar,
    vocabulary,
    reading,
    essay,
    speaking,
    listening,
    tests,
    assignments,
    interviews,
    systemDesign,
    contests,
  ] = await Promise.all([
    Subject.find({ vendorId: srcVendorId }).lean(),
    Topic.find({ vendorId: srcVendorId }).lean(),
    QuestionTag.find({ vendorId: srcVendorId }).lean(),
    DatasetTemplate.find({ vendorId: srcVendorId }).lean(),
    CodingQuestion.find({ vendorId: srcVendorId }).lean(),
    MCQQuestion.find({ vendorId: srcVendorId }).lean(),
    AptitudeQuestion.find({ vendorId: srcVendorId }).lean(),
    TheoryQuestion.find({ vendorId: srcVendorId }).lean(),
    SQLQuestion.find({ vendorId: srcVendorId }).lean(),
    InterviewQuestion.find({ vendorId: srcVendorId }).lean(),
    EnglishGrammarQuestion.find({ vendorId: srcVendorId }).lean(),
    EnglishVocabularyQuestion.find({ vendorId: srcVendorId }).lean(),
    EnglishReadingQuestion.find({ vendorId: srcVendorId }).lean(),
    EnglishEssayQuestion.find({ vendorId: srcVendorId }).lean(),
    EnglishSpeakingQuestion.find({ vendorId: srcVendorId }).lean(),
    EnglishListeningQuestion.find({ vendorId: srcVendorId }).lean(),
    Test.find({ vendorId: srcVendorId }).lean(),
    Assignment.find({ vendorId: srcVendorId }).lean(),
    Interview.find({ vendorId: srcVendorId }).lean(),
    SystemDesignProblem.find({ vendorId: srcVendorId }).lean(),
    Contest.find({ vendorId: srcVendorId }).lean(),
  ]);

  const maps = {
    subject: oidMap(subjects),
    topic: oidMap(topics),
    tag: oidMap(tags),
    dataset: oidMap(templates),
    coding: oidMap(coding),
    mcq: oidMap(mcq),
    aptitude: oidMap(aptitude),
    theory: oidMap(theory),
    sql: oidMap(sql),
    interviewQuestion: oidMap(interviewQuestions),
    englishGrammar: oidMap(grammar),
    englishVocabulary: oidMap(vocabulary),
    englishReading: oidMap(reading),
    englishEssay: oidMap(essay),
    englishSpeaking: oidMap(speaking),
    englishListening: oidMap(listening),
    test: oidMap(tests),
    assignment: oidMap(assignments),
    interview: oidMap(interviews),
    systemDesign: oidMap(systemDesign),
    contest: oidMap(contests),
  };

  console.log('\nCopying supporting data...');
  await insertChunked(
    Subject,
    subjects.map((d) => cloneBase(d, maps.subject.get(String(d._id)), destVendorId, destUserId)),
    'subjects'
  );

  const topicDocs = topics.map((d) => {
    const subjectId = mappedId(maps.subject, d.subjectId);
    if (!subjectId) {
      throw new Error(`Topic ${d._id} (${d.name}) missing remapped subject ${d.subjectId}`);
    }
    return cloneBase(d, maps.topic.get(String(d._id)), destVendorId, destUserId, { subjectId });
  });
  await insertChunked(Topic, topicDocs, 'topics');

  await insertChunked(
    QuestionTag,
    tags.map((d) => cloneBase(d, maps.tag.get(String(d._id)), destVendorId, destUserId)),
    'questionTags',
    200
  );

  await insertChunked(
    DatasetTemplate,
    templates.map((d) => cloneBase(d, maps.dataset.get(String(d._id)), destVendorId, destUserId)),
    'datasetTemplates'
  );

  console.log('\nCopying question banks...');
  await insertChunked(
    CodingQuestion,
    coding.map((d) => cloneBase(d, maps.coding.get(String(d._id)), destVendorId, destUserId)),
    'codingQuestions'
  );
  await insertChunked(
    MCQQuestion,
    mcq.map((d) => cloneBase(d, maps.mcq.get(String(d._id)), destVendorId, destUserId)),
    'mcqQuestions',
    100
  );
  await insertChunked(
    AptitudeQuestion,
    aptitude.map((d) => cloneBase(d, maps.aptitude.get(String(d._id)), destVendorId, destUserId)),
    'aptitudeQuestions'
  );

  const theoryDocs = theory.map((d) => {
    const subjectId = mappedId(maps.subject, d.subjectId);
    if (!subjectId) {
      throw new Error(`Theory question ${d._id} missing remapped subject ${d.subjectId}`);
    }
    const topicId = d.topicId ? mappedId(maps.topic, d.topicId) : d.topicId;
    if (d.topicId && !topicId) {
      throw new Error(`Theory question ${d._id} missing remapped topic ${d.topicId}`);
    }
    return cloneBase(d, maps.theory.get(String(d._id)), destVendorId, destUserId, { subjectId, topicId });
  });
  await insertChunked(TheoryQuestion, theoryDocs, 'theoryQuestions');

  await insertChunked(
    InterviewQuestion,
    interviewQuestions.map((d) =>
      cloneBase(d, maps.interviewQuestion.get(String(d._id)), destVendorId, destUserId)
    ),
    'interviewQuestions'
  );
  await insertChunked(
    EnglishGrammarQuestion,
    grammar.map((d) => cloneBase(d, maps.englishGrammar.get(String(d._id)), destVendorId, destUserId)),
    'englishGrammar'
  );
  await insertChunked(
    EnglishVocabularyQuestion,
    vocabulary.map((d) =>
      cloneBase(d, maps.englishVocabulary.get(String(d._id)), destVendorId, destUserId)
    ),
    'englishVocabulary'
  );
  await insertChunked(
    EnglishReadingQuestion,
    reading.map((d) => cloneBase(d, maps.englishReading.get(String(d._id)), destVendorId, destUserId)),
    'englishReading'
  );
  await insertChunked(
    EnglishEssayQuestion,
    essay.map((d) => cloneBase(d, maps.englishEssay.get(String(d._id)), destVendorId, destUserId)),
    'englishEssay'
  );
  await insertChunked(
    EnglishSpeakingQuestion,
    speaking.map((d) => cloneBase(d, maps.englishSpeaking.get(String(d._id)), destVendorId, destUserId)),
    'englishSpeaking'
  );
  await insertChunked(
    EnglishListeningQuestion,
    listening.map((d) => cloneBase(d, maps.englishListening.get(String(d._id)), destVendorId, destUserId)),
    'englishListening'
  );

  console.log('\nCopying tests (all types)...');
  const testDocs = tests.map((d) => {
    const datasetTemplateId = d.datasetTemplateId
      ? mappedId(maps.dataset, d.datasetTemplateId) || d.datasetTemplateId
      : d.datasetTemplateId;
    return cloneBase(d, maps.test.get(String(d._id)), destVendorId, destUserId, {
      source: d.source || 'vendor',
      datasetTemplateId,
      questions: remapTestQuestions(d.questions, maps),
      courseId: null,
      courseModuleId: null,
    });
  });
  await insertChunked(Test, testDocs, 'tests');

  const sqlDocs = sql.map((d) => {
    const testId = mappedId(maps.test, d.testId);
    if (!testId) {
      throw new Error(`SQL question ${d._id} missing remapped test ${d.testId}`);
    }
    return cloneBase(d, maps.sql.get(String(d._id)), destVendorId, destUserId, { testId });
  });
  await insertChunked(SQLQuestion, sqlDocs, 'sqlQuestions');

  console.log('\nCopying assignments, interviews, system design, contests...');
  await insertChunked(
    Assignment,
    assignments.map((d) =>
      cloneBase(d, maps.assignment.get(String(d._id)), destVendorId, destUserId, {
        source: d.source || 'vendor',
        totalAssigned: 0,
        totalSubmitted: 0,
        totalEvaluated: 0,
      })
    ),
    'assignments'
  );

  const interviewDocs = interviews.map((d) => {
    const questions = (d.questions || []).map((q) => {
      const { _id, ...rest } = q;
      const questionId = mappedId(maps.interviewQuestion, q.questionId) || q.questionId;
      return { ...rest, questionId };
    });
    return cloneBase(d, maps.interview.get(String(d._id)), destVendorId, destUserId, {
      source: d.source || 'vendor',
      questions,
    });
  });
  await insertChunked(Interview, interviewDocs, 'interviews');

  await insertChunked(
    SystemDesignProblem,
    systemDesign.map((d) =>
      cloneBase(d, maps.systemDesign.get(String(d._id)), destVendorId, destUserId, {
        source: d.source || 'vendor',
        assignedTo: [],
        assignedClassrooms: [],
        totalAssigned: 0,
        totalSubmitted: 0,
        totalEvaluated: 0,
      })
    ),
    'systemDesign'
  );

  const contestDocs = contests.map((d) => {
    let assessmentId = d.assessmentId;
    if (d.assessmentType === 'test') {
      assessmentId = mappedId(maps.test, d.assessmentId);
    } else if (d.assessmentType === 'interview') {
      assessmentId = mappedId(maps.interview, d.assessmentId);
    } else if (d.assessmentType === 'assignment') {
      assessmentId = mappedId(maps.assignment, d.assessmentId);
    } else if (d.assessmentType === 'system_design') {
      assessmentId = mappedId(maps.systemDesign, d.assessmentId);
    }
    if (!assessmentId) {
      throw new Error(`Contest ${d.title} missing remapped assessment ${d.assessmentId}`);
    }
    return cloneBase(d, maps.contest.get(String(d._id)), destVendorId, destUserId, {
      assessmentId,
      slug: Contest.generateSlug(),
    });
  });
  await insertChunked(Contest, contestDocs, 'contests');

  await Vendor.updateOne(
    { _id: destVendorId },
    { $set: { 'stats.totalTests': tests.length } }
  );

  console.log('\nVerifying copy...');
  const srcCounts = await countVendor(srcVendorId);
  const destCounts = await countVendor(destVendorId);

  const countKeys = Object.keys(srcCounts).filter((k) => k !== 'testsByType' && k !== 'students' && k !== 'classrooms');
  const mismatches = [];
  for (const key of countKeys) {
    if (srcCounts[key] !== destCounts[key]) {
      mismatches.push(`${key}: source=${srcCounts[key]} dest=${destCounts[key]}`);
    }
  }
  for (const type of new Set([...Object.keys(srcCounts.testsByType), ...Object.keys(destCounts.testsByType)])) {
    if ((srcCounts.testsByType[type] || 0) !== (destCounts.testsByType[type] || 0)) {
      mismatches.push(
        `tests.${type}: source=${srcCounts.testsByType[type] || 0} dest=${destCounts.testsByType[type] || 0}`
      );
    }
  }

  if (mismatches.length) {
    throw new Error(`Count mismatch after copy:\n${mismatches.join('\n')}`);
  }

  if (destCounts.students !== 0 || destCounts.classrooms !== 0) {
    throw new Error(
      `Destination unexpectedly has students=${destCounts.students} classrooms=${destCounts.classrooms}`
    );
  }

  const verify = await verifyDestTests(destVendorId);
  if (verify.missing.length || verify.sqlBad || verify.theoryBad) {
    throw new Error(
      `Integrity check failed: missing=${JSON.stringify(verify.missing.slice(0, 10))} sqlBad=${verify.sqlBad} theoryBad=${verify.theoryBad}`
    );
  }

  console.log('\nCopy complete.');
  console.log(JSON.stringify({ source: srcCounts, dest: destCounts, keptGlobalQuestions: verify.keptGlobal }, null, 2));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('\nCOPY FAILED:', err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
