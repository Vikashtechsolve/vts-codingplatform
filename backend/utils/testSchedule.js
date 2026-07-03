const Test = require('../models/Test');
const Result = require('../models/Result');
const User = require('../models/User');

function getNow() {
  return new Date();
}

function hasSchedule(test) {
  return !!(test?.startDate || test?.endDate);
}

function shouldAutoSubmitAtWindowEnd(test) {
  if (!test?.endDate) return false;
  return test.settings?.autoSubmitAtWindowEnd !== false;
}

function getTestSchedulePhase(test, now = getNow()) {
  if (!hasSchedule(test)) {
    return {
      phase: 'open',
      hasSchedule: false,
      canStart: true,
      canContinue: true,
      windowStart: null,
      windowEnd: null,
      autoSubmitAtWindowEnd: false,
      message: null,
    };
  }

  const windowStart = test.startDate ? new Date(test.startDate) : null;
  const windowEnd = test.endDate ? new Date(test.endDate) : null;
  const nowMs = now.getTime();
  const autoSubmitAtWindowEnd = shouldAutoSubmitAtWindowEnd(test);

  if (windowStart && nowMs < windowStart.getTime()) {
    return {
      phase: 'upcoming',
      hasSchedule: true,
      canStart: false,
      canContinue: false,
      windowStart,
      windowEnd,
      autoSubmitAtWindowEnd,
      message: 'This test is not open yet. Check the scheduled start time.',
    };
  }

  if (windowEnd && nowMs > windowEnd.getTime()) {
    return {
      phase: 'ended',
      hasSchedule: true,
      canStart: false,
      canContinue: !autoSubmitAtWindowEnd,
      windowStart,
      windowEnd,
      autoSubmitAtWindowEnd,
      message: 'The scheduled attempt window for this test has ended.',
    };
  }

  return {
    phase: 'open',
    hasSchedule: true,
    canStart: true,
    canContinue: true,
    windowStart,
    windowEnd,
    autoSubmitAtWindowEnd,
    message: null,
  };
}

function attachScheduleToTest(testObj, enrollmentStatus = 'assigned', now = getNow(), options = {}) {
  if (options.skipSchedule) {
    const inProgress = enrollmentStatus === 'in_progress';
    return {
      ...testObj,
      schedulePhase: 'open',
      scheduleHasWindow: false,
      scheduleWindowStart: testObj.startDate ? new Date(testObj.startDate) : null,
      scheduleWindowEnd: testObj.endDate ? new Date(testObj.endDate) : null,
      autoSubmitAtWindowEnd: false,
      canStartAttempt: enrollmentStatus !== 'completed' && !inProgress,
      canContinueAttempt: inProgress,
      scheduleMessage: null,
    };
  }

  const schedule = getTestSchedulePhase(testObj, now);
  const inProgress = enrollmentStatus === 'in_progress';

  let canStart = schedule.canStart;
  let canContinue = schedule.canContinue;

  if (inProgress) {
    canStart = false;
    if (schedule.phase === 'ended' && schedule.autoSubmitAtWindowEnd) {
      canContinue = false;
    } else if (schedule.phase === 'upcoming') {
      canContinue = false;
    } else {
      canContinue = true;
    }
  } else if (enrollmentStatus === 'completed') {
    canStart = false;
    canContinue = false;
  }

  return {
    ...testObj,
    schedulePhase: schedule.phase,
    scheduleHasWindow: schedule.hasSchedule,
    scheduleWindowStart: schedule.windowStart,
    scheduleWindowEnd: schedule.windowEnd,
    autoSubmitAtWindowEnd: schedule.autoSubmitAtWindowEnd,
    canStartAttempt: canStart && enrollmentStatus !== 'completed',
    canContinueAttempt: canContinue && inProgress,
    scheduleMessage: schedule.message,
  };
}

function getTestAttemptDeadlineMs(test, contest, startedAt, now = getNow()) {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return null;

  const durationMs = test?.duration ? test.duration * 60 * 1000 : Infinity;
  const durationDeadline = started + durationMs;

  let windowDeadline = Infinity;
  if (contest?.attemptWindowEnd) {
    windowDeadline = new Date(contest.attemptWindowEnd).getTime();
  } else if (test?.endDate && shouldAutoSubmitAtWindowEnd(test)) {
    windowDeadline = new Date(test.endDate).getTime();
  }

  if (!Number.isFinite(windowDeadline)) return durationDeadline;
  return Math.min(durationDeadline, windowDeadline);
}

function isTestAttemptExpired(result, test, contest, now = getNow()) {
  if (!result?.startedAt || result.status !== 'in_progress') return false;
  const deadline = getTestAttemptDeadlineMs(test, contest, result.startedAt, now);
  if (deadline == null || !Number.isFinite(deadline)) return false;
  return now.getTime() >= deadline;
}

function getAttemptWindowEndForClient(test, contest) {
  if (contest?.attemptWindowEnd) return new Date(contest.attemptWindowEnd);
  if (test?.endDate && shouldAutoSubmitAtWindowEnd(test)) {
    return new Date(test.endDate);
  }
  return null;
}

function validateScheduleInput({ startDate, endDate }) {
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    return 'End date must be after the start date';
  }
  return null;
}

function parseScheduleDateInput(value) {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function assertCanStartScheduledTest(test, enrollmentStatus, now = getNow()) {
  const schedule = getTestSchedulePhase(test, now);
  const inProgress = enrollmentStatus === 'in_progress';

  if (inProgress) {
    if (schedule.phase === 'ended' && schedule.autoSubmitAtWindowEnd) {
      return {
        ok: false,
        status: 400,
        code: 'WINDOW_ENDED',
        message: schedule.message,
        schedule,
      };
    }
    if (schedule.phase === 'upcoming') {
      return {
        ok: false,
        status: 403,
        code: 'NOT_YET_OPEN',
        message: schedule.message,
        schedule,
      };
    }
    return { ok: true, schedule };
  }

  if (enrollmentStatus === 'completed') {
    return {
      ok: false,
      status: 400,
      code: 'ALREADY_COMPLETED',
      message: 'Test already completed',
      schedule,
    };
  }

  if (!schedule.canStart) {
    return {
      ok: false,
      status: 403,
      code: schedule.phase === 'upcoming' ? 'NOT_YET_OPEN' : 'WINDOW_ENDED',
      message: schedule.message,
      schedule,
    };
  }

  return { ok: true, schedule };
}

async function finalizeInProgressTestResult(result, userId, { autoSubmitted = true, contestId } = {}) {
  const { finalizeInProgressTestResult: finalize } = require('./contestService');
  return finalize(result, userId, { autoSubmitted, contestId });
}

async function sweepExpiredScheduledTestAttempts() {
  const { findPublishedContestByAssessment } = require('./contestService');
  const now = getNow();
  const tests = await Test.find({
    isActive: true,
    endDate: { $ne: null, $lte: now },
  }).select('_id settings endDate duration');

  let total = 0;
  for (const test of tests) {
    if (!shouldAutoSubmitAtWindowEnd(test)) continue;

    const inProgress = await Result.find({
      testId: test._id,
      status: 'in_progress',
    });

    for (const result of inProgress) {
      const activeContest = await findPublishedContestByAssessment(
        'test',
        test._id,
        result.studentId
      );
      if (!isTestAttemptExpired(result, test, activeContest, now)) continue;
      await finalizeInProgressTestResult(result, result.studentId, {
        autoSubmitted: true,
        contestId: activeContest?._id,
      });
      total += 1;
    }
  }
  return total;
}

module.exports = {
  hasSchedule,
  shouldAutoSubmitAtWindowEnd,
  getTestSchedulePhase,
  attachScheduleToTest,
  getTestAttemptDeadlineMs,
  isTestAttemptExpired,
  getAttemptWindowEndForClient,
  validateScheduleInput,
  parseScheduleDateInput,
  assertCanStartScheduledTest,
  sweepExpiredScheduledTestAttempts,
};
