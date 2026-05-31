/** Metadata for vendor question create/edit pages */

export const QUESTION_FORM_META = {
  coding: {
    accent: '#2563eb',
    label: 'Coding',
    createTitle: 'Create coding question',
    editTitle: 'Edit coding question',
    subtitle: 'Problem statement, test cases, starter code, and language templates.',
    back: '/vendor-admin/questions',
  },
  mcq: {
    accent: '#7c3aed',
    label: 'MCQ',
    createTitle: 'Create MCQ question',
    editTitle: 'Edit MCQ question',
    subtitle: 'Question text, answer options, and optional explanation.',
    back: '/vendor-admin/questions',
  },
  aptitude: {
    accent: '#059669',
    label: 'Aptitude',
    createTitle: 'Create aptitude question',
    editTitle: 'Edit aptitude question',
    subtitle: 'Quantitative, verbal, or logical items with MCQ or numeric answers.',
    back: '/vendor-admin/questions',
  },
  theory: {
    accent: '#475569',
    label: 'Theory',
    createTitle: 'Create theory question',
    editTitle: 'Edit theory question',
    subtitle: 'Subject, topic, reference answer, and AI evaluation settings.',
    back: '/vendor-admin/questions',
  },
  english: {
    accent: '#db2777',
    label: 'English & verbal',
    createTitle: 'Create English question',
    editTitle: 'Edit English question',
    subtitle: 'Verbal assessment content with type-specific fields.',
    back: '/vendor-admin/english-questions',
  },
};

export function getQuestionFormPaths(isGlobal) {
  if (isGlobal) {
    return { back: '/super-admin/global-questions', apiBase: '/super-admin/global-questions' };
  }
  return { back: '/vendor-admin/questions', apiBase: '/questions' };
}
