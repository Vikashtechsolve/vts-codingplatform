/** Accent colors aligned with vendor sidebar / dashboard */
export const VENDOR_TEST_TYPE_ACCENTS = {
  coding: '#2563eb',
  mcq: '#7c3aed',
  aptitude: '#059669',
  theory: '#475569',
  english: '#db2777',
  mixed: '#0891b2',
  interview: '#c026d3',
  project: '#6366f1',
  system: '#ea580c',
  sql: '#0d9488',
};

export function getVendorTestTypeAccent(type) {
  return VENDOR_TEST_TYPE_ACCENTS[type] || '#2563eb';
}

export function getVendorTestTypeLabel(type) {
  const labels = {
    coding: 'Coding',
    mcq: 'MCQ',
    aptitude: 'Aptitude',
    theory: 'Theory',
    english: 'English & verbal',
    mixed: 'Mixed',
    interview: 'Interview',
  };
  return labels[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Test');
}
