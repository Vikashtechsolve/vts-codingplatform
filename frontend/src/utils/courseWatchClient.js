/**
 * Count only real playback between samples. Seeks/rewinds add 0.
 */
export function samplePlaybackDelta(prevTime, nextTime, maxGapSec = 2) {
  if (!Number.isFinite(prevTime) || !Number.isFinite(nextTime)) {
    return { delta: 0, next: Number.isFinite(nextTime) ? nextTime : 0 };
  }
  const d = nextTime - prevTime;
  if (d < 0 || d > maxGapSec) return { delta: 0, next: nextTime };
  return { delta: d, next: nextTime };
}

export function lectureWatchPercent({ unique = 0, duration = 0, completed = false } = {}) {
  if (completed) return 100;
  const dur = Number(duration) || 0;
  if (dur <= 0) return 0;
  return Math.min(100, Math.round(((Number(unique) || 0) / dur) * 100));
}

export function courseProgressPercent({
  lectureDone = 0,
  lectureTotal = 0,
  quizDone = 0,
  quizTotal = 0,
  serverPct = 0,
} = {}) {
  const itemsDone = lectureDone + quizDone;
  const itemsTotal = lectureTotal + quizTotal;
  const itemPct = itemsTotal ? Math.round((itemsDone / itemsTotal) * 100) : 0;
  return Math.max(0, Math.min(100, Math.max(Number(serverPct) || 0, itemPct)));
}
