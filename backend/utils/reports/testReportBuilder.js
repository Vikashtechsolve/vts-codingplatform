const User = require('../../models/User');
const Result = require('../../models/Result');
const { loadQuestionsForTest } = require('./questionLoader');
const { truncate, formatDate, formatMinutes, formatBool, formatArray, safeNum } = require('./formatters');

const SECTION_LABELS = {
  english_grammar: 'Grammar',
  english_vocabulary: 'Vocabulary',
  english_reading: 'Reading',
  english_essay: 'Writing',
  english_speaking: 'Speaking',
  english_listening: 'Listening',
};

function formatAnswer(answer) {
  if (!answer) return '';
  if (answer.essayContent) return truncate(answer.essayContent, 800);
  if (answer.audioFileUrl) return `[Audio] ${answer.audioFileUrl}`;
  if (typeof answer.answer === 'string') return truncate(answer.answer, 800);
  if (Array.isArray(answer.answer)) return truncate(answer.answer.join(', '), 400);
  if (typeof answer.answer === 'object') return truncate(JSON.stringify(answer.answer), 400);
  return truncate(String(answer.answer ?? ''), 400);
}

function buildViolationSummary(violations) {
  if (!violations?.length) return '';
  return violations.map((v) => v.type).join(', ');
}

async function fetchEnrolledStudents(testId, vendorId) {
  return User.find({
    vendorId,
    role: 'student',
    'enrolledTests.testId': testId,
  }).select('name email enrolledTests');
}

function getEnrollment(student, testId) {
  return (student.enrolledTests || []).find(
    (et) => et.testId && et.testId.toString() === testId.toString()
  );
}

function pickLatestResult(resultsByStudent, studentId) {
  const list = resultsByStudent.get(studentId) || [];
  if (!list.length) return null;
  return list.sort((a, b) => {
    const ta = new Date(a.submittedAt || a.startedAt || 0).getTime();
    const tb = new Date(b.submittedAt || b.startedAt || 0).getTime();
    return tb - ta;
  })[0];
}

function buildSummaryRow(student, enrollment, result, rank) {
  return {
    studentName: student.name || '',
    studentEmail: student.email || '',
    enrollmentStatus: enrollment?.status || 'assigned',
    assignedAt: formatDate(enrollment?.assignedAt),
    attemptStatus: result?.status || 'not_started',
    startedAt: formatDate(result?.startedAt),
    submittedAt: formatDate(result?.submittedAt),
    timeSpentMinutes: formatMinutes(result?.timeSpent),
    totalScore: result?.totalScore ?? '',
    maxScore: result?.maxScore ?? '',
    percentage: result?.percentage != null ? safeNum(result.percentage, 1) : '',
    rank: rank ?? '',
    violationCount: result?.violationCount ?? 0,
    autoSubmitted: formatBool(result?.autoSubmitted),
    violationSummary: buildViolationSummary(result?.violations),
  };
}

function buildDetailRow(student, answer, qMeta, order) {
  const ev = answer.englishEvaluation || {};
  const evalTheory = answer.evaluation || {};
  const row = {
    studentName: student.name || '',
    studentEmail: student.email || '',
    questionOrder: order ?? qMeta?.order ?? '',
    questionType: answer.questionType || qMeta?.type || '',
    questionTitle: qMeta?.title || '',
    points: answer.points ?? '',
    maxPoints: answer.maxPoints ?? '',
    isCorrect: formatBool(answer.isCorrect),
    studentAnswer: formatAnswer(answer),
    language: answer.language || '',
    testCasesPassed: answer.testCasesPassed ?? '',
    totalTestCases: answer.totalTestCases ?? '',
    similarityScore: safeNum(evalTheory.similarityScore),
    conceptScore: safeNum(evalTheory.conceptScore),
    depthScore: safeNum(evalTheory.depthScore),
    theoryFeedback: truncate(evalTheory.feedback, 500),
    grammarScore: safeNum(ev.grammarScore),
    vocabularyScore: safeNum(ev.vocabularyScore),
    coherenceScore: safeNum(ev.coherenceScore),
    pronunciationScore: safeNum(ev.pronunciationScore),
    fluencyScore: safeNum(ev.fluencyScore),
    speakingRate: safeNum(ev.speakingRate),
    plagiarismScore: safeNum(ev.plagiarism?.originalityScore),
    englishFeedback: truncate(ev.detailedFeedback, 500),
  };
  return row;
}

function buildSectionRow(student, section) {
  return {
    studentName: student.name || '',
    studentEmail: student.email || '',
    sectionType: SECTION_LABELS[section.sectionType] || section.sectionType || '',
    sectionScore: section.score ?? '',
    sectionMaxScore: section.maxScore ?? '',
    sectionPercentage: section.percentage != null ? safeNum(section.percentage, 1) : '',
  };
}

/**
 * Build report datasets for a timed test.
 */
async function buildTestReport(test, vendorId) {
  const testId = test._id;
  const [students, results, questionMap] = await Promise.all([
    fetchEnrolledStudents(testId, vendorId),
    Result.find({ testId, vendorId }).populate('studentId', 'name email').lean(),
    loadQuestionsForTest(test),
  ]);

  const resultsByStudent = new Map();
  results.forEach((r) => {
    const sid = (r.studentId?._id || r.studentId)?.toString();
    if (!sid) return;
    if (!resultsByStudent.has(sid)) resultsByStudent.set(sid, []);
    resultsByStudent.get(sid).push(r);
  });

  const completedForRank = students
    .map((s) => {
      const r = pickLatestResult(resultsByStudent, s._id.toString());
      return r?.status === 'completed' ? { sid: s._id.toString(), pct: r.percentage || 0 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.pct - a.pct);

  const rankMap = new Map();
  completedForRank.forEach((item, idx) => rankMap.set(item.sid, idx + 1));

  const summaryRows = [];
  const detailRows = [];
  const sectionRows = [];

  students.forEach((student) => {
    const sid = student._id.toString();
    const enrollment = getEnrollment(student, testId);
    const result = pickLatestResult(resultsByStudent, sid);
    const rank = rankMap.get(sid) || '';

    summaryRows.push(buildSummaryRow(student, enrollment, result, rank));

    if (result?.answers?.length) {
      const sortedAnswers = [...result.answers].sort((a, b) => {
        const qa = questionMap.get(a.questionId?.toString());
        const qb = questionMap.get(b.questionId?.toString());
        return (qa?.order ?? 0) - (qb?.order ?? 0);
      });

      sortedAnswers.forEach((answer) => {
        const qid = answer.questionId?.toString();
        const qMeta = questionMap.get(qid);
        detailRows.push(buildDetailRow(student, answer, qMeta, qMeta?.order));
      });

      (result.sectionScores || []).forEach((sec) => {
        sectionRows.push(buildSectionRow(student, sec));
      });
    } else if (test.questions?.length) {
      test.questions.forEach((tq) => {
        const qMeta = questionMap.get(tq.questionId?.toString());
        detailRows.push({
          studentName: student.name || '',
          studentEmail: student.email || '',
          questionOrder: tq.order,
          questionType: tq.type,
          questionTitle: qMeta?.title || '',
          points: '',
          maxPoints: tq.points ?? '',
          isCorrect: '',
          studentAnswer: '[Not attempted]',
        });
      });
    }
  });

  return {
    meta: {
      title: test.title,
      type: test.type,
      duration: test.duration,
      totalEnrolled: students.length,
      totalAttempts: results.length,
      generatedAt: new Date(),
    },
    summaryRows,
    detailRows,
    sectionRows,
  };
}

module.exports = { buildTestReport };
