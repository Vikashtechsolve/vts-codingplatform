const mongoose = require('mongoose');
const CodingQuestion = require('../../models/CodingQuestion');
const PracticeSubmission = require('../../models/PracticeSubmission');

function toIdList(ids = []) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (id == null) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
  }
  return out;
}

function buildStatusFilter(status, solvedIds, attemptedIds) {
  if (!status) return null;
  if (status === 'solved') return { _id: { $in: solvedIds } };
  if (status === 'attempted') return { _id: { $in: attemptedIds, $nin: solvedIds } };
  if (status === 'unsolved' || status === 'todo') {
    return { _id: { $nin: toIdList([...(solvedIds || []), ...(attemptedIds || [])]) } };
  }
  return null;
}

function userStatusFor(id, solvedSet, attemptedSet) {
  const key = String(id);
  if (solvedSet.has(key)) return 'solved';
  if (attemptedSet.has(key)) return 'attempted';
  return 'unsolved';
}

async function getQuestionAttemptStats(studentId, questionIds) {
  if (!studentId || !questionIds?.length) return new Map();

  const ids = questionIds
    .map((id) => {
      try {
        return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (!ids.length) return new Map();

  const sid =
    typeof studentId === 'string' ? new mongoose.Types.ObjectId(studentId) : studentId;

  const rows = await PracticeSubmission.aggregate([
    { $match: { studentId: sid, questionId: { $in: ids } } },
    { $sort: { submittedAt: -1 } },
    {
      $group: {
        _id: '$questionId',
        attempts: { $sum: 1 },
        bestScore: { $max: '$score' },
        lastStatus: { $first: '$status' },
        lastSubmittedAt: { $first: '$submittedAt' },
        acceptedCount: {
          $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
        },
      },
    },
  ]);

  return new Map(rows.map((row) => [String(row._id), row]));
}

async function getDifficultyProgress(profile) {
  const totals = { easy: 0, medium: 0, hard: 0 };
  const rows = await CodingQuestion.aggregate([
    { $match: { isGlobal: true, practiceEnabled: true } },
    { $group: { _id: '$difficulty', total: { $sum: 1 } } },
  ]);

  for (const row of rows) {
    if (row._id && totals[row._id] !== undefined) totals[row._id] = row.total;
  }

  const solved = {
    easy: profile?.difficulty?.easy || 0,
    medium: profile?.difficulty?.medium || 0,
    hard: profile?.difficulty?.hard || 0,
  };

  const total = totals.easy + totals.medium + totals.hard;
  const solvedCount = profile?.problemsSolved ?? solved.easy + solved.medium + solved.hard;

  return {
    solved: solvedCount,
    attempted: profile?.problemsAttempted || 0,
    total,
    difficulty: {
      easy: { solved: solved.easy, total: totals.easy },
      medium: { solved: solved.medium, total: totals.medium },
      hard: { solved: solved.hard, total: totals.hard },
    },
  };
}

function attachAttemptStats(question, stats, solvedSet, attemptedSet) {
  const id = String(question._id);
  return {
    userStatus: userStatusFor(id, solvedSet, attemptedSet),
    attempts: stats?.attempts || 0,
    bestScore: stats?.bestScore ?? null,
    lastStatus: stats?.lastStatus || null,
    lastSubmittedAt: stats?.lastSubmittedAt || null,
    acceptedCount: stats?.acceptedCount || 0,
  };
}

module.exports = {
  buildStatusFilter,
  userStatusFor,
  getQuestionAttemptStats,
  getDifficultyProgress,
  attachAttemptStats,
};
