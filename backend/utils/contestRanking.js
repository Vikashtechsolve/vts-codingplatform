/**
 * Contest ranking: higher marks first; on a tie, earlier finish time wins.
 * Secondary tiebreaker: less time spent on the attempt.
 */

function getMarks(row) {
  if (row.totalScore != null && !Number.isNaN(Number(row.totalScore))) {
    return Number(row.totalScore);
  }
  if (row.score != null && !Number.isNaN(Number(row.score))) {
    return Number(row.score);
  }
  return null;
}

function getPercentage(row) {
  if (row.percentage == null || Number.isNaN(Number(row.percentage))) return null;
  return Number(row.percentage);
}

function getFinishTimestamp(row) {
  const raw = row.submittedAt || row.completedAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

function getTimeSpentSeconds(row) {
  if (row.timeSpent == null || Number.isNaN(Number(row.timeSpent))) return null;
  return Number(row.timeSpent);
}

function isRankEligible(row) {
  return getMarks(row) != null || getPercentage(row) != null;
}

function compareContestRanking(a, b) {
  const marksA = getMarks(a);
  const marksB = getMarks(b);
  if (marksA != null && marksB != null && marksA !== marksB) {
    return marksB - marksA;
  }

  const pctA = getPercentage(a);
  const pctB = getPercentage(b);
  if (pctA != null && pctB != null && pctA !== pctB) {
    return pctB - pctA;
  }

  const finishA = getFinishTimestamp(a);
  const finishB = getFinishTimestamp(b);
  if (finishA != null && finishB != null && finishA !== finishB) {
    return finishA - finishB;
  }

  const spentA = getTimeSpentSeconds(a);
  const spentB = getTimeSpentSeconds(b);
  if (spentA != null && spentB != null && spentA !== spentB) {
    return spentA - spentB;
  }

  return 0;
}

function assignContestRanks(items, { idKey } = {}) {
  const resolveId = idKey || ((row) => row.participantId?.toString() || row.sid || row._id?.toString());

  const eligible = items.filter(isRankEligible);
  const sorted = [...eligible].sort(compareContestRanking);

  const rankMap = new Map();
  sorted.forEach((item, idx) => {
    const id = resolveId(item);
    if (id) rankMap.set(id, idx + 1);
  });

  const ranked = items.map((item) => ({
    ...item,
    rank: rankMap.get(resolveId(item)) ?? null,
  }));

  ranked.sort((a, b) => {
    if (a.rank == null && b.rank == null) return 0;
    if (a.rank == null) return 1;
    if (b.rank == null) return -1;
    return a.rank - b.rank;
  });

  return ranked;
}

function sortForContestLeaderboard(items) {
  return [...items].filter(isRankEligible).sort(compareContestRanking);
}

module.exports = {
  compareContestRanking,
  assignContestRanks,
  sortForContestLeaderboard,
  isRankEligible,
  getMarks,
  getFinishTimestamp,
  getTimeSpentSeconds,
};
