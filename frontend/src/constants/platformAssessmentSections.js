import { FiMic, FiCpu, FiBox } from 'react-icons/fi';

export const PLATFORM_EXTENDED_SECTIONS = [
  {
    id: 'interview',
    label: 'Interview Tests',
    shortLabel: 'Interview',
    assessmentType: 'interview',
    icon: FiMic,
    accent: '#c026d3',
    description: 'Voice-based AI mock interviews built from the global interview question pool.',
    apiBase: '/super-admin/interviews',
    actions: [
      { label: 'Question pool', to: '/super-admin/interview-questions' },
      { label: 'Create interview', to: '/super-admin/assessments/interviews/create', primary: true },
      { label: 'View interviews', to: '/super-admin/assessments?type=interview' },
    ],
  },
  {
    id: 'project',
    label: 'Project Evaluation (AI)',
    shortLabel: 'Projects',
    assessmentType: 'assignment',
    icon: FiCpu,
    accent: '#6366f1',
    description: 'AI-based repository review, rubrics, and scoring templates for vendors.',
    apiBase: '/super-admin/assignments',
    actions: [
      { label: 'Create project', to: '/super-admin/assessments/assignments/create', primary: true },
      { label: 'View projects', to: '/super-admin/assessments?type=project' },
    ],
  },
  {
    id: 'system',
    label: 'System Design',
    shortLabel: 'System',
    assessmentType: 'system_design',
    icon: FiBox,
    accent: '#ea580c',
    description: 'Architecture problems with capacity planning, diagrams, and trade-offs.',
    apiBase: '/super-admin/system-design-problems',
    actions: [
      { label: 'Create problem', to: '/super-admin/assessments/system-design/create', primary: true },
      { label: 'View problems', to: '/super-admin/assessments?type=system' },
    ],
  },
];

export const PLATFORM_EXTENDED_LABELS = {
  interview: 'Interview',
  project: 'Project (AI)',
  assignment: 'Project (AI)',
  system: 'System Design',
  system_design: 'System Design',
};

export function getPlatformExtendedSection(type) {
  if (type === 'project') {
    return PLATFORM_EXTENDED_SECTIONS.find((s) => s.id === 'project');
  }
  if (type === 'system' || type === 'system_design') {
    return PLATFORM_EXTENDED_SECTIONS.find((s) => s.id === 'system');
  }
  return PLATFORM_EXTENDED_SECTIONS.find(
    (s) => s.id === type || s.assessmentType === type
  );
}

export function getPlatformExtendedApiBase(type) {
  const section = getPlatformExtendedSection(type);
  return section?.apiBase || '/super-admin/interviews';
}
