const mongoose = require('mongoose');
const Classroom = require('../../models/Classroom');
const User = require('../../models/User');
const Test = require('../../models/Test');
const Result = require('../../models/Result');

function round(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeId(value) {
  return String(value?._id || value || '');
}

function buildStudentResultMaps(completedResults, allAttempts) {
  const resultsByStudent = new Map();
  const attemptsByStudent = new Map();

  for (const result of completedResults) {
    const sid = normalizeId(result.studentId);
    if (!resultsByStudent.has(sid)) resultsByStudent.set(sid, []);
    resultsByStudent.get(sid).push(result);
  }

  for (const attempt of allAttempts) {
    const sid = normalizeId(attempt.studentId);
    attemptsByStudent.set(sid, (attemptsByStudent.get(sid) || 0) + 1);
  }

  return { resultsByStudent, attemptsByStudent };
}

function summarizeStudents(studentIds, resultsByStudent, attemptsByStudent) {
  let completedAttempts = 0;
  let scoreSum = 0;
  let attemptedStudents = 0;
  let completedStudents = 0;

  for (const sid of studentIds) {
    const studentResults = resultsByStudent.get(sid) || [];
    const attemptCount = attemptsByStudent.get(sid) || 0;
    if (attemptCount > 0) attemptedStudents += 1;
    if (studentResults.length > 0) {
      completedStudents += 1;
      completedAttempts += studentResults.length;
      scoreSum += studentResults.reduce((sum, r) => sum + (r.percentage || 0), 0);
    }
  }

  return {
    attemptedStudents,
    completedStudents,
    completedAttempts,
    averageScore: completedAttempts > 0 ? round(scoreSum / completedAttempts) : 0,
  };
}

async function loadBaseData(vendorId) {
  const vendorObjectId =
    vendorId instanceof mongoose.Types.ObjectId
      ? vendorId
      : new mongoose.Types.ObjectId(String(vendorId));
  const [completedResults, allAttempts, tests, students, classrooms] = await Promise.all([
    Result.find({ vendorId: vendorObjectId, status: 'completed' })
      .select('studentId testId percentage submittedAt')
      .lean(),
    Result.find({ vendorId: vendorObjectId }).select('studentId').lean(),
    Test.find({ vendorId: vendorObjectId }).select('title type duration').sort({ createdAt: -1 }).lean(),
    User.find({ vendorId: vendorObjectId, role: 'student', isActive: { $ne: false } })
      .select('name email')
      .lean(),
    Classroom.find({ vendorId: vendorObjectId, isActive: true })
      .select('name description students assignedTests')
      .lean(),
  ]);

  const testMap = new Map(tests.map((test) => [normalizeId(test._id), test]));
  const studentMap = new Map(students.map((student) => [normalizeId(student._id), student]));
  const { resultsByStudent, attemptsByStudent } = buildStudentResultMaps(
    completedResults,
    allAttempts
  );

  return {
    completedResults,
    allAttempts,
    tests,
    students,
    classrooms,
    testMap,
    studentMap,
    resultsByStudent,
    attemptsByStudent,
  };
}

function buildActivityTrend(completedResults, days = 30) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const counts = {};
  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    counts[date.toISOString().split('T')[0]] = 0;
  }

  for (const result of completedResults) {
    if (!result.submittedAt) continue;
    const date = new Date(result.submittedAt).toISOString().split('T')[0];
    if (Object.prototype.hasOwnProperty.call(counts, date)) {
      counts[date] += 1;
    }
  }

  return Object.keys(counts)
    .sort()
    .map((date) => ({ date, count: counts[date] }));
}

function buildScoreDistribution(completedResults) {
  const buckets = [
    { label: '0–40%', min: 0, max: 40, count: 0 },
    { label: '41–60%', min: 41, max: 60, count: 0 },
    { label: '61–80%', min: 61, max: 80, count: 0 },
    { label: '81–100%', min: 81, max: 100, count: 0 },
  ];

  for (const result of completedResults) {
    const score = result.percentage || 0;
    const bucket = buckets.find((b) => score >= b.min && score <= b.max);
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}

function buildTestMetrics(tests, completedResults) {
  const resultsByTest = new Map();
  for (const result of completedResults) {
    const tid = normalizeId(result.testId);
    if (!resultsByTest.has(tid)) resultsByTest.set(tid, []);
    resultsByTest.get(tid).push(result);
  }

  return tests.map((test) => {
    const tid = normalizeId(test._id);
    const testResults = resultsByTest.get(tid) || [];
    const averageScore =
      testResults.length > 0
        ? round(testResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / testResults.length)
        : 0;
    const uniqueStudents = new Set(testResults.map((r) => normalizeId(r.studentId))).size;

    return {
      testId: test._id,
      testTitle: test.title,
      testType: test.type,
      duration: test.duration,
      totalSubmissions: testResults.length,
      uniqueStudents,
      averageScore,
    };
  });
}

function buildClassroomSummaries(classrooms, resultsByStudent, attemptsByStudent) {
  return classrooms.map((classroom) => {
    const studentIds = (classroom.students || []).map((s) => normalizeId(s)).filter(Boolean);
    const summary = summarizeStudents(studentIds, resultsByStudent, attemptsByStudent);
    const totalStudents = studentIds.length;
    const assignedTestIds = (classroom.assignedTests || [])
      .map((entry) => normalizeId(entry.testId))
      .filter(Boolean);
    const assignedCompletionRate = calcAssignedCompletionRate(
      assignedTestIds,
      studentIds,
      resultsByStudent
    );

    return {
      classroomId: classroom._id,
      classroomName: classroom.name,
      description: classroom.description || '',
      totalStudents,
      assignedTestsCount: assignedTestIds.length,
      assignedCompletionRate,
      attemptedCount: summary.attemptedStudents,
      completedCount: summary.completedStudents,
      notAttemptedCount: Math.max(0, totalStudents - summary.attemptedStudents),
      averageScore: summary.averageScore,
      completionRate:
        totalStudents > 0 ? round((summary.completedStudents / totalStudents) * 100, 0) : 0,
      attemptRate:
        totalStudents > 0 ? round((summary.attemptedStudents / totalStudents) * 100, 0) : 0,
    };
  });
}

function calcAssignedCompletionRate(assignedTestIds, studentIds, resultsByStudent) {
  if (assignedTestIds.length === 0 || studentIds.length === 0) return null;

  const totalSlots = assignedTestIds.length * studentIds.length;
  let completedSlots = 0;

  for (const sid of studentIds) {
    const completedTestIds = new Set(
      (resultsByStudent.get(sid) || []).map((result) => normalizeId(result.testId))
    );
    for (const testId of assignedTestIds) {
      if (completedTestIds.has(testId)) completedSlots += 1;
    }
  }

  return round((completedSlots / totalSlots) * 100, 0);
}

function buildAssignedTestMetrics(assignedTestIds, studentIds, completedResults, testMap, totalStudents) {
  const studentSet = new Set(studentIds);

  return assignedTestIds
    .map((testId) => {
      const test = testMap.get(testId);
      const testResults = completedResults.filter(
        (result) =>
          normalizeId(result.testId) === testId &&
          studentSet.has(normalizeId(result.studentId))
      );
      const studentsCompleted = new Set(testResults.map((result) => normalizeId(result.studentId)))
        .size;

      return {
        testId,
        testTitle: test?.title || 'Untitled test',
        testType: test?.type || '',
        studentsCompleted,
        studentsPending: Math.max(0, totalStudents - studentsCompleted),
        completionRate:
          totalStudents > 0 ? round((studentsCompleted / totalStudents) * 100, 0) : 0,
        submissions: testResults.length,
        averageScore:
          testResults.length > 0
            ? round(
                testResults.reduce((sum, result) => sum + (result.percentage || 0), 0) /
                  testResults.length
              )
            : 0,
      };
    })
    .sort((a, b) => {
      if (b.studentsCompleted !== a.studentsCompleted) {
        return b.studentsCompleted - a.studentsCompleted;
      }
      return (a.testTitle || '').localeCompare(b.testTitle || '');
    });
}

function buildClassroomStudentRows(
  studentIds,
  assignedTestIds,
  studentMap,
  resultsByStudent,
  attemptsByStudent
) {
  return studentIds
    .map((sid) => studentMap.get(sid))
    .filter(Boolean)
    .map((student) => {
      const studentId = normalizeId(student._id);
      const studentResults = resultsByStudent.get(studentId) || [];
      const completedTestIds = new Set(studentResults.map((result) => normalizeId(result.testId)));
      const assignedCompleted = assignedTestIds.filter((testId) => completedTestIds.has(testId))
        .length;
      const assignedTotal = assignedTestIds.length;
      const totalAttempts = attemptsByStudent.get(studentId) || 0;
      const completedTests = studentResults.length;
      const averageScore =
        completedTests > 0
          ? round(
              studentResults.reduce((sum, result) => sum + (result.percentage || 0), 0) /
                completedTests
            )
          : 0;
      const lastActivityAt = studentResults.reduce((latest, result) => {
        if (!result.submittedAt) return latest;
        const timestamp = new Date(result.submittedAt).getTime();
        return timestamp > latest ? timestamp : latest;
      }, 0);

      let status = 'not_started';
      if (totalAttempts > 0) {
        if (assignedTotal > 0 && assignedCompleted >= assignedTotal) {
          status = 'complete';
        } else {
          status = 'in_progress';
        }
      }

      return {
        studentId: student._id,
        name: student.name,
        email: student.email,
        status,
        assignedTotal,
        assignedCompleted,
        assignedProgress:
          assignedTotal > 0 ? round((assignedCompleted / assignedTotal) * 100, 0) : null,
        totalAttempts,
        completedTests,
        averageScore,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt).toISOString() : null,
      };
    });
}

function buildClassroomScoreDistribution(studentIds, resultsByStudent) {
  const studentSet = new Set(studentIds);
  const classroomResults = [];

  for (const sid of studentIds) {
    for (const result of resultsByStudent.get(sid) || []) {
      if (studentSet.has(sid)) classroomResults.push(result);
    }
  }

  return buildScoreDistribution(classroomResults);
}

function buildTestsTakenMetrics(studentIds, tests, completedResults, testMap) {
  const studentSet = new Set(studentIds);

  return buildTestMetrics(tests, completedResults)
    .filter((test) =>
      completedResults.some(
        (result) =>
          normalizeId(result.testId) === normalizeId(test.testId) &&
          studentSet.has(normalizeId(result.studentId))
      )
    )
    .map((test) => {
      const testResults = completedResults.filter(
        (result) =>
          normalizeId(result.testId) === normalizeId(test.testId) &&
          studentSet.has(normalizeId(result.studentId))
      );
      const studentsCompleted = new Set(testResults.map((result) => normalizeId(result.studentId)))
        .size;

      return {
        testId: test.testId,
        testTitle: test.testTitle,
        testType: test.testType,
        studentsCompleted,
        studentsPending: Math.max(0, studentIds.length - studentsCompleted),
        completionRate:
          studentIds.length > 0
            ? round((studentsCompleted / studentIds.length) * 100, 0)
            : 0,
        submissions: testResults.length,
        averageScore:
          testResults.length > 0
            ? round(
                testResults.reduce((sum, result) => sum + (result.percentage || 0), 0) /
                  testResults.length
              )
            : 0,
      };
    })
    .sort((a, b) => b.submissions - a.submissions);
}

function pickStudentsNeedingAttention(students) {
  return [...students]
    .sort((a, b) => {
      const statusRank = { not_started: 0, in_progress: 1, complete: 2 };
      const rankDiff = (statusRank[a.status] ?? 1) - (statusRank[b.status] ?? 1);
      if (rankDiff !== 0) return rankDiff;
      if ((a.assignedProgress ?? 100) !== (b.assignedProgress ?? 100)) {
        return (a.assignedProgress ?? 100) - (b.assignedProgress ?? 100);
      }
      return a.averageScore - b.averageScore;
    })
    .filter((student) => student.status !== 'complete')
    .slice(0, 5);
}

async function getAnalyticsOverview(vendorId, { days = 30 } = {}) {
  const data = await loadBaseData(vendorId);
  const {
    completedResults,
    allAttempts,
    tests,
    students,
    classrooms,
    resultsByStudent,
    attemptsByStudent,
  } = data;

  const allStudentIds = students.map((s) => normalizeId(s._id));
  const orgSummary = summarizeStudents(allStudentIds, resultsByStudent, attemptsByStudent);
  const testMetrics = buildTestMetrics(tests, completedResults);
  const classroomSummaries = buildClassroomSummaries(
    classrooms,
    resultsByStudent,
    attemptsByStudent
  );

  const studentsWithAttempts = allStudentIds.filter((sid) => (attemptsByStudent.get(sid) || 0) > 0)
    .length;

  return {
    summary: {
      totalTests: tests.length,
      totalStudents: students.length,
      activeStudents: studentsWithAttempts,
      totalSubmissions: completedResults.length,
      totalAttempts: allAttempts.length,
      averageScore: orgSummary.averageScore,
      completionRate:
        students.length > 0
          ? round((orgSummary.completedStudents / students.length) * 100, 0)
          : 0,
      attemptRate:
        students.length > 0
          ? round((studentsWithAttempts / students.length) * 100, 0)
          : 0,
    },
    activityTrend: buildActivityTrend(completedResults, days),
    scoreDistribution: buildScoreDistribution(completedResults),
    allTests: [...testMetrics].sort((a, b) => b.totalSubmissions - a.totalSubmissions),
    topTests: [...testMetrics]
      .sort((a, b) => b.totalSubmissions - a.totalSubmissions)
      .slice(0, 8),
    topClassrooms: [...classroomSummaries]
      .filter((c) => c.totalStudents > 0)
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 6),
    classroomSummaries,
  };
}

async function getAnalyticsTests(vendorId, { page = 1, limit = 15, search = '', sort = 'submissions' } = {}) {
  const data = await loadBaseData(vendorId);
  const testMetrics = buildTestMetrics(data.tests, data.completedResults);

  let filtered = testMetrics;
  const q = search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(
      (test) =>
        test.testTitle?.toLowerCase().includes(q) ||
        test.testType?.toLowerCase().includes(q)
    );
  }

  const sorters = {
    submissions: (a, b) => b.totalSubmissions - a.totalSubmissions,
    score: (a, b) => b.averageScore - a.averageScore,
    title: (a, b) => (a.testTitle || '').localeCompare(b.testTitle || ''),
  };
  filtered.sort(sorters[sort] || sorters.submissions);

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(5, parseInt(limit, 10) || 15));
  const total = filtered.length;
  const start = (safePage - 1) * safeLimit;

  return {
    tests: filtered.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

async function getClassroomAnalytics(vendorId, classroomId, { page = 1, limit = 20, search = '' } = {}) {
  const data = await loadBaseData(vendorId);
  const classroom = data.classrooms.find((c) => normalizeId(c._id) === normalizeId(classroomId));

  if (!classroom) {
    return null;
  }

  const studentIds = (classroom.students || []).map((s) => normalizeId(s)).filter(Boolean);
  const assignedTestIds = (classroom.assignedTests || [])
    .map((entry) => normalizeId(entry.testId))
    .filter(Boolean);
  const summary = summarizeStudents(studentIds, data.resultsByStudent, data.attemptsByStudent);
  const totalStudents = studentIds.length;
  const assignedCompletionRate = calcAssignedCompletionRate(
    assignedTestIds,
    studentIds,
    data.resultsByStudent
  );
  const classroomResults = studentIds.flatMap((sid) => data.resultsByStudent.get(sid) || []);

  let students = buildClassroomStudentRows(
    studentIds,
    assignedTestIds,
    data.studentMap,
    data.resultsByStudent,
    data.attemptsByStudent
  );

  const q = search.trim().toLowerCase();
  if (q) {
    students = students.filter(
      (student) =>
        student.name?.toLowerCase().includes(q) ||
        student.email?.toLowerCase().includes(q)
    );
  }

  students.sort((a, b) => {
    const statusRank = { not_started: 0, in_progress: 1, complete: 2 };
    const rankDiff = (statusRank[a.status] ?? 1) - (statusRank[b.status] ?? 1);
    if (rankDiff !== 0) return rankDiff;
    if ((a.assignedProgress ?? -1) !== (b.assignedProgress ?? -1)) {
      return (b.assignedProgress ?? -1) - (a.assignedProgress ?? -1);
    }
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return (a.name || '').localeCompare(b.name || '');
  });

  const assignedTests = buildAssignedTestMetrics(
    assignedTestIds,
    studentIds,
    data.completedResults,
    data.testMap,
    totalStudents
  );
  const testsTaken =
    assignedTestIds.length > 0
      ? []
      : buildTestsTakenMetrics(
          studentIds,
          data.tests,
          data.completedResults,
          data.testMap
        ).slice(0, 10);
  const testMetrics = assignedTests.length > 0 ? assignedTests : testsTaken;
  const scoreDistribution = buildClassroomScoreDistribution(studentIds, data.resultsByStudent);
  const studentsNeedingAttention = pickStudentsNeedingAttention(
    buildClassroomStudentRows(
      studentIds,
      assignedTestIds,
      data.studentMap,
      data.resultsByStudent,
      data.attemptsByStudent
    )
  );

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(5, parseInt(limit, 10) || 20));
  const total = students.length;
  const start = (safePage - 1) * safeLimit;

  return {
    classroom: {
      classroomId: classroom._id,
      classroomName: classroom.name,
      description: classroom.description || '',
      totalStudents,
      assignedTestsCount: assignedTestIds.length,
      assignedCompletionRate,
      attemptedCount: summary.attemptedStudents,
      completedCount: summary.completedStudents,
      notAttemptedCount: Math.max(0, totalStudents - summary.attemptedStudents),
      averageScore: summary.averageScore,
      totalSubmissions: classroomResults.length,
      activeStudents: summary.attemptedStudents,
      completionRate:
        totalStudents > 0 ? round((summary.completedStudents / totalStudents) * 100, 0) : 0,
      attemptRate:
        totalStudents > 0 ? round((summary.attemptedStudents / totalStudents) * 100, 0) : 0,
    },
    assignedTests: testMetrics,
    testsTaken,
    scoreDistribution,
    studentsNeedingAttention,
    students: students.slice(start, start + safeLimit),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

module.exports = {
  getAnalyticsOverview,
  getAnalyticsTests,
  getClassroomAnalytics,
};
