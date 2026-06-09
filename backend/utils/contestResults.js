const Contest = require('../models/Contest');
const ContestParticipant = require('../models/ContestParticipant');
const User = require('../models/User');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const Result = require('../models/Result');
const InterviewSession = require('../models/InterviewSession');
const ProjectSubmission = require('../models/ProjectSubmission');
const EvaluationResult = require('../models/EvaluationResult');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const { loadAssessmentSummary, ensureContestAttemptsFinalized } = require('./contestService');
const { formatDate } = require('./reports/formatters');
const { assignContestRanks, sortForContestLeaderboard } = require('./contestRanking');

async function loadContestForVendor(contestId, vendorId) {
  const contest = await Contest.findOne({ _id: contestId, vendorId });
  if (!contest) return null;
  return contest;
}

async function loadParticipants(contestId) {
  return ContestParticipant.find({ contestId })
    .populate('userId', 'name email accountOrigin')
    .sort({ registeredAt: -1 })
    .lean();
}

function participantMap(participants) {
  return new Map(
    participants
      .filter((p) => p.userId)
      .map((p) => {
        const uid = (p.userId._id || p.userId).toString();
        return [uid, p];
      })
  );
}

function pickLatestByStudent(items, studentIdKey = 'studentId') {
  const statusPriority = (item) => {
    if (item?.status === 'completed') return 2;
    if (item?.status === 'in_progress') return 1;
    return 0;
  };

  const map = new Map();
  items.forEach((item) => {
    const sid = (item[studentIdKey]?._id || item[studentIdKey])?.toString();
    if (!sid) return;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(item);
  });
  const latest = new Map();
  map.forEach((list, sid) => {
    latest.set(
      sid,
      list.sort((a, b) => {
        const priorityDiff = statusPriority(b) - statusPriority(a);
        if (priorityDiff !== 0) return priorityDiff;
        const ta = new Date(a.submittedAt || a.completedAt || a.startedAt || 0).getTime();
        const tb = new Date(b.submittedAt || b.completedAt || b.startedAt || 0).getTime();
        return tb - ta;
      })[0]
    );
  });
  return latest;
}

function computeScoreAnalytics(rows, getPercent) {
  const completed = rows.filter((r) => getPercent(r) != null && !Number.isNaN(getPercent(r)));
  const percents = completed.map((r) => Number(getPercent(r)) || 0);
  const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };
  percents.forEach((pct) => {
    if (pct >= 80) distribution.excellent += 1;
    else if (pct >= 60) distribution.good += 1;
    else if (pct >= 40) distribution.average += 1;
    else distribution.poor += 1;
  });
  return {
    registered: rows.length,
    completed: completed.length,
    inProgress: rows.filter((r) => r.attemptStatus === 'in_progress').length,
    notStarted: rows.filter((r) => r.attemptStatus === 'not_started' || r.attemptStatus === 'registered').length,
    average: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : 0,
    highest: percents.length ? Math.max(...percents) : 0,
    lowest: percents.length ? Math.min(...percents) : 0,
    distribution,
  };
}

async function buildTestContestRows(contest, participants) {
  const testId = contest.assessmentId;
  const validParticipants = participants.filter((p) => p.userId);
  const studentIds = validParticipants.map((p) => p.userId._id || p.userId);
  const results = studentIds.length
    ? await Result.find({
        testId,
        studentId: { $in: studentIds },
      })
        .populate('studentId', 'name email')
        .sort({ submittedAt: -1 })
        .lean()
    : [];

  const latest = pickLatestByStudent(results);

  return validParticipants.map((p) => {
    const sid = (p.userId._id || p.userId).toString();
    const result = latest.get(sid);
    return {
      participantId: p._id,
      studentId: p.userId,
      participantStatus: p.status,
      registeredAt: p.registeredAt,
      registrationMeta: p.registrationMeta || {},
      attemptStatus: result?.status || (p.status === 'in_progress' ? 'in_progress' : 'not_started'),
      resultId: result?._id,
      totalScore: result?.totalScore,
      maxScore: result?.maxScore,
      percentage: result?.percentage,
      startedAt: result?.startedAt,
      submittedAt: result?.submittedAt,
      timeSpent: result?.timeSpent,
      violationCount: result?.violationCount,
      sectionScores: result?.sectionScores || [],
      raw: result || null,
    };
  });
}

async function buildInterviewContestRows(contest, participants) {
  const interviewId = contest.assessmentId;
  const studentIds = participants.map((p) => p.userId._id);
  const sessions = await InterviewSession.find({
    interviewId,
    studentId: { $in: studentIds },
  })
    .populate('studentId', 'name email')
    .sort({ submittedAt: -1 })
    .lean();

  const latest = pickLatestByStudent(sessions);

  return participants.map((p) => {
    const sid = p.userId._id.toString();
    const session = latest.get(sid);
    return {
      participantId: p._id,
      studentId: p.userId,
      participantStatus: p.status,
      registeredAt: p.registeredAt,
      registrationMeta: p.registrationMeta || {},
      attemptStatus: session?.status || 'not_started',
      resultId: session?._id,
      totalScore: session?.overallScore,
      maxScore: 100,
      percentage: session?.readinessPercent ?? session?.overallScore,
      startedAt: session?.startedAt,
      submittedAt: session?.submittedAt,
      timeSpent: session?.timeSpent,
      raw: session || null,
    };
  });
}

async function buildAssignmentContestRows(contest, participants) {
  const assignmentId = contest.assessmentId;
  const studentIds = participants.map((p) => p.userId._id);
  const submissions = await ProjectSubmission.find({
    assignmentId,
    studentId: { $in: studentIds },
  })
    .populate('studentId', 'name email')
    .sort({ submittedAt: -1 })
    .lean();

  const submissionIds = submissions.map((s) => s._id);
  const evaluations = submissionIds.length
    ? await EvaluationResult.find({ submissionId: { $in: submissionIds } }).lean()
    : [];
  const evalMap = new Map(evaluations.map((e) => [e.submissionId.toString(), e]));

  const latest = pickLatestByStudent(submissions);

  return participants.map((p) => {
    const sid = p.userId._id.toString();
    const submission = latest.get(sid);
    const evaluation = submission ? evalMap.get(submission._id.toString()) : null;
    return {
      participantId: p._id,
      studentId: p.userId,
      participantStatus: p.status,
      registeredAt: p.registeredAt,
      registrationMeta: p.registrationMeta || {},
      attemptStatus: submission?.status || 'not_started',
      resultId: submission?._id,
      totalScore: evaluation?.totalScore,
      maxScore: evaluation?.totalPossibleScore,
      percentage: evaluation?.percentage,
      startedAt: submission?.createdAt,
      submittedAt: submission?.submittedAt,
      grade: evaluation?.grade,
      raw: { submission, evaluation },
    };
  });
}

async function buildSystemDesignContestRows(contest, participants) {
  const problemId = contest.assessmentId;
  const studentIds = participants.map((p) => p.userId._id);
  const submissions = await SystemDesignSubmission.find({
    problemId,
    studentId: { $in: studentIds },
  })
    .populate('studentId', 'name email')
    .sort({ submittedAt: -1 })
    .lean();

  const latest = pickLatestByStudent(submissions);

  return participants.map((p) => {
    const sid = p.userId._id.toString();
    const submission = latest.get(sid);
    return {
      participantId: p._id,
      studentId: p.userId,
      participantStatus: p.status,
      registeredAt: p.registeredAt,
      registrationMeta: p.registrationMeta || {},
      attemptStatus: submission?.status || 'not_started',
      resultId: submission?._id,
      totalScore: submission?.totalScore,
      maxScore: submission?.maxScore,
      percentage: submission?.percentage,
      startedAt: submission?.startedAt,
      submittedAt: submission?.submittedAt,
      timeSpent: submission?.timeSpent,
      raw: submission || null,
    };
  });
}

async function buildContestResultRows(contest, participants) {
  switch (contest.assessmentType) {
    case 'test':
      return buildTestContestRows(contest, participants);
    case 'interview':
      return buildInterviewContestRows(contest, participants);
    case 'assignment':
      return buildAssignmentContestRows(contest, participants);
    case 'system_design':
      return buildSystemDesignContestRows(contest, participants);
    default:
      return [];
  }
}

async function buildContestLeaderboard(contest) {
  if (contest.assessmentType !== 'test') return [];

  await ensureContestAttemptsFinalized(contest);

  const participants = await loadParticipants(contest._id);
  const studentIds = participants
    .filter((p) => p.userId)
    .map((p) => p.userId._id || p.userId);
  if (!studentIds.length) return [];

  const results = await Result.find({
    testId: contest.assessmentId,
    studentId: { $in: studentIds },
    status: 'completed',
  })
    .populate('studentId', 'name email')
    .lean();

  const latestByStudent = pickLatestByStudent(results);

  return sortForContestLeaderboard([...latestByStudent.values()]).map((r, idx) => ({
    rank: idx + 1,
    studentName: r.studentId?.name,
    studentEmail: r.studentId?.email,
    score: r.totalScore,
    maxScore: r.maxScore,
    percentage: r.percentage,
    submittedAt: r.submittedAt,
    timeSpent: r.timeSpent,
  }));
}

async function getContestResultsBundle(contestId, vendorId) {
  const contest = await loadContestForVendor(contestId, vendorId);
  if (!contest) return null;

  await ensureContestAttemptsFinalized(contest);

  const participants = await loadParticipants(contest._id);
  const assessment = await loadAssessmentSummary(contest);
  const rows = await buildContestResultRows(contest, participants);

  const analytics = computeScoreAnalytics(rows, (r) => r.percentage);
  const rowsWithRank = assignContestRanks(rows, {
    idKey: (r) => r.participantId?.toString(),
  });

  return {
    contest: {
      ...contest.toObject(),
      assessment,
    },
    analytics,
    rows: rowsWithRank,
    participantCount: participants.length,
  };
}

async function getContestStudentIds(contestId) {
  const participants = await ContestParticipant.find({ contestId }).select('userId').lean();
  return participants.map((p) => p.userId);
}

module.exports = {
  loadContestForVendor,
  loadParticipants,
  participantMap,
  getContestResultsBundle,
  getContestStudentIds,
  buildContestResultRows,
  buildContestLeaderboard,
};
