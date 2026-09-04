import {
  samplePlaybackDelta,
  lectureWatchPercent,
  courseProgressPercent,
} from './courseWatchClient.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

describe('courseWatchClient', () => {
  test('calculations work', () => {
    assert(samplePlaybackDelta(0, 0.4).delta === 0.4, 'count playback from 0');
    assert(samplePlaybackDelta(10, 10.25).delta === 0.25, 'small tick');
    assert(samplePlaybackDelta(10, 40).delta === 0, 'ignore seek jump');
    assert(samplePlaybackDelta(40, 12).delta === 0, 'ignore rewind');
    assert(samplePlaybackDelta(null, 5).delta === 0, 'first sample no credit');

    assert(
      lectureWatchPercent({ unique: 54, duration: 60, completed: false }) === 90,
      'lecture 90%'
    );
    assert(
      lectureWatchPercent({ unique: 10, duration: 60, completed: true }) === 100,
      'completed is 100'
    );
    assert(lectureWatchPercent({ unique: 0, duration: 0, completed: false }) === 0, 'unknown duration');

    assert(
      courseProgressPercent({ lectureDone: 1, lectureTotal: 4, quizDone: 0, quizTotal: 1, serverPct: 0 }) ===
        20,
      'items not raw watch'
    );
    assert(
      courseProgressPercent({
        lectureDone: 0,
        lectureTotal: 4,
        quizDone: 0,
        quizTotal: 0,
        serverPct: 0,
        watchPct: 68,
      }) === 0,
      'do not use raw watch for course %'
    );
  });
});
