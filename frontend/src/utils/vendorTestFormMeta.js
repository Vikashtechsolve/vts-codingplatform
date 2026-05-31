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

export function getTestFormMeta(type, isEdit) {
  const key = TEST_FORM_META[type] ? type : 'mixed';
  const meta = TEST_FORM_META[key];
  return {
    ...meta,
    title: isEdit ? meta.editTitle : meta.createTitle,
    eyebrow: getVendorTestTypeLabel(key),
    accent: getVendorTestTypeAccent(key),
  };
}
