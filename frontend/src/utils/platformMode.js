import { useLocation } from 'react-router-dom';

export function isPlatformTestRoute(pathname = '') {
  return pathname.includes('/super-admin/tests');
}

export function isGlobalEnglishRoute(pathname = '') {
  return pathname.includes('/super-admin/global-questions/english');
}

export function getPlatformTestConfig(pathname = '') {
  const isPlatform = isPlatformTestRoute(pathname);
  return {
    isPlatform,
    testsApiBase: isPlatform ? '/super-admin/tests' : '/tests',
    testsListPath: isPlatform ? '/super-admin/tests' : '/vendor-admin/tests',
    questionsApiBase: isPlatform ? '/super-admin/global-questions' : '/questions',
    englishApiBase: isGlobalEnglishRoute(pathname)
      ? '/super-admin/global-questions/english'
      : '/questions/english',
    datasetTemplatesApiBase: isPlatform
      ? '/super-admin/tests/meta/dataset-templates'
      : '/dataset-templates',
    lockQuestionSourceToGlobal: isPlatform,
    hideSchedule: isPlatform,
  };
}

export function getPlatformSqlQuestionsApi(testId, pathname = '') {
  const isPlatform = isPlatformTestRoute(pathname);
  if (isPlatform) {
    return {
      list: `/super-admin/tests/${testId}/sql-questions`,
      create: `/super-admin/tests/${testId}/sql-questions`,
      update: (questionId) => `/super-admin/tests/${testId}/sql-questions/${questionId}`,
      delete: (questionId) => `/super-admin/tests/${testId}/sql-questions/${questionId}`,
      runQuery: `/super-admin/tests/${testId}/sql-questions/run-query`,
      validate: `/super-admin/tests/${testId}/sql-questions/validate`,
    };
  }
  return {
    list: `/sql-questions/test/${testId}`,
    create: '/sql-questions',
    update: (questionId) => `/sql-questions/${questionId}`,
    delete: (questionId) => `/sql-questions/${questionId}`,
    runQuery: `/sql-questions/test/${testId}/run-query`,
    validate: `/sql-questions/test/${testId}/validate`,
  };
}

export function isPlatformAssessmentRoute(pathname = '') {
  return pathname.includes('/super-admin/assessments');
}

export function getPlatformAssessmentConfig(pathname = '') {
  const isPlatform = isPlatformAssessmentRoute(pathname);
  return {
    isPlatform,
    interviewsApiBase: isPlatform ? '/super-admin/interviews' : '/interviews',
    assignmentsApiBase: isPlatform ? '/super-admin/assignments' : '/assignments',
    systemDesignApiBase: isPlatform
      ? '/super-admin/system-design-problems'
      : '/system-design-problems',
    interviewQuestionsApiBase: isPlatform
      ? '/super-admin/interview-questions'
      : '/interview-questions',
    listPath: '/super-admin/assessments',
    hideSchedule: isPlatform,
  };
}

export function usePlatformTestConfig() {
  const location = useLocation();
  return getPlatformTestConfig(location.pathname);
}

export function usePlatformAssessmentConfig() {
  const location = useLocation();
  return getPlatformAssessmentConfig(location.pathname);
}
