/**
 * Report column definitions per assessment category.
 * `default: true` columns are pre-selected in the export UI.
 */

const col = (key, label, opts = {}) => ({
  key,
  label,
  sheet: opts.sheet || 'summary',
  default: opts.default !== false,
  group: opts.group || 'general',
  width: opts.width || 18,
  types: opts.types || null,
});

// —— Timed tests (Test model) ——
const TEST_SUMMARY_COLUMNS = [
  col('studentName', 'Student Name', { default: true, width: 22 }),
  col('studentEmail', 'Email', { default: true, width: 28 }),
  col('enrollmentStatus', 'Enrollment Status', { default: true }),
  col('assignedAt', 'Assigned At', { default: false }),
  col('attemptStatus', 'Attempt Status', { default: true }),
  col('startedAt', 'Started At', { default: true }),
  col('submittedAt', 'Submitted At', { default: true }),
  col('timeSpentMinutes', 'Time Spent (min)', { default: true }),
  col('totalScore', 'Total Score', { default: true }),
  col('maxScore', 'Max Score', { default: true }),
  col('percentage', 'Percentage (%)', { default: true }),
  col('rank', 'Rank', { default: true }),
  col('violationCount', 'Violations', { default: true }),
  col('autoSubmitted', 'Auto Submitted', { default: true }),
  col('violationSummary', 'Violation Types', { default: false }),
];

const TEST_DETAIL_BASE = [
  col('studentName', 'Student Name', { sheet: 'detail', default: true, width: 20 }),
  col('studentEmail', 'Email', { sheet: 'detail', default: true, width: 24 }),
  col('questionOrder', 'Q#', { sheet: 'detail', default: true, width: 6 }),
  col('questionType', 'Question Type', { sheet: 'detail', default: true }),
  col('questionTitle', 'Question', { sheet: 'detail', default: true, width: 36 }),
  col('points', 'Points Earned', { sheet: 'detail', default: true }),
  col('maxPoints', 'Max Points', { sheet: 'detail', default: true }),
  col('isCorrect', 'Correct', { sheet: 'detail', default: true }),
  col('studentAnswer', 'Student Answer', { sheet: 'detail', default: true, width: 40 }),
];

const TEST_DETAIL_CODING = [
  col('language', 'Language', { sheet: 'detail', default: true, types: ['coding'] }),
  col('testCasesPassed', 'Test Cases Passed', { sheet: 'detail', default: true, types: ['coding'] }),
  col('totalTestCases', 'Total Test Cases', { sheet: 'detail', default: true, types: ['coding'] }),
];

const TEST_DETAIL_THEORY = [
  col('similarityScore', 'Similarity Score', { sheet: 'detail', default: true, types: ['theory'] }),
  col('conceptScore', 'Concept Score', { sheet: 'detail', default: true, types: ['theory'] }),
  col('depthScore', 'Depth Score', { sheet: 'detail', default: true, types: ['theory'] }),
  col('theoryFeedback', 'AI Feedback', { sheet: 'detail', default: false, types: ['theory'], width: 36 }),
];

const TEST_DETAIL_ENGLISH = [
  col('grammarScore', 'Grammar Score', { sheet: 'detail', default: true, types: ['english_grammar', 'english_essay'] }),
  col('vocabularyScore', 'Vocabulary Score', { sheet: 'detail', default: true, types: ['english_vocabulary', 'english_essay'] }),
  col('coherenceScore', 'Coherence Score', { sheet: 'detail', default: true, types: ['english_essay'] }),
  col('pronunciationScore', 'Pronunciation', { sheet: 'detail', default: true, types: ['english_speaking'] }),
  col('fluencyScore', 'Fluency', { sheet: 'detail', default: true, types: ['english_speaking'] }),
  col('speakingRate', 'Speaking Rate (WPM)', { sheet: 'detail', default: true, types: ['english_speaking'] }),
  col('plagiarismScore', 'Originality Score', { sheet: 'detail', default: true, types: ['english_essay'] }),
  col('englishFeedback', 'Evaluation Feedback', { sheet: 'detail', default: false, types: ['english_grammar', 'english_vocabulary', 'english_reading', 'english_essay', 'english_speaking', 'english_listening'], width: 36 }),
];

const TEST_SECTION_COLUMNS = [
  col('studentName', 'Student Name', { sheet: 'sections', default: true, width: 20 }),
  col('studentEmail', 'Email', { sheet: 'sections', default: true, width: 24 }),
  col('sectionType', 'Section', { sheet: 'sections', default: true }),
  col('sectionScore', 'Section Score', { sheet: 'sections', default: true }),
  col('sectionMaxScore', 'Section Max', { sheet: 'sections', default: true }),
  col('sectionPercentage', 'Section %', { sheet: 'sections', default: true }),
];

// —— Mock interviews ——
const INTERVIEW_SUMMARY_COLUMNS = [
  col('studentName', 'Student Name', { default: true, width: 22 }),
  col('studentEmail', 'Email', { default: true, width: 28 }),
  col('enrollmentStatus', 'Enrollment Status', { default: true }),
  col('attemptStatus', 'Session Status', { default: true }),
  col('startedAt', 'Started At', { default: true }),
  col('submittedAt', 'Completed At', { default: true }),
  col('timeSpentMinutes', 'Time Spent (min)', { default: true }),
  col('overallScore', 'Overall Score', { default: true }),
  col('readinessPercent', 'Readiness %', { default: true }),
  col('finalFeedbackSummary', 'Final Feedback', { default: false, width: 40 }),
];

const INTERVIEW_DETAIL_COLUMNS = [
  col('studentName', 'Student Name', { sheet: 'detail', default: true, width: 20 }),
  col('studentEmail', 'Email', { sheet: 'detail', default: true, width: 24 }),
  col('questionIndex', 'Q#', { sheet: 'detail', default: true, width: 6 }),
  col('questionText', 'Question', { sheet: 'detail', default: true, width: 36 }),
  col('transcript', 'Transcript', { sheet: 'detail', default: true, width: 40 }),
  col('correctness', 'Correctness', { sheet: 'detail', default: true }),
  col('depth', 'Depth', { sheet: 'detail', default: true }),
  col('structure', 'Structure', { sheet: 'detail', default: true }),
  col('confidence', 'Confidence', { sheet: 'detail', default: true }),
  col('relevance', 'Relevance', { sheet: 'detail', default: true }),
  col('overall', 'Overall', { sheet: 'detail', default: true }),
  col('answerFeedback', 'Feedback', { sheet: 'detail', default: false, width: 36 }),
];

// —— Project assignments ——
const ASSIGNMENT_SUMMARY_COLUMNS = [
  col('studentName', 'Student Name', { default: true, width: 22 }),
  col('studentEmail', 'Email', { default: true, width: 28 }),
  col('enrollmentStatus', 'Enrollment Status', { default: true }),
  col('submissionStatus', 'Submission Status', { default: true }),
  col('submittedAt', 'Submitted At', { default: true }),
  col('isLateSubmission', 'Late Submission', { default: true }),
  col('repositoryUrl', 'Repository URL', { default: true, width: 32 }),
  col('totalScore', 'Total Score', { default: true }),
  col('totalPossibleScore', 'Max Score', { default: true }),
  col('percentage', 'Percentage (%)', { default: true }),
  col('grade', 'Grade', { default: true }),
  col('featureCompletionPct', 'Feature Completion %', { default: true }),
  col('codeQualityPct', 'Code Quality %', { default: true }),
  col('architecturePct', 'Architecture %', { default: true }),
];

const ASSIGNMENT_DETAIL_COLUMNS = [
  col('studentName', 'Student Name', { sheet: 'detail', default: true, width: 20 }),
  col('studentEmail', 'Email', { sheet: 'detail', default: true, width: 24 }),
  col('featureName', 'Feature', { sheet: 'detail', default: true, width: 28 }),
  col('featureStatus', 'Status', { sheet: 'detail', default: true }),
  col('featureScore', 'Score', { sheet: 'detail', default: true }),
  col('featureMaxScore', 'Max Score', { sheet: 'detail', default: true }),
  col('featureFeedback', 'Feedback', { sheet: 'detail', default: false, width: 36 }),
];

// —— System design ——
const SYSTEM_DESIGN_SUMMARY_COLUMNS = [
  col('studentName', 'Student Name', { default: true, width: 22 }),
  col('studentEmail', 'Email', { default: true, width: 28 }),
  col('assignmentStatus', 'Assignment Status', { default: true }),
  col('submissionStatus', 'Submission Status', { default: true }),
  col('startedAt', 'Started At', { default: true }),
  col('submittedAt', 'Submitted At', { default: true }),
  col('timeSpentMinutes', 'Time Spent (min)', { default: true }),
  col('totalScore', 'Total Score', { default: true }),
  col('maxScore', 'Max Score', { default: true }),
  col('percentage', 'Percentage (%)', { default: true }),
  col('hintsUsedCount', 'Hints Used', { default: true }),
  col('violationsCount', 'Violations', { default: true }),
];

const SYSTEM_DESIGN_DETAIL_COLUMNS = [
  col('studentName', 'Student Name', { sheet: 'detail', default: true, width: 20 }),
  col('studentEmail', 'Email', { sheet: 'detail', default: true, width: 24 }),
  col('sectionName', 'Section', { sheet: 'detail', default: true, width: 22 }),
  col('sectionScore', 'Score', { sheet: 'detail', default: true }),
  col('sectionMaxScore', 'Max Score', { sheet: 'detail', default: true }),
  col('sectionFeedback', 'Feedback', { sheet: 'detail', default: false, width: 36 }),
];

const QUESTION_TYPES_BY_TEST_TYPE = {
  coding: ['coding'],
  mcq: ['mcq'],
  aptitude: ['aptitude'],
  theory: ['theory'],
  sql: ['sql'],
  english: ['english_grammar', 'english_vocabulary', 'english_reading', 'english_essay', 'english_speaking', 'english_listening'],
  mixed: null,
};

function getQuestionTypesForTest(test) {
  if (!test) return [];
  if (test.type !== 'mixed') {
    return QUESTION_TYPES_BY_TEST_TYPE[test.type] || [];
  }
  return [...new Set((test.questions || []).map((q) => q.type))];
}

function filterColumnsByQuestionTypes(columns, questionTypes) {
  return columns.filter((c) => {
    if (!c.types || c.types.length === 0) return true;
    return c.types.some((t) => questionTypes.includes(t));
  });
}

function getTestReportOptions(test) {
  const questionTypes = getQuestionTypesForTest(test);
  const hasEnglish = questionTypes.some((t) => t.startsWith('english_'));

  const detailExtra = [
    ...TEST_DETAIL_CODING,
    ...TEST_DETAIL_THEORY,
    ...TEST_DETAIL_ENGLISH,
  ];

  const columns = [
    ...TEST_SUMMARY_COLUMNS,
    ...TEST_DETAIL_BASE,
    ...filterColumnsByQuestionTypes(detailExtra, questionTypes),
    ...(hasEnglish ? TEST_SECTION_COLUMNS : []),
  ];

  const defaultSelected = columns.filter((c) => c.default).map((c) => c.key);

  return {
    assessmentType: 'test',
    testType: test.type,
    questionTypes,
    columns,
    defaultSelected,
    sheets: [
      { id: 'summary', label: 'Student Summary', description: 'One row per enrolled student' },
      { id: 'detail', label: 'Question Breakdown', description: 'One row per student per question' },
      ...(hasEnglish ? [{ id: 'sections', label: 'English Sections', description: 'Per-section scores' }] : []),
    ],
  };
}

function getInterviewReportOptions() {
  const columns = [...INTERVIEW_SUMMARY_COLUMNS, ...INTERVIEW_DETAIL_COLUMNS];
  return {
    assessmentType: 'interview',
    columns,
    defaultSelected: columns.filter((c) => c.default).map((c) => c.key),
    sheets: [
      { id: 'summary', label: 'Student Summary', description: 'One row per enrolled student' },
      { id: 'detail', label: 'Question Breakdown', description: 'One row per interview answer' },
    ],
  };
}

function getAssignmentReportOptions() {
  const columns = [...ASSIGNMENT_SUMMARY_COLUMNS, ...ASSIGNMENT_DETAIL_COLUMNS];
  return {
    assessmentType: 'assignment',
    columns,
    defaultSelected: columns.filter((c) => c.default).map((c) => c.key),
    sheets: [
      { id: 'summary', label: 'Student Summary', description: 'One row per enrolled student' },
      { id: 'detail', label: 'Feature Evaluation', description: 'Per-feature scores from AI evaluation' },
    ],
  };
}

function getSystemDesignReportOptions() {
  const columns = [...SYSTEM_DESIGN_SUMMARY_COLUMNS, ...SYSTEM_DESIGN_DETAIL_COLUMNS];
  return {
    assessmentType: 'system_design',
    columns,
    defaultSelected: columns.filter((c) => c.default).map((c) => c.key),
    sheets: [
      { id: 'summary', label: 'Student Summary', description: 'One row per assigned student' },
      { id: 'detail', label: 'Section Scores', description: 'Per-section evaluation breakdown' },
    ],
  };
}

function getColumnDefs(category, test) {
  switch (category) {
    case 'test':
      return getTestReportOptions(test);
    case 'interview':
      return getInterviewReportOptions();
    case 'assignment':
      return getAssignmentReportOptions();
    case 'system_design':
      return getSystemDesignReportOptions();
    default:
      throw new Error(`Unknown report category: ${category}`);
  }
}

function resolveColumns(category, test, selectedKeys) {
  const { columns } = getColumnDefs(category, test);
  const keySet = new Set(selectedKeys);
  return columns.filter((c) => keySet.has(c.key));
}

module.exports = {
  getTestReportOptions,
  getInterviewReportOptions,
  getAssignmentReportOptions,
  getSystemDesignReportOptions,
  getColumnDefs,
  resolveColumns,
};
