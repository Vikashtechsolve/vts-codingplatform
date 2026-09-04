import { getVendorTestTypeAccent, getVendorTestTypeLabel } from './vendorTestTypeUi';

/** Copy and navigation for vendor test create/edit flows */
export const TEST_FORM_META = {
  coding: {
    createTitle: 'Create coding assessment',
    editTitle: 'Edit coding assessment',
    subtitle: 'Set duration, schedule, and pick coding problems from your question bank.',
    back: '/vendor-admin/tests?type=coding',
  },
  mcq: {
    createTitle: 'Create MCQ assessment',
    editTitle: 'Edit MCQ assessment',
    subtitle: 'Build a multiple-choice test with scored questions and optional schedule.',
    back: '/vendor-admin/tests?type=mcq',
  },
  aptitude: {
    createTitle: 'Create aptitude assessment',
    editTitle: 'Edit aptitude assessment',
    subtitle: 'Quantitative, verbal, and logical items in one timed assessment.',
    back: '/vendor-admin/tests?type=aptitude',
  },
  theory: {
    createTitle: 'Create theory assessment',
    editTitle: 'Edit theory assessment',
    subtitle: 'Subjective answers with AI-assisted evaluation settings per question.',
    back: '/vendor-admin/tests?type=theory',
  },
  mixed: {
    createTitle: 'Create mixed assessment',
    editTitle: 'Edit mixed assessment',
    subtitle: 'Combine coding, MCQ, aptitude, and theory in a single test.',
    back: '/vendor-admin/tests?type=mixed',
  },
  sql: {
    createTitle: 'Create SQL assessment',
    editTitle: 'Edit SQL assessment',
    subtitle: 'Link a dataset template, then add SQL questions evaluated by query output.',
    back: '/vendor-admin/tests?type=sql',
  },
  english: {
    createTitle: 'Create English assessment',
    editTitle: 'Edit English assessment',
    subtitle: 'Multi-section verbal test: grammar, reading, writing, listening, and speaking.',
    back: '/vendor-admin/tests?type=english',
  },
  interview: {
    createTitle: 'Create interview',
    editTitle: 'Edit interview',
    subtitle: 'Configure AI interview settings and optional fixed question pool.',
    back: '/vendor-admin/tests?type=interview',
  },
};

export function getTestFormMeta(type, isEdit, isPlatformTest = false, isPlatformAssessment = false) {
  const key = TEST_FORM_META[type] ? type : 'mixed';
  const meta = TEST_FORM_META[key];
  const platformTestBack = `/super-admin/tests${key !== 'mixed' ? `?type=${key}` : ''}`;
  const platformAssessmentBack =
    key === 'interview'
      ? '/super-admin/assessments?type=interview'
      : key === 'sql'
        ? platformTestBack
        : '/super-admin/assessments';

  const isPlatform = isPlatformTest || isPlatformAssessment;

  return {
    ...meta,
    title: isEdit
      ? isPlatformAssessment
        ? `Edit platform ${key === 'interview' ? 'interview' : key}`
        : isPlatformTest
          ? `Edit platform ${getVendorTestTypeLabel(key).toLowerCase()} test`
          : meta.editTitle
      : isPlatformAssessment
        ? `Create platform ${key === 'interview' ? 'interview' : key}`
        : isPlatformTest
          ? `Create platform ${getVendorTestTypeLabel(key).toLowerCase()} test`
          : meta.createTitle,
    subtitle: isPlatformAssessment
      ? 'Built from global content. Allocate to vendors or attach in course modules — no schedule.'
      : isPlatformTest
        ? 'Build from the global question bank. No schedule — allocate to vendors when ready.'
        : meta.subtitle,
    back: isPlatformAssessment
      ? platformAssessmentBack
      : isPlatformTest
        ? platformTestBack
        : meta.back,
    eyebrow: isPlatform ? (isPlatformAssessment ? 'Platform assessment' : 'Platform test') : getVendorTestTypeLabel(key),
    accent: getVendorTestTypeAccent(key),
  };
}
