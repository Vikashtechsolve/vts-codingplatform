const MAX_VIOLATIONS = parseInt(process.env.MAX_VIOLATIONS || '3', 10);

/** Attach server-configured proctoring limit to API payloads (not persisted on models). */
function addExamSecurityMeta(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return { ...payload, maxViolations: MAX_VIOLATIONS };
}

function stampExamSecurityMeta(payload) {
  if (payload && typeof payload === 'object') {
    payload.maxViolations = MAX_VIOLATIONS;
  }
  return payload;
}

const ALLOWED_VIOLATION_TYPES = new Set([
  'tab_switch',
  'window_blur',
  'desktop_switch',
  'page_hidden',
  'copy_paste',
  'shortcut_key',
  'fullscreen_exit',
  'multiple_screens',
  'screen_share',
  'remote_access',
  'devtools_attempt',
  'navigation_attempt',
]);

function normalizeViolationType(type) {
  if (typeof type !== 'string' || !type.trim()) return 'window_blur';
  const normalized = type.trim().toLowerCase();
  return ALLOWED_VIOLATION_TYPES.has(normalized) ? normalized : 'window_blur';
}

module.exports = {
  MAX_VIOLATIONS,
  ALLOWED_VIOLATION_TYPES,
  normalizeViolationType,
  addExamSecurityMeta,
  stampExamSecurityMeta,
};
