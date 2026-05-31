/** Shared UI helpers for vendor assign / results / submissions pages */

export function scoreTone(percentage) {
  if (percentage == null || Number.isNaN(Number(percentage))) return 'neutral';
  const p = Number(percentage);
  if (p >= 70) return 'excellent';
  if (p >= 50) return 'good';
  return 'poor';
}

export function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export function computeResultStats(items, getPercent = (r) => r.percentage) {
  const completed = items.filter((r) => getPercent(r) != null && !Number.isNaN(getPercent(r)));
  const percents = completed.map((r) => Number(getPercent(r)) || 0);
  const avg =
    percents.length > 0
      ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length)
      : 0;
  return {
    total: items.length,
    completed: completed.length,
    average: avg,
    highest: percents.length ? Math.max(...percents) : 0,
    lowest: percents.length ? Math.min(...percents) : 0,
  };
}
