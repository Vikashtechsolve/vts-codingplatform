const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');

const ASSESSMENT_TYPES = ['test', 'interview', 'assignment', 'system_design'];

function moduleAssessmentRef(mod) {
  if (!mod) return null;
  if (mod.testId) return { type: 'test', id: mod.testId };
  if (mod.interviewId) return { type: 'interview', id: mod.interviewId };
  if (mod.assignmentId) return { type: 'assignment', id: mod.assignmentId };
  if (mod.systemDesignProblemId) {
    return { type: 'system_design', id: mod.systemDesignProblemId };
  }
  return null;
}

function moduleHasAssessment(mod) {
  return !!moduleAssessmentRef(mod);
}

/**
 * Mixed tests holding only English question types behave as English tests
 * (matches student dashboard grouping) so they route to the English UI.
 */
function effectiveTestKind(test) {
  if (
    test?.type === 'mixed' &&
    Array.isArray(test.questions) &&
    test.questions.length > 0 &&
    test.questions.every((q) => (q.type || '').startsWith('english_'))
  ) {
    return 'english';
  }
  return test?.type;
}

/**
 * Batch-check which modules reference an assessment doc that still exists.
 * Guards against deleted tests/interviews/etc. locking a course forever.
 * Returns a Set of module id strings that have a live assessment.
 */
async function liveAssessmentModuleIds(modules) {
  const refs = (modules || [])
    .map((mod) => ({ mod, ref: moduleAssessmentRef(mod) }))
    .filter((x) => x.ref);
  if (!refs.length) return new Set();

  const idsByType = { test: [], interview: [], assignment: [], system_design: [] };
  for (const { ref } of refs) idsByType[ref.type].push(ref.id);

  const [tests, interviews, assignments, problems] = await Promise.all([
    idsByType.test.length
      ? Test.find({ _id: { $in: idsByType.test } }).select('_id').lean()
      : [],
    idsByType.interview.length
      ? Interview.find({ _id: { $in: idsByType.interview } }).select('_id').lean()
      : [],
    idsByType.assignment.length
      ? Assignment.find({ _id: { $in: idsByType.assignment } }).select('_id').lean()
      : [],
    idsByType.system_design.length
      ? SystemDesignProblem.find({ _id: { $in: idsByType.system_design } }).select('_id').lean()
      : [],
  ]);

  const liveByType = {
    test: new Set(tests.map((d) => String(d._id))),
    interview: new Set(interviews.map((d) => String(d._id))),
    assignment: new Set(assignments.map((d) => String(d._id))),
    system_design: new Set(problems.map((d) => String(d._id))),
  };

  const live = new Set();
  for (const { mod, ref } of refs) {
    if (liveByType[ref.type].has(String(ref.id))) live.add(String(mod._id));
  }
  return live;
}

async function loadModuleAssessmentMeta(mod) {
  const ref = moduleAssessmentRef(mod);
  if (!ref) return null;

  if (ref.type === 'test') {
    const test = await Test.findById(ref.id)
      .select('title type duration questions source')
      .lean();
    if (!test) return null;
    const kind = effectiveTestKind(test);
    return {
      type: 'test',
      id: test._id,
      title: test.title,
      kind,
      durationMin: test.duration,
      questionCount: test.questions?.length || 0,
      label: formatTestLabel(kind),
    };
  }

  if (ref.type === 'interview') {
    const interview = await Interview.findById(ref.id)
      .select('title interviewType topic difficulty duration settings')
      .lean();
    if (!interview) return null;
    return {
      type: 'interview',
      id: interview._id,
      title: interview.title,
      kind: interview.interviewType || 'interview',
      durationMin: interview.duration,
      label: 'Mock interview',
      topic: interview.topic,
      difficulty: interview.difficulty,
    };
  }

  if (ref.type === 'assignment') {
    const assignment = await Assignment.findById(ref.id)
      .select('title category difficulty duration totalMarks')
      .lean();
    if (!assignment) return null;
    return {
      type: 'assignment',
      id: assignment._id,
      title: assignment.title,
      kind: assignment.category || 'project',
      durationMin: assignment.duration,
      maxScore: assignment.totalMarks,
      label: 'AI project evaluation',
    };
  }

  if (ref.type === 'system_design') {
    const problem = await SystemDesignProblem.findById(ref.id)
      .select('title difficulty estimatedTime category')
      .lean();
    if (!problem) return null;
    return {
      type: 'system_design',
      id: problem._id,
      title: problem.title,
      kind: problem.category || 'system_design',
      durationMin: problem.estimatedTime,
      label: 'System design',
      difficulty: problem.difficulty,
    };
  }

  return null;
}

function formatTestLabel(type) {
  const map = {
    coding: 'Coding test',
    mcq: 'MCQ test',
    aptitude: 'Aptitude test',
    theory: 'Theory test',
    mixed: 'Mixed test',
    sql: 'SQL test',
    english: 'English test',
  };
  return map[type] || 'Module test';
}

function studentRouteForAssessment(meta) {
  if (!meta) return null;
  const qs = (courseId, moduleId) =>
    courseId && moduleId ? `?courseId=${courseId}&moduleId=${moduleId}` : '';
  switch (meta.type) {
    case 'test':
      return (courseId, moduleId) =>
        `/student/test/${meta.id}${qs(courseId, moduleId)}`;
    case 'interview':
      return (courseId, moduleId) =>
        `/student/interviews/${meta.id}${qs(courseId, moduleId)}`;
    case 'assignment':
      return (courseId, moduleId) =>
        `/student/assignments/${meta.id}${qs(courseId, moduleId)}`;
    case 'system_design':
      return (courseId, moduleId) =>
        `/student/system-design/${meta.id}${qs(courseId, moduleId)}`;
    default:
      return null;
  }
}

module.exports = {
  ASSESSMENT_TYPES,
  moduleAssessmentRef,
  moduleHasAssessment,
  liveAssessmentModuleIds,
  effectiveTestKind,
  loadModuleAssessmentMeta,
  formatTestLabel,
  studentRouteForAssessment,
};
