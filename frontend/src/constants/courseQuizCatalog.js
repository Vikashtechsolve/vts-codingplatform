export const SUPER_ADMIN_QUIZ_CATALOG = {
  tabs: [
    { id: 'test', label: 'Tests', path: '/super-admin/tests' },
    { id: 'interview', label: 'Interviews', path: '/super-admin/interviews' },
    { id: 'assignment', label: 'AI projects', path: '/super-admin/assignments' },
    { id: 'system_design', label: 'System design', path: '/super-admin/system-design-problems' },
  ],
  questionsPath: (type) => `/super-admin/global-questions/${type}`,
  questionSources: null,
  defaultQuestionSource: 'global',
};

export const VENDOR_QUIZ_CATALOG = {
  tabs: [
    { id: 'test', label: 'Tests', path: '/vendor-admin/tests' },
    { id: 'interview', label: 'Interviews', path: '/interviews' },
    { id: 'assignment', label: 'AI projects', path: '/assignments' },
    { id: 'system_design', label: 'System design', path: '/system-design-problems' },
  ],
  questionsPath: (type) => `/questions/${type}`,
  questionSources: [
    { id: 'all', label: 'All questions' },
    { id: 'vendor', label: 'My questions' },
    { id: 'global', label: 'Global bank' },
  ],
  defaultQuestionSource: 'all',
};

export const UNLOCK_MODE_OPTIONS = [
  {
    id: 'sequential',
    label: 'Unlock in order',
    description: 'Students open the next module only after they finish the previous one — lectures and any quiz.',
  },
  {
    id: 'open',
    label: 'All modules open',
    description: 'Every module is available from the start. Students can jump around freely.',
  },
];
