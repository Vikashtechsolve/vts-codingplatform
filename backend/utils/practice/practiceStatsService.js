const PracticeTopic = require('../../models/PracticeTopic');
const StudentPracticeProfile = require('../../models/StudentPracticeProfile');
const PracticeSubmission = require('../../models/PracticeSubmission');
const CodingQuestion = require('../../models/CodingQuestion');

const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function computeMasteryScore({ solved, attempted, difficultySolved }) {
  if (!attempted) return 0;
  const solveRate = solved / attempted;
  const weightedSolves =
    (difficultySolved.easy || 0) * 1 +
    (difficultySolved.medium || 0) * 2 +
    (difficultySolved.hard || 0) * 3;
  const difficultyMix = Math.min(1, weightedSolves / Math.max(1, solved * 2));
  const recency = 0.7;
  const consistency = solved > 0 ? Math.min(1, solved / attempted) : 0;
  const raw = solveRate * 40 + difficultyMix * 25 + recency * 15 + consistency * 20;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

function strengthFromScore(score, solved) {
  if (score >= 90 && solved >= 5) return 'mastered';
  if (score >= 70) return 'strong';
  if (score >= 40) return 'developing';
  return 'weak';
}

function computeCodingScore(profile) {
  const { difficulty, streak, topicMastery, successRate } = profile;
  const base =
    (difficulty?.easy || 0) * 10 +
    (difficulty?.medium || 0) * 25 +
    (difficulty?.hard || 0) * 50;
  const multiplier = 0.5 + (successRate || 0) / 200;
  const streakBonus = Math.min((streak?.current || 0) * 2, 30);
  const mastered = (topicMastery || []).filter((t) => t.strength === 'mastered').length;
  const masteryBonus = mastered * 15;
  return Math.min(10000, Math.round(base * multiplier + streakBonus + masteryBonus));
}

async function getOrCreateProfile(studentId, vendorId) {
  let profile = await StudentPracticeProfile.findOne({ studentId });
  if (!profile) {
    profile = new StudentPracticeProfile({
      studentId,
      vendorId,
      dailyGoal: { target: 2, completedToday: 0, date: todayKey() },
      weeklyProgress: [],
      recentSubmissions: [],
    });
    await profile.save();
  }
  return profile;
}

function updateStreak(streak, solvedToday) {
  const today = todayKey();
  const next = { ...streak };
  if (!solvedToday) return next;

  if (next.lastPracticeDate === today) {
    return next;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (next.lastPracticeDate === yesterdayKey) {
    next.current = (next.current || 0) + 1;
  } else {
    next.current = 1;
  }
  next.longest = Math.max(next.longest || 0, next.current);
  next.lastPracticeDate = today;
  return next;
}

function updateWeeklyProgress(weeklyProgress, { solved, attempted, timeMs }) {
  const today = todayKey();
  const list = Array.isArray(weeklyProgress) ? [...weeklyProgress] : [];
  const idx = list.findIndex((d) => d.date === today);
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      solved: (list[idx].solved || 0) + solved,
      attempted: (list[idx].attempted || 0) + attempted,
      timeMs: (list[idx].timeMs || 0) + timeMs,
    };
  } else {
    list.push({ date: today, solved, attempted, timeMs });
  }
  return list.slice(-7);
}

async function updateProfileAfterSubmission({
  studentId,
  vendorId,
  question,
  submission,
  isNewSolve,
  isNewAttempt,
}) {
  const profile = await getOrCreateProfile(studentId, vendorId);
  const topics = await PracticeTopic.find({ isActive: true }).lean();
  const topicMap = Object.fromEntries(topics.map((t) => [t._id.toString(), t]));

  if (isNewAttempt) {
    profile.problemsAttempted += 1;
    if (!profile.attemptedQuestionIds.some((id) => String(id) === String(question._id))) {
      profile.attemptedQuestionIds.push(question._id);
    }
  }

  if (isNewSolve) {
    profile.problemsSolved += 1;
    if (!profile.solvedQuestionIds.some((id) => String(id) === String(question._id))) {
      profile.solvedQuestionIds.push(question._id);
    }
    const diff = question.difficulty || 'medium';
    profile.difficulty[diff] = (profile.difficulty[diff] || 0) + 1;
  }

  profile.totalCodingTimeMs += submission.timeSpentMs || 0;
  profile.avgSolveTimeMs = profile.problemsAttempted
    ? Math.round(profile.totalCodingTimeMs / profile.problemsAttempted)
    : 0;
  profile.successRate = profile.problemsAttempted
    ? Math.round((profile.problemsSolved / profile.problemsAttempted) * 100)
    : 0;

  const today = todayKey();
  if (profile.dailyGoal?.date !== today) {
    profile.dailyGoal = {
      target: profile.dailyGoal?.target || 2,
      completedToday: 0,
      date: today,
    };
  }
  if (submission.status === 'accepted') {
    profile.dailyGoal.completedToday = (profile.dailyGoal.completedToday || 0) + 1;
    profile.streak = updateStreak(profile.streak || {}, true);
  }

  profile.weeklyProgress = updateWeeklyProgress(profile.weeklyProgress, {
    solved: submission.status === 'accepted' ? 1 : 0,
    attempted: 1,
    timeMs: submission.timeSpentMs || 0,
  });

  const topicIds = (question.practiceTopics || []).map((id) => String(id));
  const masteryMap = Object.fromEntries(
    (profile.topicMastery || []).map((t) => [String(t.topicId), { ...t }])
  );

  for (const topicId of topicIds) {
    const meta = topicMap[topicId];
    if (!meta) continue;
    const row = masteryMap[topicId] || {
      topicId: meta._id,
      slug: meta.slug,
      label: meta.label,
      solved: 0,
      attempted: 0,
      masteryScore: 0,
      strength: 'weak',
    };
    row.attempted += 1;
    if (submission.status === 'accepted') row.solved += 1;
    row.lastAttemptAt = submission.submittedAt || new Date();
    const diffKey = question.difficulty || 'medium';
    const difficultySolved = { easy: 0, medium: 0, hard: 0 };
    if (submission.status === 'accepted') difficultySolved[diffKey] = 1;
    row.masteryScore = computeMasteryScore({
      solved: row.solved,
      attempted: row.attempted,
      difficultySolved,
    });
    row.strength = strengthFromScore(row.masteryScore, row.solved);
    masteryMap[topicId] = row;
  }

  profile.topicMastery = Object.values(masteryMap);
  const sorted = [...profile.topicMastery].sort((a, b) => a.masteryScore - b.masteryScore);
  profile.weakTopics = sorted
    .filter((t) => t.attempted >= 3)
    .slice(0, 3)
    .map((t) => t.topicId);
  profile.strongTopics = [...profile.topicMastery]
    .sort((a, b) => b.masteryScore - a.masteryScore)
    .filter((t) => t.solved >= 5)
    .slice(0, 3)
    .map((t) => t.topicId);

  profile.codingScore = computeCodingScore(profile);

  const recent = {
    submissionId: submission._id,
    questionId: question._id,
    title: question.title,
    status: submission.status,
    submittedAt: submission.submittedAt || new Date(),
  };
  profile.recentSubmissions = [recent, ...(profile.recentSubmissions || [])].slice(0, 10);

  await profile.save();
  return profile;
}

async function getProfileSummary(studentId) {
  const profile = await StudentPracticeProfile.findOne({ studentId }).lean();
  if (!profile) {
    return {
      codingScore: 0,
      problemsSolved: 0,
      problemsAttempted: 0,
      successRate: 0,
      totalCodingTimeMs: 0,
      avgSolveTimeMs: 0,
      difficulty: { easy: 0, medium: 0, hard: 0 },
      streak: { current: 0, longest: 0, lastPracticeDate: null },
      dailyGoal: { target: 2, completedToday: 0, date: todayKey() },
      weeklyProgress: [],
      topicMastery: [],
      weakTopics: [],
      strongTopics: [],
      recentSubmissions: [],
      solvedQuestionIds: [],
      attemptedQuestionIds: [],
    };
  }
  return profile;
}

module.exports = {
  getOrCreateProfile,
  updateProfileAfterSubmission,
  getProfileSummary,
  computeCodingScore,
  todayKey,
};
