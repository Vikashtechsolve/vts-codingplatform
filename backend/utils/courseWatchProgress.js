const WATCH_COMPLETE_RATIO = 0.9;
const MAX_HEARTBEAT_DELTA_SEC = 20;

/**
 * Merge [start,end) intervals (seconds), sorted and coalesced.
 */
function mergeIntervals(intervals) {
  if (!intervals?.length) return [];
  const sorted = intervals
    .map((i) => ({
      start: Math.max(0, Math.floor(Number(i.start) || 0)),
      end: Math.max(0, Math.ceil(Number(i.end) || 0)),
    }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const out = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (!last || cur.start > last.end + 1) {
      out.push({ ...cur });
    } else {
      last.end = Math.max(last.end, cur.end);
    }
  }
  return out;
}

function uniqueWatchedSeconds(intervals) {
  return mergeIntervals(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}

/**
 * Prefer the playable client duration when it is a sane match for the stored probe.
 */
function pickDuration(storedSec, clientSec) {
  const stored = Math.max(0, Number(storedSec) || 0);
  const client = Math.max(0, Number(clientSec) || 0);
  if (client >= 1 && client <= 12 * 3600) {
    if (stored <= 0) return client;
    if (client >= stored * 0.5 && client <= stored * 1.5) return client;
  }
  return stored || client;
}

function watchedPercent(uniqueSec, durationSec) {
  const duration = Math.max(0, Number(durationSec) || 0);
  if (duration <= 0) return 0;
  const unique = Math.max(0, Number(uniqueSec) || 0);
  return Math.min(100, Math.round((unique / duration) * 100));
}

/**
 * Apply a heartbeat window. Clamps delta to avoid fake jumps.
 * @returns {{ intervals, watchedSecondsUnique, maxPosition }}
 */
function applyHeartbeat(existing, { positionSec, deltaWatchedSec, durationSec }) {
  const duration = Math.max(0, Number(durationSec) || 0);
  const position = Math.min(
    duration || Number.MAX_SAFE_INTEGER,
    Math.max(0, Number(positionSec) || 0)
  );
  const delta = Math.min(
    MAX_HEARTBEAT_DELTA_SEC,
    Math.max(0, Number(deltaWatchedSec) || 0)
  );

  const intervals = mergeIntervals([...(existing.intervals || [])]);
  if (delta > 0 && position > 0) {
    const start = Math.max(0, position - delta);
    intervals.push({ start, end: position });
  }

  const merged = mergeIntervals(intervals).map((i) =>
    duration > 0 ? { start: Math.min(i.start, duration), end: Math.min(i.end, duration) } : i
  ).filter((i) => i.end > i.start);

  let watchedSecondsUnique = uniqueWatchedSeconds(merged);
  if (duration > 0) {
    watchedSecondsUnique = Math.min(watchedSecondsUnique, Math.ceil(duration));
  }
  const maxPosition = Math.max(Number(existing.maxPosition) || 0, position);

  return { intervals: merged, watchedSecondsUnique, maxPosition };
}

function isLectureVideoComplete(watchedSecondsUnique, durationSec) {
  const duration = Number(durationSec) || 0;
  if (duration <= 0) return false;
  return watchedSecondsUnique / duration >= WATCH_COMPLETE_RATIO;
}

module.exports = {
  WATCH_COMPLETE_RATIO,
  MAX_HEARTBEAT_DELTA_SEC,
  mergeIntervals,
  uniqueWatchedSeconds,
  applyHeartbeat,
  isLectureVideoComplete,
  pickDuration,
  watchedPercent,
};
