/** Fallback max violations when the server has not sent maxViolations yet (override via REACT_APP_MAX_VIOLATIONS). */
export const MAX_EXAM_VIOLATIONS = parseInt(
  process.env.REACT_APP_MAX_VIOLATIONS || '3',
  10
);

/** Grace period after exam session starts (fullscreen prompt, layout). */
export const EXAM_GRACE_PERIOD_MS = 4000;

/** Debounce before posting a violation to the API. */
export const VIOLATION_DEBOUNCE_MS = 400;

/** Cooldown per violation group (prevents double-counting one action). */
export const VIOLATION_COOLDOWN_MS = 3000;

/** How long the window must lack focus before counting (Mac desktop swipe). */
export const FOCUS_LOSS_THRESHOLD_MS = 400;

/** Poll interval for focus checks when visibility API misses desktop switches. */
export const FOCUS_POLL_INTERVAL_MS = 200;

/** Violation types that share one cooldown bucket (one switch = one violation). */
export const FOCUS_LOSS_TYPES = new Set([
  'tab_switch',
  'window_blur',
  'desktop_switch',
  'page_hidden',
]);

export const getViolationCooldownKey = (type) =>
  FOCUS_LOSS_TYPES.has(type) ? 'focus_loss' : type;
