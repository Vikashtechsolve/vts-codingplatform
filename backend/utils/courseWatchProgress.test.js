const {
  mergeIntervals,
  uniqueWatchedSeconds,
  applyHeartbeat,
  isLectureVideoComplete,
  pickDuration,
  watchedPercent,
} = require('./courseWatchProgress');

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

assert(uniqueWatchedSeconds([{ start: 0, end: 10 }, { start: 5, end: 15 }]) === 15, 'merge unique');
assert(isLectureVideoComplete(90, 100) === true, '90% complete');
assert(isLectureVideoComplete(89, 100) === false, '89% incomplete');

const hb = applyHeartbeat(
  { intervals: [], maxPosition: 0 },
  { positionSec: 20, deltaWatchedSec: 10, durationSec: 100 }
);
assert(hb.watchedSecondsUnique === 10, 'heartbeat unique');
assert(hb.maxPosition === 20, 'max position');

const jumped = applyHeartbeat(
  { intervals: [{ start: 0, end: 10 }], maxPosition: 10 },
  { positionSec: 90, deltaWatchedSec: 80, durationSec: 100 }
);
assert(jumped.watchedSecondsUnique <= 30, 'clamp fake skip delta');

assert(mergeIntervals([{ start: 1, end: 2 }, { start: 2, end: 3 }]).length === 1, 'coalesce');

assert(pickDuration(90, 60) === 60, 'prefer playable client duration when close');
assert(pickDuration(60, 1) === 60, 'reject tiny client duration');
assert(pickDuration(0, 45) === 45, 'use client when stored missing');
assert(pickDuration(0, 0) === 0, 'both missing');

let cur = { intervals: [], maxPosition: 0 };
for (let t = 10; t <= 100; t += 10) {
  cur = applyHeartbeat(cur, { positionSec: t, deltaWatchedSec: 10, durationSec: 100 });
}
assert(cur.watchedSecondsUnique >= 90, `full watch unique got ${cur.watchedSecondsUnique}`);
assert(isLectureVideoComplete(cur.watchedSecondsUnique, pickDuration(120, 100)) === true, 'complete vs shorter playable duration');

const capped = applyHeartbeat(
  { intervals: [{ start: 0, end: 200 }], maxPosition: 200 },
  { positionSec: 60, deltaWatchedSec: 5, durationSec: 60 }
);
assert(capped.watchedSecondsUnique <= 60, 'unique cannot exceed duration');

assert(watchedPercent(54, 60) === 90, 'percent rounds');
assert(watchedPercent(60, 60) === 100, 'full watch is 100');
assert(watchedPercent(10, 0) === 0, 'no duration');

console.log('courseWatchProgress.test.js: all passed');
