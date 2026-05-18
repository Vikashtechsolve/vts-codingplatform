const CodingQuestion = require('../../models/CodingQuestion');
const MCQQuestion = require('../../models/MCQQuestion');
const AptitudeQuestion = require('../../models/AptitudeQuestion');
const TheoryQuestion = require('../../models/TheoryQuestion');
const SQLQuestion = require('../../models/SQLQuestion');
const EnglishGrammarQuestion = require('../../models/EnglishGrammarQuestion');
const EnglishVocabularyQuestion = require('../../models/EnglishVocabularyQuestion');
const EnglishReadingQuestion = require('../../models/EnglishReadingQuestion');
const EnglishEssayQuestion = require('../../models/EnglishEssayQuestion');
const EnglishSpeakingQuestion = require('../../models/EnglishSpeakingQuestion');
const EnglishListeningQuestion = require('../../models/EnglishListeningQuestion');

const TYPE_TO_MODEL = {
  coding: CodingQuestion,
  mcq: MCQQuestion,
  aptitude: AptitudeQuestion,
  theory: TheoryQuestion,
  sql: SQLQuestion,
  english_grammar: EnglishGrammarQuestion,
  english_vocabulary: EnglishVocabularyQuestion,
  english_reading: EnglishReadingQuestion,
  english_essay: EnglishEssayQuestion,
  english_speaking: EnglishSpeakingQuestion,
  english_listening: EnglishListeningQuestion,
};

const getQuestionTitle = (q, type) => {
  if (!q) return '';
  if (type === 'coding') return q.title || '';
  if (type === 'mcq' || type === 'aptitude') return truncatePlain(q.question, 200);
  if (type === 'theory') return truncatePlain(q.questionText || q.title, 200);
  if (type === 'sql') return truncatePlain(q.text, 200);
  if (type === 'english_vocabulary') return q.word || q.questionText || '';
  if (type === 'english_essay') return q.prompt || q.questionText || '';
  if (type === 'english_speaking') return q.prompt || q.questionText || '';
  return q.questionText || q.title || q.text || '';
};

const truncatePlain = (s, max) => {
  if (!s) return '';
  const str = String(s).replace(/\s+/g, ' ').trim();
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

/**
 * Load all questions for a test into a Map keyed by questionId string.
 * Each value: { type, order, points, title, raw }
 */
async function loadQuestionsForTest(test) {
  const map = new Map();
  const questions = test.questions || [];

  const byType = {};
  questions.forEach((tq) => {
    const type = tq.type;
    if (!byType[type]) byType[type] = [];
    byType[type].push(tq);
  });

  await Promise.all(
    Object.entries(byType).map(async ([type, items]) => {
      const Model = TYPE_TO_MODEL[type];
      if (!Model) return;
      const ids = items.map((i) => i.questionId);
      const docs = await Model.find({ _id: { $in: ids } }).lean();
      const docMap = new Map(docs.map((d) => [d._id.toString(), d]));

      items.forEach((tq) => {
        const id = tq.questionId.toString();
        const raw = docMap.get(id);
        map.set(id, {
          type,
          order: tq.order,
          points: tq.points,
          sectionId: tq.sectionId,
          title: getQuestionTitle(raw, type),
          raw,
        });
      });
    })
  );

  return map;
}

module.exports = {
  loadQuestionsForTest,
  TYPE_TO_MODEL,
  getQuestionTitle,
};
