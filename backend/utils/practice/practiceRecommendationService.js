const CodingQuestion = require('../../models/CodingQuestion');
const PracticeDailyChallenge = require('../../models/PracticeDailyChallenge');
const PracticeRoadmap = require('../../models/PracticeRoadmap');
const { todayKey } = require('./practiceStatsService');

async function getRecommendations(studentId, profile, limit = 10) {
  const solvedIds = profile?.solvedQuestionIds || [];
  const attemptedSet = new Set((profile?.attemptedQuestionIds || []).map(String));
  const weakTopicIds = profile?.weakTopics || [];

  const select = 'title difficulty practiceTopics tags estimatedMinutes companyTags';
  const populate = { path: 'practiceTopics', select: 'slug label' };
  const base = { isGlobal: true, practiceEnabled: true, _id: { $nin: solvedIds } };

  const picks = [];
  const seen = new Set();

  const pushUnique = (docs) => {
    for (const q of docs) {
      const id = String(q._id);
      if (seen.has(id)) continue;
      seen.add(id);
      picks.push(q);
      if (picks.length >= limit) return;
    }
  };

  if (weakTopicIds.length) {
    const weak = await CodingQuestion.find({ ...base, practiceTopics: { $in: weakTopicIds } })
      .select(select)
      .populate(populate)
      .limit(limit)
      .lean();
    pushUnique(weak);
  }

  if (picks.length < limit) {
    const rest = await CodingQuestion.find({
      ...base,
      _id: { $nin: [...solvedIds, ...picks.map((p) => p._id)] },
    })
      .select(select)
      .populate(populate)
      .sort({ createdAt: -1 })
      .limit(limit - picks.length)
      .lean();
    pushUnique(rest);
  }

  if (picks.length < limit) {
    const challenge = await PracticeDailyChallenge.findOne({ date: todayKey() })
      .populate({
        path: 'questionId',
        select,
        populate,
      })
      .lean();
    if (challenge?.questionId && !seen.has(String(challenge.questionId._id))) {
      picks.unshift(challenge.questionId);
    }
  }

  return picks.slice(0, limit).map((q) => ({
    ...q,
    userStatus: attemptedSet.has(String(q._id)) ? 'attempted' : 'unsolved',
  }));
}

async function getRoadmapProgress(studentId, profile) {
  const roadmap = await PracticeRoadmap.findOne({ isActive: true })
    .populate('steps.topicId', 'slug label')
    .lean();
  if (!roadmap) return null;

  const solvedSet = new Set((profile?.solvedQuestionIds || []).map(String));
  const steps = (roadmap.steps || []).map((step) => {
    const questionIds = (step.questionIds || []).map(String);
    const solved = questionIds.filter((id) => solvedSet.has(id)).length;
    return {
      ...step,
      total: questionIds.length,
      solved,
      percent: questionIds.length ? Math.round((solved / questionIds.length) * 100) : 0,
    };
  });

  const totalQ = steps.reduce((s, st) => s + st.total, 0);
  const solvedQ = steps.reduce((s, st) => s + st.solved, 0);

  return {
    ...roadmap,
    steps,
    progress: {
      total: totalQ,
      solved: solvedQ,
      percent: totalQ ? Math.round((solvedQ / totalQ) * 100) : 0,
    },
  };
}

async function getWeakTopicDrill(studentId, profile, count = 5) {
  const weakTopicIds = (profile?.weakTopics || []).map(String);
  if (!weakTopicIds.length) return [];

  return CodingQuestion.find({
    isGlobal: true,
    practiceEnabled: true,
    practiceTopics: { $in: weakTopicIds },
    _id: { $nin: profile?.solvedQuestionIds || [] },
  })
    .select('title difficulty practiceTopics tags estimatedMinutes')
    .populate('practiceTopics', 'slug label')
    .sort({ difficulty: 1 })
    .limit(count)
    .lean();
}

module.exports = {
  getRecommendations,
  getRoadmapProgress,
  getWeakTopicDrill,
};
