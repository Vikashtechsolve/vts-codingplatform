/**
 * Student course module assessment routing and progress sync.
 */

export function buildCourseAssessmentQuery(courseId, moduleId) {
  if (!courseId || !moduleId) return '';
  return `?courseId=${encodeURIComponent(courseId)}&moduleId=${encodeURIComponent(moduleId)}`;
}

/** Always a plain object — never null (Express rejects JSON body `null`). */
export function buildAssessmentStartBody({ courseId, moduleId, contestId } = {}) {
  const body = {};
  if (contestId) body.contestId = contestId;
  if (courseId && moduleId) {
    body.courseId = courseId;
    body.moduleId = moduleId;
  }
  return body;
}

export function studentRouteForAssessmentType(type, assessmentId, courseId, moduleId, kind) {
  if (!type || !assessmentId) return null;
  const qs = buildCourseAssessmentQuery(courseId, moduleId);
  switch (type) {
    case 'test':
      // English tests need the dedicated English taking UI
      return kind === 'english'
        ? `/student/english-test/${assessmentId}${qs}`
        : `/student/test/${assessmentId}${qs}`;
    case 'interview':
      return `/student/interviews/${assessmentId}${qs}`;
    case 'assignment':
      return `/student/submit-assignment/${assessmentId}${qs}`;
    case 'system_design':
      return `/student/system-design/${assessmentId}${qs}`;
    default:
      return null;
  }
}

export function officialScoreRouteForAssessment(type, submissionId, courseId, moduleId) {
  if (!submissionId) return null;
  const qs = buildCourseAssessmentQuery(courseId, moduleId);
  switch (type) {
    case 'test':
      return `/student/result/${submissionId}${qs}`;
    case 'interview':
      return `/student/interviews/feedback/${submissionId}${qs}`;
    case 'assignment':
      return `/student/submission/${submissionId}/result${qs}`;
    case 'system_design':
      return `/student/system-design-result/${submissionId}${qs}`;
    default:
      return null;
  }
}

export async function syncCourseModuleAssessment(axiosInstance, courseId, moduleId, submissionId) {
  if (!courseId || !moduleId || !submissionId) return null;
  const { data } = await axiosInstance.post(
    `/student/courses/${courseId}/modules/${moduleId}/quiz/complete`,
    { submissionId }
  );
  return data;
}

export const ASSESSMENT_TYPE_LABELS = {
  test: 'Module test',
  interview: 'Mock interview',
  assignment: 'AI project evaluation',
  system_design: 'System design',
};
