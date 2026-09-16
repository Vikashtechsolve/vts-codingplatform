const CodingQuestion = require('../../models/CodingQuestion');
const PracticeSubmission = require('../../models/PracticeSubmission');
const PracticeDailyChallenge = require('../../models/PracticeDailyChallenge');
const PracticeRoadmap = require('../../models/PracticeRoadmap');
const { todayKey } = require('./practiceStatsService');

async function getRecommendations(studentId, profile, limit = 10) {
  const solvedSet = new Set((profile?.solvedQuestionIds || []).map(String));
  const attemptedSet = new Set((profile?.attemptedQuestionIds || []).map(String));

  const baseFilter = { isGlobal: true, practiceEnabled: true };
  const all = await CodingQuestion.find(baseFilter)
    .select('title difficulty practiceTopics tags estimatedMinutes companyTags')
    .populate('practiceTopics', 'slug label')
    .lean();

  const weakTopicIds = (profile?.weakTopics || []).map(String);
  const scored = [];

  for (const q of all) {
    const id = String(q._id);
    if (solvedSet.has(id)) continue;

    let priority = 0;
    const topicIds = (q.practiceTopics || []).map((t) => String(t._id || t));
    if (topicIds.some((tid) => weakTopicIds.includes(tid))) priority += 50;
    if (!attemptedSet.has(id)) priority += 20;
    if (q.difficulty === 'easy') priority += 15;
    if (q.difficulty === 'medium') priority += 10;
    scored.push({ question: q, priority });
  }

  scored.sort((a, b) => b.priority - a.priority);
  const picks = scored.slice(0, limit).map((s) => s.question);

  if (picks.length < limit) {
    const challenge = await PracticeDailyChallenge.findOne({ date: todayKey() })
      .populate({
        path: 'questionId',
        select: 'title difficulty practiceTopics tags estimatedMinutes companyTags',
        populate: { path: 'practiceTopics', select: 'slug label' },
      })
      .lean();
    if (challenge?.questionId && !solvedSet.has(String(challenge.questionId._id))) {
      const exists = picks.some((p) => String(p._id) === String(challenge.questionId._id));
      if (!exists) picks.unshift(challenge.questionId);
    }
  }

  return picks.slice(0, limit);
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
