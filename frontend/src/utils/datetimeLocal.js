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

export function formatCountdownShort(parts) {
  if (!parts || parts.totalMs <= 0) return '';
  const chunks = [];
  if (parts.days > 0) chunks.push(`${parts.days}d`);
  if (parts.hours > 0 || parts.days > 0) chunks.push(`${parts.hours}h`);
  chunks.push(`${parts.minutes}m`);
  chunks.push(`${parts.seconds}s`);
  return chunks.join(' ');
}
