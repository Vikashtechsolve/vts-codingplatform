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
  FiBell,
} from 'react-icons/fi';

/** Primary brand accent — use sparingly for highlights and CTAs */
export const STUDENT_ACCENT = '#e7210b';

export const STUDENT_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    shortLabel: 'Home',
    path: '/student/dashboard',
    icon: FiHome,
    description: 'Your progress and quick actions',
    isOverview: true,
    accent: '#0f172a',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    path: '/student/announcements',
    icon: FiBell,
    description: 'Updates from your instructors',
    isAnnouncement: true,
    accent: '#e7210b',
  },
  {
    id: 'courses',
    label: 'Courses',
    shortLabel: 'Courses',
    path: '/student/courses',
    icon: FiBookOpen,
    description: 'Structured modules, lectures, and progress',
    accent: '#0f766e',
    isCourse: true,
  },
  {
    id: 'coding',
    label: 'Coding Tests',
    shortLabel: 'Coding',
    path: '/student/tests/coding',
    icon: FiCode,
    description: 'DSA practice and code-based tasks',
    accent: '#2563eb',
  },
  {
    id: 'aptitude',
    label: 'Aptitude Tests',
    shortLabel: 'Aptitude',
    path: '/student/tests/aptitude',
    icon: FiTrendingUp,
    description: 'Quantitative, logical and analytical',
    accent: '#059669',
  },
  {
    id: 'mcq',
    label: 'MCQ Tests',
    shortLabel: 'MCQ',
    path: '/student/tests/mcq',
    icon: FiCheckSquare,
    description: 'Objective questions with instant checks',
    accent: '#7c3aed',
  },
  {
    id: 'mixed',
    label: 'Mixed Tests',
    shortLabel: 'Mixed',
    path: '/student/tests/mixed',
    icon: FiLayers,
    description: 'Combination of multiple question types',
    accent: '#0891b2',
  },
  {
    id: 'english',
    label: 'English & Verbal',
    shortLabel: 'English',
    path: '/student/tests/english',
    icon: FiMessageCircle,
    description: 'Grammar, vocabulary, reading, writing',
    accent: '#db2777',
  },
  {
    id: 'core',
    label: 'Theory',
    shortLabel: 'Theory',
    path: '/student/tests/core',
    icon: FiBookOpen,
    description: 'Theory and conceptual questions',
    accent: '#475569',
  },
  {
    id: 'project',
    label: 'Project Evaluation',
    shortLabel: 'Projects',
    path: '/student/tests/project',
    icon: FiCpu,
    description: 'AI-based project review and scoring',
    accent: '#6366f1',
  },
  {
    id: 'interview',
    label: 'Interview',
    shortLabel: 'Interview',
    path: '/student/tests/interview',
    icon: FiMic,
    description: 'Voice-based interview assessments',
    accent: '#c026d3',
  },
  {
    id: 'system',
    label: 'System Design',
    shortLabel: 'System',
    path: '/student/tests/system',
    icon: FiBox,
    description: 'Architecture and scalability',
    accent: '#ea580c',
  },
  {
    id: 'tools',
    label: 'Practical Tools',
    shortLabel: 'Tools',
    path: '/student/tests/tools',
    icon: FiTool,
    description: 'Git, SQL, Linux and tool-based tasks',
    accent: '#ca8a04',
  },
  {
    id: 'company',
    label: 'Company Specific',
    shortLabel: 'Company',
    path: '/student/tests/company',
    icon: FiBriefcase,
    description: 'Company-focused test templates',
    accent: '#0284c7',
  },
];

export const MENU_SECTIONS = STUDENT_SECTIONS.filter((s) => s.isOverview || s.isAnnouncement);

export const COURSE_SECTIONS = STUDENT_SECTIONS.filter((s) => s.isCourse);

export const TEST_SECTIONS = STUDENT_SECTIONS.filter(
  (s) => !s.isOverview && !s.isAnnouncement && !s.isCourse
);

export function getSectionById(id) {
  return STUDENT_SECTIONS.find((s) => s.id === id) || null;
}
