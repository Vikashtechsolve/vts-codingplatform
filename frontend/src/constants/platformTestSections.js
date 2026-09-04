import {
  FiCode,
  FiCheckSquare,
  FiTrendingUp,
  FiBookOpen,
  FiLayers,
  FiMessageCircle,
  FiTool,
} from 'react-icons/fi';

/** Platform test types super admin can create and allocate to vendors */
export const PLATFORM_TEST_SECTIONS = [
  {
    id: 'coding',
    label: 'Coding Tests',
    shortLabel: 'Coding',
    testType: 'coding',
    icon: FiCode,
    accent: '#2563eb',
    description: 'DSA problems with automated code evaluation from the global bank.',
    actions: [
      { label: 'Question bank', to: '/super-admin/global-questions?type=coding' },
      { label: 'New question', to: '/super-admin/global-questions/coding/create' },
      { label: 'Create test', to: '/super-admin/tests/create?type=coding', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=coding' },
    ],
  },
  {
    id: 'mcq',
    label: 'MCQ Tests',
    shortLabel: 'MCQ',
    testType: 'mcq',
    icon: FiCheckSquare,
    accent: '#7c3aed',
    description: 'Single and multiple-choice objective questions.',
    actions: [
      { label: 'Question bank', to: '/super-admin/global-questions?type=mcq' },
      { label: 'New question', to: '/super-admin/global-questions/mcq/create' },
      { label: 'Create test', to: '/super-admin/tests/create?type=mcq', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=mcq' },
    ],
  },
  {
    id: 'aptitude',
    label: 'Aptitude Tests',
    shortLabel: 'Aptitude',
    testType: 'aptitude',
    icon: FiTrendingUp,
    accent: '#059669',
    description: 'Quantitative, logical, and analytical aptitude.',
    actions: [
      { label: 'Question bank', to: '/super-admin/global-questions?type=aptitude' },
      { label: 'New question', to: '/super-admin/global-questions/aptitude/create' },
      { label: 'Create test', to: '/super-admin/tests/create?type=aptitude', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=aptitude' },
    ],
  },
  {
    id: 'theory',
    label: 'Theory / Core CS',
    shortLabel: 'Theory',
    testType: 'theory',
    icon: FiBookOpen,
    accent: '#475569',
    description: 'OS, DBMS, networks, and conceptual answers.',
    actions: [
      { label: 'Question bank', to: '/super-admin/global-questions?type=theory' },
      { label: 'New question', to: '/super-admin/global-questions/theory/create' },
      { label: 'Create test', to: '/super-admin/tests/create?type=theory', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=theory' },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed Tests',
    shortLabel: 'Mixed',
    testType: 'mixed',
    icon: FiLayers,
    accent: '#0891b2',
    description: 'Combine coding, MCQ, aptitude, and theory in one assessment.',
    actions: [
      { label: 'Create test', to: '/super-admin/tests/create?type=mixed', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=mixed' },
    ],
  },
  {
    id: 'english',
    label: 'English & Verbal',
    shortLabel: 'English',
    testType: 'english',
    icon: FiMessageCircle,
    accent: '#db2777',
    description: 'Grammar, vocabulary, reading, writing, speaking, and listening.',
    actions: [
      { label: 'English questions', to: '/super-admin/global-questions/english' },
      { label: 'Create test', to: '/super-admin/tests/english/create', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=english' },
    ],
  },
  {
    id: 'sql',
    label: 'Practical Tools (SQL)',
    shortLabel: 'SQL',
    testType: 'sql',
    icon: FiTool,
    accent: '#ca8a04',
    description: 'Platform dataset templates and SQL exams with output validation.',
    actions: [
      { label: 'Dataset templates', to: '/super-admin/tests/dataset-templates' },
      { label: 'Create SQL test', to: '/super-admin/tests/sql/create', primary: true },
      { label: 'View tests', to: '/super-admin/tests?type=sql' },
    ],
  },
];

export const PLATFORM_TEST_TYPE_LABELS = Object.fromEntries(
  PLATFORM_TEST_SECTIONS.map((s) => [s.testType, s.shortLabel])
);

export function getPlatformTestSectionByType(type) {
  return PLATFORM_TEST_SECTIONS.find((s) => s.testType === type) || null;
}

export const PLATFORM_QUESTION_CREATE_LINKS = {
  coding: '/super-admin/global-questions/coding/create',
  mcq: '/super-admin/global-questions/mcq/create',
  aptitude: '/super-admin/global-questions/aptitude/create',
  theory: '/super-admin/global-questions/theory/create',
};
