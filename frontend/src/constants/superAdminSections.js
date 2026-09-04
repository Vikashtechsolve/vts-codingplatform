import {
  FiHome,
  FiBriefcase,
  FiDatabase,
  FiMic,
  FiCreditCard,
  FiCpu,
  FiBookOpen,
  FiClipboard,
  FiLayers,
} from 'react-icons/fi';

export const SUPER_ADMIN_ACCENT = '#6366f1';

export const SUPER_ADMIN_SECTIONS = [
  {
    id: 'dashboard',
    path: '/super-admin/dashboard',
    shortLabel: 'Dashboard',
    icon: FiHome,
    accent: '#6366f1',
  },
  {
    id: 'vendors',
    path: '/super-admin/vendors',
    shortLabel: 'Vendors',
    icon: FiBriefcase,
    accent: '#2563eb',
  },
  {
    id: 'courses',
    path: '/super-admin/courses',
    shortLabel: 'Courses',
    icon: FiBookOpen,
    accent: '#0f766e',
  },
  {
    id: 'platform-tests',
    path: '/super-admin/tests',
    shortLabel: 'Platform tests',
    icon: FiClipboard,
    accent: '#ea580c',
  },
  {
    id: 'platform-assessments',
    path: '/super-admin/assessments',
    shortLabel: 'Interviews & more',
    icon: FiLayers,
    accent: '#c026d3',
  },
  {
    id: 'global-questions',
    path: '/super-admin/global-questions',
    shortLabel: 'Question bank',
    icon: FiDatabase,
    accent: '#0891b2',
  },
  {
    id: 'interview-questions',
    path: '/super-admin/interview-questions',
    shortLabel: 'Interview Qs',
    icon: FiMic,
    accent: '#c026d3',
  },
  {
    id: 'interview-credits',
    path: '/super-admin/interview-credits',
    shortLabel: 'Credits',
    icon: FiCreditCard,
    accent: '#059669',
  },
  {
    id: 'interview-ai-settings',
    path: '/super-admin/interview-ai-settings',
    shortLabel: 'AI settings',
    icon: FiCpu,
    accent: '#7c3aed',
    comingSoon: true,
  },
];
