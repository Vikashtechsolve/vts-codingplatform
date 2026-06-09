const Contest = require('../models/Contest');
const ContestParticipant = require('../models/ContestParticipant');
const User = require('../models/User');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const Result = require('../models/Result');
const InterviewSession = require('../models/InterviewSession');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');

const ASSESSMENT_MODEL_MAP = {
  test: 'Result',
  interview: 'InterviewSession',
  assignment: 'ProjectSubmission',
  system_design: 'SystemDesignSubmission',
};

function getNow() {
  return new Date();
}

function getRegistrationOpensAt(contest) {
  return contest.registrationOpensAt ? new Date(contest.registrationOpensAt) : new Date(contest.createdAt);
}

function getRegistrationClosesAt(contest) {
  return contest.registrationClosesAt
    ? new Date(contest.registrationClosesAt)
    : new Date(contest.attemptWindowEnd);
}

function isRegistrationOpen(contest, now = getNow()) {
  if (contest.status !== 'published') return false;
  const opens = getRegistrationOpensAt(contest);
  const closes = getRegistrationClosesAt(contest);
  return now >= opens && now <= closes;
}

function isAttemptWindowOpen(contest, now = getNow()) {
  if (contest.status !== 'published') return false;
  const start = new Date(contest.attemptWindowStart);
  const end = new Date(contest.attemptWindowEnd);
  return now >= start && now <= end;
}

function getTestAttemptDeadlineMs(test, contest, startedAt, now = getNow()) {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return null;
  const durationMs = test?.duration ? test.duration * 60 * 1000 : Infinity;
  const durationDeadline = started + durationMs;
  const windowDeadline = contest ? new Date(contest.attemptWindowEnd).getTime() : Infinity;
  if (!Number.isFinite(windowDeadline)) return durationDeadline;
  return Math.min(durationDeadline, windowDeadline);
}

function isTestAttemptExpired(result, test, contest, now = getNow()) {
  if (!result?.startedAt || result.status !== 'in_progress') return false;
  const deadline = getTestAttemptDeadlineMs(test, contest, result.startedAt, now);
  if (deadline == null || !Number.isFinite(deadline)) return false;
  return now.getTime() >= deadline;
}

async function finalizeInProgressTestResult(result, userId, { autoSubmitted = true, contestId } = {}) {
  result.totalScore = result.answers.reduce((sum, a) => sum + (a.points || 0), 0);
  result.percentage = result.maxScore > 0
    ? Math.round((result.totalScore / result.maxScore) * 100)
    : 0;
  result.submittedAt = new Date();
  result.timeSpent = Math.floor((result.submittedAt - result.startedAt) / 1000);
  result.status = 'completed';
  result.autoSubmitted = autoSubmitted;
  await result.save();

  const student = await User.findById(userId);
  if (student) {
    const enrollment = student.enrolledTests.find(
      (et) => et.testId.toString() === result.testId.toString()
    );
    if (enrollment) {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
      await student.save();
    }
  }

  if (contestId) {
    await markParticipantCompleted(contestId, userId, { model: 'Result', id: result._id });
  }
  return result;
}

async function finalizeAllInProgressContestAttempts(contest, { force = false } = {}) {
  if (!contest || contest.assessmentType !== 'test') return 0;

  const test = await Test.findById(contest.assessmentId);
  if (!test) return 0;

  const participants = await ContestParticipant.find({ contestId: contest._id })
    .select('userId')
    .lean();
  const studentIds = participants.map((p) => p.userId).filter(Boolean);
  if (!studentIds.length) return 0;

  const inProgressResults = await Result.find({
    testId: contest.assessmentId,
    studentId: { $in: studentIds },
    status: 'in_progress',
  });

  let count = 0;
  for (const result of inProgressResults) {
    if (!force && !isTestAttemptExpired(result, test, contest)) continue;
    await finalizeInProgressTestResult(result, result.studentId, {
      autoSubmitted: true,
      contestId: contest._id,
    });
    count += 1;
  }
  return count;
}

async function ensureContestAttemptsFinalized(contest) {
  const now = getNow();
  const shouldForce =
    contest.status === 'ended' || now > new Date(contest.attemptWindowEnd);
  if (!shouldForce) return 0;
  return finalizeAllInProgressContestAttempts(contest, { force: true });
}

async function autoSubmitStaleContestTestAttempts(contest) {
  return finalizeAllInProgressContestAttempts(contest, { force: false });
}

async function sweepExpiredContestTestAttempts() {
  const now = getNow();
  const contests = await Contest.find({
    assessmentType: 'test',
    status: { $in: ['published', 'ended'] },
    attemptWindowEnd: { $lte: now },
  });

  let total = 0;
  for (const contest of contests) {
    total += await autoSubmitStaleContestTestAttempts(contest);
  }
  return total;
}

function getContestPhase(contest, participant = null, now = getNow()) {
  if (contest.status === 'draft') return 'draft';
  if (contest.status === 'ended' || now > new Date(contest.attemptWindowEnd)) return 'ended';

  const regOpens = getRegistrationOpensAt(contest);
  const regCloses = getRegistrationClosesAt(contest);
  const attemptStart = new Date(contest.attemptWindowStart);
  const attemptEnd = new Date(contest.attemptWindowEnd);

  if (now < regOpens) return 'before_registration';
  if (isAttemptWindowOpen(contest, now)) {
    if (participant) return 'attempt_open';
    if (now >= regOpens && now <= regCloses) return 'attempt_open';
    return 'attempt_open';
  }
  if (now > attemptEnd) return 'ended';
  if (participant && now < attemptStart) return 'registered_waiting';
  if (participant && now >= attemptStart && now <= attemptEnd) return 'attempt_open';
  if (now >= regOpens && now <= regCloses) return 'registration_open';
  if (now > regCloses && now < attemptStart) return 'registration_closed_waiting';
  return 'registration_closed_waiting';
}

async function loadAssessmentSummary(contest) {
  const { assessmentType, assessmentId } = contest;
  if (assessmentType === 'test') {
    const test = await Test.findById(assessmentId).select('title description type duration');
    if (!test) return null;
    return {
      title: test.title,
      description: test.description,
      type: test.type,
      duration: test.duration,
    };
  }
  if (assessmentType === 'interview') {
    const interview = await Interview.findById(assessmentId).select('title description duration interviewType topic difficulty');
    if (!interview) return null;
    return {
      title: interview.title,
      description: interview.description,
      type: 'interview',
      duration: interview.duration,
      interviewType: interview.interviewType,
      topic: interview.topic,
      difficulty: interview.difficulty,
    };
  }
  if (assessmentType === 'assignment') {
    const assignment = await Assignment.findById(assessmentId).select('title description duration category difficulty');
    if (!assignment) return null;
    return {
      title: assignment.title,
      description: assignment.description,
      type: 'assignment',
      duration: assignment.duration,
      category: assignment.category,
      difficulty: assignment.difficulty,
    };
  }
  if (assessmentType === 'system_design') {
    const problem = await SystemDesignProblem.findById(assessmentId).select('title description duration category difficulty');
    if (!problem) return null;
    return {
      title: problem.title,
      description: problem.description,
      type: 'system_design',
      duration: problem.duration,
      category: problem.category,
      difficulty: problem.difficulty,
    };
  }
  return null;
}

async function validateAssessmentOwnership(vendorId, assessmentType, assessmentId) {
  const query = { _id: assessmentId, vendorId };
  if (assessmentType === 'test') return Test.findOne(query);
  if (assessmentType === 'interview') return Interview.findOne(query);
  if (assessmentType === 'assignment') return Assignment.findOne(query);
  if (assessmentType === 'system_design') return SystemDesignProblem.findOne(query);
  return null;
}

async function ensureAssessmentEnrollment(user, contest) {
  const assessmentId = contest.assessmentId.toString();

  if (contest.assessmentType === 'test') {
    const exists = user.enrolledTests.some((e) => e.testId && e.testId.toString() === assessmentId);
    if (!exists) {
      user.enrolledTests.push({ testId: contest.assessmentId, status: 'assigned' });
    }
  } else if (contest.assessmentType === 'interview') {
    const exists = user.enrolledInterviews.some((e) => e.interviewId && e.interviewId.toString() === assessmentId);
    if (!exists) {
      user.enrolledInterviews.push({ interviewId: contest.assessmentId, status: 'assigned' });
    }
  } else if (contest.assessmentType === 'assignment') {
    const exists = user.enrolledAssignments.some((e) => e.assignmentId && e.assignmentId.toString() === assessmentId);
    if (!exists) {
      user.enrolledAssignments.push({
        assignmentId: contest.assessmentId,
        status: 'assigned',
        deadline: contest.attemptWindowEnd,
      });
    } else {
      const enrollment = user.enrolledAssignments.find((e) => e.assignmentId.toString() === assessmentId);
      if (enrollment && !enrollment.deadline) {
        enrollment.deadline = contest.attemptWindowEnd;
      }
    }
  } else if (contest.assessmentType === 'system_design') {
    const problem = await SystemDesignProblem.findById(contest.assessmentId);
    if (problem) {
      const assigned = problem.assignedTo.some((id) => id.toString() === user._id.toString());
      if (!assigned) {
        problem.assignedTo.push(user._id);
        problem.totalAssigned = problem.assignedTo.length;
        await problem.save();
      }
    }
  }

  await user.save();
}

async function getParticipant(contestId, userId) {
  return ContestParticipant.findOne({ contestId, userId });
}

async function assertContestAttemptAllowed(contest, userId) {
  if (contest.status !== 'published') {
    const err = new Error('Contest is not published');
    err.status = 400;
    throw err;
  }

  if (!isAttemptWindowOpen(contest)) {
    const err = new Error('Contest attempt window is not open');
    err.status = 403;
    err.code = 'ATTEMPT_WINDOW_CLOSED';
    throw err;
  }

  const participant = await getParticipant(contest._id, userId);
  if (!participant) {
    const err = new Error('You are not registered for this contest');
    err.status = 403;
    throw err;
  }

  if (participant.status === 'completed' && !contest.settings?.allowRetakes) {
    const err = new Error('You have already completed this contest');
    err.status = 400;
    err.code = 'ALREADY_COMPLETED';
    throw err;
  }

  if (participant.status === 'disqualified') {
    const err = new Error('You are disqualified from this contest');
    err.status = 403;
    throw err;
  }

  return participant;
}

async function findContestBySlug(slug) {
  return Contest.findOne({ slug: slug.toLowerCase().trim() });
}

async function findPublishedContestByAssessment(assessmentType, assessmentId, userId) {
  const contest = await Contest.findOne({
    assessmentType,
    assessmentId,
    status: 'published',
    attemptWindowStart: { $lte: getNow() },
    attemptWindowEnd: { $gte: getNow() },
  }).sort({ createdAt: -1 });

  if (!contest) return null;
  const participant = await getParticipant(contest._id, userId);
  if (!participant) return null;
  return contest;
}

async function getContestStartRedirect(contest) {
  const id = contest.assessmentId.toString();
  const contestQuery = `contestId=${contest._id}`;

  if (contest.assessmentType === 'test') {
    const test = await Test.findById(contest.assessmentId).select('type');
    if (test?.type === 'english') {
      return `/student/english-test/${id}?${contestQuery}`;
    }
    return `/student/test/${id}?${contestQuery}`;
  }
  if (contest.assessmentType === 'interview') {
    return `/student/interviews/${id}?${contestQuery}`;
  }
  if (contest.assessmentType === 'assignment') {
    return `/student/submit-assignment/${id}?${contestQuery}`;
  }
  if (contest.assessmentType === 'system_design') {
    return `/student/system-design/${id}?${contestQuery}`;
  }
  return null;
}

async function markParticipantInProgress(participant, attemptRef) {
  participant.status = 'in_progress';
  if (attemptRef) {
    participant.attemptRef = attemptRef;
  }
  await participant.save();
}

async function markParticipantCompleted(contestId, userId, attemptRef) {
  const participant = await getParticipant(contestId, userId);
  if (!participant) return;
  participant.status = 'completed';
  if (attemptRef) {
    participant.attemptRef = attemptRef;
  }
  await participant.save();
}

async function syncParticipantOnTestStart(contestId, userId, resultId) {
  const participant = await getParticipant(contestId, userId);
  if (!participant) return;
  participant.status = 'in_progress';
  participant.attemptRef = { model: 'Result', id: resultId };
  await participant.save();
}

async function syncParticipantOnInterviewStart(contestId, userId, sessionId) {
  const participant = await getParticipant(contestId, userId);
  if (!participant) return;
  participant.status = 'in_progress';
  participant.attemptRef = { model: 'InterviewSession', id: sessionId };
  await participant.save();
}

async function syncParticipantOnAssignmentStart(contestId, userId) {
  const participant = await getParticipant(contestId, userId);
  if (!participant) return;
  participant.status = 'in_progress';
  participant.attemptRef = { model: 'ProjectSubmission', id: null };
  await participant.save();
}

async function syncParticipantOnSystemDesignStart(contestId, userId, submissionId) {
  const participant = await getParticipant(contestId, userId);
  if (!participant) return;
  participant.status = 'in_progress';
  participant.attemptRef = { model: 'SystemDesignSubmission', id: submissionId };
  await participant.save();
}

async function resolveContestForRequest(contestId, assessmentType, assessmentId, userId) {
  if (contestId) {
    const contest = await Contest.findById(contestId);
    if (!contest) return null;
    const participant = await getParticipant(contest._id, userId);
    if (!participant) return null;
    return contest;
  }
  return findPublishedContestByAssessment(assessmentType, assessmentId, userId);
}

async function enforceContestWindowIfApplicable(contestId, assessmentType, assessmentId, userId) {
  const contest = await resolveContestForRequest(contestId, assessmentType, assessmentId, userId);
  if (!contest) return null;
  await assertContestAttemptAllowed(contest, userId);
  return contest;
}

function buildPublicContestPayload(contest, assessment, participant, phase, branding = null) {
  return {
    id: contest._id,
    vendorId: contest.vendorId,
    branding: branding || null,
    title: contest.title,
    description: contest.description,
    slug: contest.slug,
    status: contest.status,
    assessmentType: contest.assessmentType,
    assessment: assessment || null,
    registrationOpensAt: getRegistrationOpensAt(contest),
    registrationClosesAt: getRegistrationClosesAt(contest),
    attemptWindowStart: contest.attemptWindowStart,
    attemptWindowEnd: contest.attemptWindowEnd,
    settings: {
      collectPhone: contest.settings?.collectPhone || false,
      collectCollege: contest.settings?.collectCollege || false,
      collectRollNumber: contest.settings?.collectRollNumber || false,
      showLeaderboard: contest.settings?.showLeaderboard || false,
    },
    phase,
    serverNow: getNow(),
    participant: participant
      ? {
          status: participant.status,
          registeredAt: participant.registeredAt,
        }
      : null,
  };
}

module.exports = {
  ASSESSMENT_MODEL_MAP,
  getRegistrationOpensAt,
  getRegistrationClosesAt,
  isRegistrationOpen,
  isAttemptWindowOpen,
  getContestPhase,
  loadAssessmentSummary,
  validateAssessmentOwnership,
  ensureAssessmentEnrollment,
  getParticipant,
  assertContestAttemptAllowed,
  findContestBySlug,
  findPublishedContestByAssessment,
  getContestStartRedirect,
  markParticipantInProgress,
  markParticipantCompleted,
  syncParticipantOnTestStart,
  syncParticipantOnInterviewStart,
  syncParticipantOnAssignmentStart,
  syncParticipantOnSystemDesignStart,
  resolveContestForRequest,
  enforceContestWindowIfApplicable,
  buildPublicContestPayload,
  getTestAttemptDeadlineMs,
  isTestAttemptExpired,
  finalizeInProgressTestResult,
  finalizeAllInProgressContestAttempts,
  ensureContestAttemptsFinalized,
  autoSubmitStaleContestTestAttempts,
  sweepExpiredContestTestAttempts,
};
