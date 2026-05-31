const SCORE_BUCKETS = [
  { label: '0–40%', min: 0, max: 40, count: 0 },
  { label: '41–60%', min: 41, max: 60, count: 0 },
  { label: '61–80%', min: 61, max: 80, count: 0 },
  { label: '81–100%', min: 81, max: 100, count: 0 },
];

const mapClassroomSummary = (classroom) => ({
  classroomId: classroom.classroomId || classroom._id,
  classroomName: classroom.classroomName || classroom.name || 'Classroom',
  description: classroom.description || '',
  totalStudents: classroom.totalStudents ?? 0,
  assignedTestsCount: classroom.assignedTestsCount ?? 0,
  assignedCompletionRate: classroom.assignedCompletionRate ?? null,
  attemptedCount: classroom.attemptedCount ?? 0,
  completedCount: classroom.completedCount ?? 0,
  notAttemptedCount: classroom.notAttemptedCount ?? 0,
  averageScore: classroom.averageScore ?? 0,
  completionRate: classroom.completionRate ?? 0,
  attemptRate: classroom.attemptRate ?? 0,
});

const mapTestRow = (test) => ({
  testId: test.testId || test._id,
  testTitle: test.testTitle || test.title || 'Untitled test',
  testType: test.testType || test.type || '',
  duration: test.duration,
  totalSubmissions: test.totalSubmissions ?? test.submissions ?? 0,
  uniqueStudents: test.uniqueStudents ?? test.totalSubmissions ?? test.submissions ?? 0,
  averageScore: test.averageScore ?? 0,
});

/** Normalize overview payload from new or legacy analytics API shapes. */
export function normalizeOverview(raw) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.summary) {
    return {
      summary: {
        totalTests: raw.summary.totalTests ?? 0,
        totalStudents: raw.summary.totalStudents ?? 0,
        activeStudents: raw.summary.activeStudents ?? 0,
        totalSubmissions: raw.summary.totalSubmissions ?? 0,
        totalAttempts: raw.summary.totalAttempts ?? 0,
        averageScore: raw.summary.averageScore ?? 0,
        completionRate: raw.summary.completionRate ?? 0,
        attemptRate: raw.summary.attemptRate ?? 0,
      },
      activityTrend: Array.isArray(raw.activityTrend) ? raw.activityTrend : [],
      scoreDistribution: Array.isArray(raw.scoreDistribution)
        ? raw.scoreDistribution
        : SCORE_BUCKETS.map(({ label }) => ({ label, count: 0 })),
      allTests: Array.isArray(raw.allTests)
        ? raw.allTests.map(mapTestRow)
        : Array.isArray(raw.topTests)
          ? raw.topTests.map(mapTestRow)
          : [],
      topTests: Array.isArray(raw.topTests) ? raw.topTests.map(mapTestRow) : [],
      topClassrooms: Array.isArray(raw.topClassrooms)
        ? raw.topClassrooms.map(mapClassroomSummary)
        : [],
      classroomSummaries: Array.isArray(raw.classroomSummaries)
        ? raw.classroomSummaries.map(mapClassroomSummary)
        : [],
    };
  }

  const classroomAnalytics = Array.isArray(raw.classroomAnalytics) ? raw.classroomAnalytics : [];
  const classroomSummaries = classroomAnalytics.map(mapClassroomSummary);
  const testPerformance = Array.isArray(raw.testPerformance) ? raw.testPerformance : [];

  return {
    summary: {
      totalTests: raw.totalTests ?? 0,
      totalStudents: raw.totalStudents ?? 0,
      activeStudents: raw.totalAttempts ?? 0,
      totalSubmissions: raw.totalSubmissions ?? 0,
      totalAttempts: raw.totalAttempts ?? 0,
      averageScore: raw.averageScore ?? 0,
      completionRate: raw.completionRate ?? 0,
      attemptRate: 0,
    },
    activityTrend: Array.isArray(raw.recentSubmissions) ? raw.recentSubmissions : [],
    scoreDistribution: SCORE_BUCKETS.map(({ label }) => ({ label, count: 0 })),
    allTests: testPerformance.map(mapTestRow),
    topTests: testPerformance.slice(0, 8).map(mapTestRow),
    topClassrooms: classroomSummaries.slice(0, 6),
    classroomSummaries,
  };
}

export function hasScoreDistributionData(buckets) {
  return Array.isArray(buckets) && buckets.some((bucket) => bucket.count > 0);
}

export function pieChartData(buckets) {
  if (!Array.isArray(buckets)) return [];
  return buckets.filter((bucket) => bucket.count > 0);
}

export function filterAndPaginateTests(tests, { search = '', sort = 'submissions', page = 1, limit = 12 } = {}) {
  const list = Array.isArray(tests) ? [...tests] : [];
  const q = search.trim().toLowerCase();

  let filtered = list;
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
  const safeLimit = Math.min(50, Math.max(5, parseInt(limit, 10) || 12));
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
