import {
  FiHome,
  FiCode,
  FiTrendingUp,
  FiCheckSquare,
  FiLayers,
  FiMessageCircle,
  FiBookOpen,
  FiCpu,
  FiMic,
  FiBox,
  FiTool,
  FiBriefcase,
  FiUsers,
  FiGrid,
  FiHelpCircle,
  FiBell,
  FiBarChart2,
  FiSettings,
  FiList,
  FiAward,
} from 'react-icons/fi';

/** Matches student panel accent — use sparingly */
export const VENDOR_ACCENT = '#e7210b';

export const VENDOR_MENU_SECTIONS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    path: '/vendor-admin/dashboard',
    icon: FiHome,
    accent: '#0f172a',
    isOverview: true,
  },
  {
    id: 'tests',
    label: 'All Tests',
    shortLabel: 'Tests',
    path: '/vendor-admin/tests',
    icon: FiList,
    accent: '#334155',
  },
  {
    id: 'questions',
    label: 'Question Bank',
    shortLabel: 'Questions',
    path: '/vendor-admin/questions',
    icon: FiHelpCircle,
    accent: '#475569',
  },
  {
    id: 'students',
    label: 'Students',
    shortLabel: 'Students',
    path: '/vendor-admin/students',
    icon: FiUsers,
    accent: '#059669',
  },
  {
    id: 'classrooms',
    label: 'Classrooms',
    shortLabel: 'Classrooms',
    path: '/vendor-admin/classrooms',
    icon: FiGrid,
    accent: '#0891b2',
  },
  {
    id: 'courses',
    label: 'Courses',
    shortLabel: 'Courses',
    path: '/vendor-admin/courses',
    icon: FiBookOpen,
    accent: '#0f766e',
  },
  {
    id: 'contests',
    label: 'Contests',
    shortLabel: 'Contests',
    path: '/vendor-admin/contests',
    icon: FiAward,
    accent: VENDOR_ACCENT,
  },
  {
    id: 'announcements',
    label: 'Announcements',
    shortLabel: 'Announce',
    path: '/vendor-admin/announcements',
    icon: FiBell,
    accent: '#e7210b',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    shortLabel: 'Analytics',
    path: '/vendor-admin/analytics',
    icon: FiBarChart2,
    accent: '#6366f1',
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    path: '/vendor-admin/settings',
    icon: FiSettings,
    accent: '#64748b',
  },
];

/** Test-type sections — shown under Assessments in the sidebar */
export const VENDOR_TEST_SECTIONS = [
  {
    id: 'coding',
    label: 'Coding Tests',
    shortLabel: 'Coding',
    path: '/vendor-admin/tests',
    testType: 'coding',
    icon: FiCode,
    accent: '#2563eb',
    description: 'DSA problems with automated code evaluation.',
    actions: [
      { label: 'Question bank', to: '/vendor-admin/questions?type=coding' },
      { label: 'New question', to: '/vendor-admin/questions/coding/create', primary: false },
      { label: 'Create test', to: '/vendor-admin/tests/create?type=coding', primary: true },
      { label: 'View tests', to: '/vendor-admin/tests?type=coding' },
    ],
  },
  {
    id: 'aptitude',
    label: 'Aptitude Tests',
    shortLabel: 'Aptitude',
    path: '/vendor-admin/tests',
    testType: 'aptitude',
    icon: FiTrendingUp,
    accent: '#059669',
    description: 'Quantitative, logical, and analytical aptitude.',
    actions: [
      { label: 'Question bank', to: '/vendor-admin/questions?type=aptitude' },
      { label: 'New question', to: '/vendor-admin/questions/aptitude/create' },
      { label: 'Create test', to: '/vendor-admin/tests/create?type=aptitude', primary: true },
      { label: 'View tests', to: '/vendor-admin/tests?type=aptitude' },
    ],
  },
  {
    id: 'mcq',
    label: 'MCQ Tests',
    shortLabel: 'MCQ',
    path: '/vendor-admin/tests',
    testType: 'mcq',
    icon: FiCheckSquare,
    accent: '#7c3aed',
    description: 'Single and multiple-choice objective questions.',
    actions: [
      { label: 'Question bank', to: '/vendor-admin/questions?type=mcq' },
      { label: 'New question', to: '/vendor-admin/questions/mcq/create' },
      { label: 'Create test', to: '/vendor-admin/tests/create?type=mcq', primary: true },
      { label: 'View tests', to: '/vendor-admin/tests?type=mcq' },
    ],
  },
  {
    id: 'english',
    label: 'English & Verbal',
    shortLabel: 'English',
    path: '/vendor-admin/tests',
    testType: 'english',
    icon: FiMessageCircle,
    accent: '#db2777',
    description: 'Grammar, vocabulary, reading, writing, speaking, listening.',
    actions: [
      { label: 'English questions', to: '/vendor-admin/english-questions' },
      { label: 'Create test', to: '/vendor-admin/english-tests/create', primary: true },
      { label: 'View tests', to: '/vendor-admin/tests?type=english' },
    ],
  },
  {
    id: 'theory',
    label: 'Theory / Core CS',
    shortLabel: 'Theory',
    path: '/vendor-admin/tests',
    testType: 'theory',
    icon: FiBookOpen,
    accent: '#475569',
    description: 'OS, DBMS, networks, and conceptual answers.',
    actions: [
      { label: 'Question bank', to: '/vendor-admin/questions?type=theory' },
      { label: 'New question', to: '/vendor-admin/questions/theory/create' },
      { label: 'Create test', to: '/vendor-admin/tests/create?type=theory', primary: true },
      { label: 'View tests', to: '/vendor-admin/tests?type=theory' },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed Tests',
    shortLabel: 'Mixed',
    path: '/vendor-admin/tests',
    testType: 'mixed',
    icon: FiLayers,
    accent: '#0891b2',
    description: 'Combine multiple question types in one assessment.',
    actions: [
      { label: 'Create test', to: '/vendor-admin/tests/create?type=mixed', primary: true },
      { label: 'View tests', to: '/vendor-admin/tests?type=mixed' },
    ],
  },
  {
    id: 'project',
    label: 'Project Evaluation (AI)',
    shortLabel: 'Projects',
    path: '/vendor-admin/tests?type=project',
    hub: 'assignments',
    testType: 'project',
    icon: FiCpu,
    accent: '#6366f1',
    description: 'AI-based repository review, rubrics, and scoring.',
    actions: [
      { label: 'Create assignment', to: '/vendor-admin/create-assignment', primary: true },
      { label: 'All assignments', to: '/vendor-admin/tests?type=project' },
    ],
  },
  {
    id: 'interview',
    label: 'Interview Tests',
    shortLabel: 'Interview',
    path: '/vendor-admin/tests?type=interview',
    hub: 'interviews',
    testType: 'interview',
    icon: FiMic,
    accent: '#c026d3',
    description: 'Voice-based AI mock interviews by topic and difficulty.',
    actions: [
      { label: 'Create interview', to: '/vendor-admin/interviews/create', primary: true },
      { label: 'All interviews', to: '/vendor-admin/tests?type=interview' },
      { label: 'Question pool', to: '/vendor-admin/interview-questions' },
    ],
  },
  {
    id: 'system',
    label: 'System Design',
    shortLabel: 'System',
    path: '/vendor-admin/tests?type=system',
    hub: 'system_design',
    testType: 'system',
    icon: FiBox,
    accent: '#ea580c',
    description: 'Architecture diagrams, capacity planning, and trade-offs.',
    actions: [
      { label: 'Create problem', to: '/vendor-admin/system-designs/create', primary: true },
      { label: 'All problems', to: '/vendor-admin/tests?type=system' },
    ],
  },
  {
    id: 'tools',
    label: 'Practical Tools (SQL)',
    shortLabel: 'SQL',
    path: '/vendor-admin/tests?type=sql',
    hub: 'sql',
    testType: 'sql',
    icon: FiTool,
    accent: '#ca8a04',
    description: 'Dataset templates and SQL exams with output validation.',
    actions: [
      { label: 'Dataset templates', to: '/vendor-admin/dataset-templates' },
      { label: 'Create SQL test', to: '/vendor-admin/sql-tests/create', primary: true },
      { label: 'SQL tests', to: '/vendor-admin/tests?type=sql' },
    ],
  },
  {
    id: 'company',
    label: 'Company Specific',
    shortLabel: 'Company',
    path: '/vendor-admin/dashboard',
    icon: FiBriefcase,
    accent: '#0284c7',
    description: 'Company-focused templates — coming soon.',
    comingSoon: true,
    actions: [],
  },
];

/** Labels for Test.type values used in contest / classroom pickers */
export const VENDOR_TEST_TYPE_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  mixed: 'Mixed',
  sql: 'SQL',
  english: 'English',
};

export const VENDOR_TEST_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All test types' },
  ...VENDOR_TEST_SECTIONS.filter(
    (s) => s.testType && !s.comingSoon && !s.hub && s.testType !== 'project'
  ).map((s) => ({
    value: s.testType,
    label: s.shortLabel,
  })),
];

export function getVendorSectionById(id) {
  return (
    VENDOR_TEST_SECTIONS.find((s) => s.id === id) ||
    VENDOR_MENU_SECTIONS.find((s) => s.id === id) ||
    null
  );
}

export function getVendorTestSectionByType(type) {
  if (!type || type === 'all') return null;
  return (
    VENDOR_TEST_SECTIONS.find((s) => s.testType === type) ||
    VENDOR_TEST_SECTIONS.find((s) => s.id === type) ||
    null
  );
}

export function isVendorTestSectionActive(section, pathname, search) {
  if (section.comingSoon) return false;
  const type = search.get('type');
  if (section.hub === 'assignments') {
    return (
      type === 'project' ||
      pathname.startsWith('/vendor-admin/assignments') ||
      pathname.startsWith('/vendor-admin/create-assignment')
    );
  }
  if (section.hub === 'interviews') {
    return (
      type === 'interview' ||
      pathname.startsWith('/vendor-admin/interviews') ||
      pathname.startsWith('/vendor-admin/interview-questions')
    );
  }
  if (section.hub === 'system_design') {
    return type === 'system' || pathname.startsWith('/vendor-admin/system-design');
  }
  if (section.hub === 'sql') {
    return (
      type === 'sql' ||
      pathname.startsWith('/vendor-admin/dataset-templates') ||
      pathname.startsWith('/vendor-admin/sql-tests')
    );
  }
  if (section.testType) {
    if (section.testType === 'english') {
      return (
        pathname.startsWith('/vendor-admin/english') ||
        (pathname.startsWith('/vendor-admin/tests') && search.get('type') === 'english')
      );
    }
    if (!pathname.startsWith('/vendor-admin/tests')) return false;
    const type = search.get('type');
    return type === section.testType;
  }
  return pathname.startsWith(section.path);
}
