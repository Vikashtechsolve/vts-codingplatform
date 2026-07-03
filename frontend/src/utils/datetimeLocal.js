/**
 * Convert an ISO/Date value to a value suitable for <input type="datetime-local"> (local time).
 */
export function toLocalDateTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Convert datetime-local input (browser local time) to ISO UTC for the API.
 */
export function fromLocalDateTimeInput(value) {
  if (!value) return null;
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null;
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Format stored ISO date for display in the user's local timezone. */
export function formatScheduleDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Convert test schedule form fields to API payload (ISO UTC instants). */
export function buildTestSchedulePayload({ startDate = '', endDate = '' } = {}) {
  return {
    startDate: startDate ? fromLocalDateTimeInput(startDate) : null,
    endDate: endDate ? fromLocalDateTimeInput(endDate) : null,
  };
}

/** Validate local datetime-local inputs before submit. */
export function validateLocalScheduleRange(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid schedule date or time.';
  }
  if (end <= start) return 'End date must be after the start date.';
  return null;
}

export function formatCountdownShort(parts) {
  if (!parts || parts.totalMs <= 0) return '';
  const chunks = [];
  if (parts.days > 0) chunks.push(`${parts.days}d`);
  if (parts.hours > 0 || parts.days > 0) chunks.push(`${parts.hours}h`);
  chunks.push(`${parts.minutes}m`);
  chunks.push(`${parts.seconds}s`);
  return chunks.join(' ');
}
