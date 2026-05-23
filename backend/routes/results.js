const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Result = require('../models/Result');
const Test = require('../models/Test');
const User = require('../models/User');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');
const TheoryQuestion = require('../models/TheoryQuestion');
const SQLQuestion = require('../models/SQLQuestion');
const DatasetTemplate = require('../models/DatasetTemplate');
const { evaluateTheoryAnswer } = require('../utils/aiEvaluation');
const { runInSandbox } = require('../utils/sqlSandbox');
const EnglishGrammarQuestion = require('../models/EnglishGrammarQuestion');
const EnglishVocabularyQuestion = require('../models/EnglishVocabularyQuestion');
const EnglishReadingQuestion = require('../models/EnglishReadingQuestion');
const EnglishEssayQuestion = require('../models/EnglishEssayQuestion');
const EnglishSpeakingQuestion = require('../models/EnglishSpeakingQuestion');
const EnglishListeningQuestion = require('../models/EnglishListeningQuestion');
const CodingQuestion = require('../models/CodingQuestion');
const { MAX_VIOLATIONS, normalizeViolationType } = require('../utils/examViolations');

const sanitizeCodingQuestionForStudent = (q) => {
  if (!q) return null;
  const obj = typeof q.toObject === 'function' ? q.toObject() : { ...q };
  delete obj.solution;
  if (Array.isArray(obj.testCases)) {
    obj.testCases = obj.testCases.map((tc) => ({
      input: tc.input,
      expectedOutput: tc.isHidden ? undefined : tc.expectedOutput,
      isHidden: !!tc.isHidden,
      points: tc.points,
    }));
  }
  return obj;
};

const STANDARD_SECTION_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  sql: 'SQL',
};

const STANDARD_SECTION_ORDER = ['coding', 'mcq', 'aptitude', 'theory', 'sql'];

function buildSectionScoresForStandardTest(test, result) {
  const typesPresent = [...new Set((result.answers || []).map((a) => a.questionType))];
  const orderedTypes = STANDARD_SECTION_ORDER.filter((t) => typesPresent.includes(t));
  const extra = typesPresent.filter((t) => !STANDARD_SECTION_ORDER.includes(t));

  return [...orderedTypes, ...extra].map((sectionType) => {
    const sectionAnswers = result.answers.filter((a) => a.questionType === sectionType);
    const score = sectionAnswers.reduce((sum, a) => sum + (a.points || 0), 0);
    const maxScore = sectionAnswers.reduce((sum, a) => sum + (a.maxPoints || 0), 0);
    return {
      sectionType,
      sectionTitle: STANDARD_SECTION_LABELS[sectionType] || sectionType,
      score,
      maxScore,
      percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    };
  });
}

async function ensureSectionScores(out) {
  if (out.status !== 'completed') return out;
  const testType = out.testId?.type;
  if (testType === 'english') return out;
  if (out.sectionScores?.length > 0) return out;

  const testId = out.testId?._id || out.testId;
  if (!testId) return out;

  const test = await Test.findById(testId).select('type questions');
  if (!test) return out;

  out.sectionScores = buildSectionScoresForStandardTest(test, out);
  return out;
}

async function attachStandardQuestionDetails(out) {
  if (!out?.answers?.length) return out;

  const idsByType = {
    coding: [],
    mcq: [],
    aptitude: [],
    theory: [],
    sql: [],
  };

  out.answers.forEach((a) => {
    if (a.questionId && idsByType[a.questionType]) {
      idsByType[a.questionType].push(a.questionId);
    }
  });

  const maps = {};

  if (idsByType.coding.length) {
    const rows = await CodingQuestion.find({ _id: { $in: idsByType.coding } });
    maps.coding = Object.fromEntries(rows.map((q) => [q._id.toString(), sanitizeCodingQuestionForStudent(q)]));
  }
  if (idsByType.mcq.length) {
    const rows = await MCQQuestion.find({ _id: { $in: idsByType.mcq } });
    maps.mcq = Object.fromEntries(rows.map((q) => [q._id.toString(), q.toObject()]));
  }
  if (idsByType.aptitude.length) {
    const rows = await AptitudeQuestion.find({ _id: { $in: idsByType.aptitude } });
    maps.aptitude = Object.fromEntries(rows.map((q) => [q._id.toString(), q.toObject()]));
  }
  if (idsByType.theory.length) {
    const rows = await TheoryQuestion.find({ _id: { $in: idsByType.theory } })
      .populate('subjectId', 'name')
      .populate('topicId', 'name');
    maps.theory = Object.fromEntries(rows.map((q) => [q._id.toString(), q.toObject()]));
  }
  if (idsByType.sql.length) {
    const rows = await SQLQuestion.find({ _id: { $in: idsByType.sql } });
    maps.sql = Object.fromEntries(rows.map((q) => [q._id.toString(), q.toObject()]));
  }

  out.answers = out.answers.map((a) => {
    const key = a.questionId?.toString?.() || String(a.questionId);
    const details = maps[a.questionType]?.[key];
    if (!details) return a;
    return { ...a, questionDetails: details };
  });

  return out;
}
const {
  evaluateGrammarSubjective,
  evaluateReadingShortAnswer,
  evaluateEssay,
  evaluateSpeaking,
  evaluateListeningShortAnswer,
  checkPlagiarism
} = require('../utils/englishAiEvaluator');
const multer = require('multer');
const { uploadToR2 } = require('../utils/r2Storage');

const uploadSpeaking = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const normalizeOptionIndexes = (indexes = []) => {
  if (!Array.isArray(indexes)) return [];
  return [...new Set(indexes.map(val => parseInt(val, 10)).filter(val => !Number.isNaN(val)))];
};

const evaluateAptitudeAnswer = (question, answer) => {
  if (!question) {
    return { isCorrect: false };
  }

  if (question.questionType === 'numeric') {
    const submitted = parseFloat(answer);
    if (Number.isNaN(submitted)) {
      return { isCorrect: false };
    }
    const tolerance = question.numericTolerance || 0;
    const isCorrect = Math.abs(submitted - question.numericAnswer) <= tolerance;
    return { isCorrect };
  }

  if (question.questionType === 'multi') {
    const submitted = normalizeOptionIndexes(answer);
    const correct = normalizeOptionIndexes(question.correctOptions);
    const isCorrect = submitted.length === correct.length &&
      submitted.every(val => correct.includes(val));
    return { isCorrect };
  }

  const selected = parseInt(answer, 10);
  if (Number.isNaN(selected)) {
    return { isCorrect: false };
  }
  const isCorrect = (question.correctOptions || []).includes(selected);
  return { isCorrect };
};

// Start test (create result)
router.post('/start/:testId', auth, async (req, res) => {
  try {
    console.log('🚀 Starting test:', req.params.testId, 'for student:', req.user._id);
    
    if (req.user.role !== 'student') {
      console.log('❌ Access denied - not a student');
      return res.status(403).json({ message: 'Access denied' });
    }

    const test = await Test.findById(req.params.testId);
    if (!test) {
      console.log('❌ Test not found:', req.params.testId);
      return res.status(404).json({ message: 'Test not found' });
    }

    if (!test.isActive) {
      console.log('❌ Test is not active');
      return res.status(400).json({ message: 'Test is not active' });
    }

    // Check if student is enrolled
    const student = await User.findById(req.user._id);
    const enrollment = student.enrolledTests.find(
      et => et.testId.toString() === test._id.toString()
    );

    if (!enrollment) {
      console.log('❌ Student not enrolled in test');
      return res.status(403).json({ message: 'Test not assigned to you' });
    }

    // Prefer an in-progress attempt; only block when no active attempt exists
    let result = await Result.findOne({
      testId: test._id,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (result) {
      console.log('✅ Returning existing in-progress result');
      return res.json(result);
    }

    const completedResult = await Result.findOne({
      testId: test._id,
      studentId: req.user._id,
      status: "completed"
    }).sort({ submittedAt: -1, createdAt: -1 });

    if (completedResult) {
      console.log('⚠️  Test already completed');
      return res.status(400).json({
        message: 'Test already completed',
        resultId: completedResult._id
      });
    }

    // Validate test has questions
    if (!test.questions || test.questions.length === 0) {
      console.log('❌ Test has no questions');
      return res.status(400).json({ message: 'Test has no questions' });
    }

    // Calculate max score
    const maxScore = test.questions.reduce((sum, q) => sum + (q.points || 10), 0);

    // Create new result
    result = new Result({
      testId: test._id,
      studentId: req.user._id,
      vendorId: test.vendorId,
      startedAt: new Date(),
      maxScore,
      status: 'in_progress',
      answers: test.questions.map(q => ({
        questionId: q.questionId,
        questionType: q.type,
        maxPoints: q.points || 10,
        points: 0
      }))
    });

    await result.save();
    console.log('✅ Result created:', result._id);

    // Update enrollment status
    enrollment.status = 'in_progress';
    enrollment.startedAt = new Date();
    await student.save();
    console.log('✅ Enrollment status updated');

    res.status(201).json(result);
  } catch (error) {
    console.error('❌ Error starting test:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit answer (coding or MCQ)
router.post('/:resultId/answer', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await Result.findOne({
      _id: req.params.resultId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    const { questionId, answer, language, testCasesPassed, totalTestCases, note, flagged } = req.body;

    const answerIndex = result.answers.findIndex(
      a => a.questionId.toString() === questionId.toString()
    );

    if (answerIndex === -1) {
      return res.status(400).json({ message: 'Question not found in test' });
    }

    result.answers[answerIndex].answer = answer;
    if (language) result.answers[answerIndex].language = language;
    if (testCasesPassed !== undefined) result.answers[answerIndex].testCasesPassed = testCasesPassed;
    if (totalTestCases !== undefined) result.answers[answerIndex].totalTestCases = totalTestCases;

    // Calculate points (for MCQ/aptitude check correctness; for coding use test cases)
    if (result.answers[answerIndex].questionType === 'mcq') {
      // Fetch MCQ question to check correct answer
      try {
        const mcqQuestion = await MCQQuestion.findById(questionId);
        if (mcqQuestion && mcqQuestion.options) {
          // answer is the selected option index
          const selectedOptionIndex = parseInt(answer);
          const selectedOption = mcqQuestion.options[selectedOptionIndex];
          
          if (selectedOption && selectedOption.isCorrect) {
            // Correct answer
            result.answers[answerIndex].isCorrect = true;
            result.answers[answerIndex].points = result.answers[answerIndex].maxPoints;
            console.log(`✅ MCQ answer correct for question ${questionId}, option ${selectedOptionIndex}`);
          } else {
            // Incorrect answer
            result.answers[answerIndex].isCorrect = false;
            result.answers[answerIndex].points = 0;
            console.log(`❌ MCQ answer incorrect for question ${questionId}, option ${selectedOptionIndex}`);
          }
        } else {
          console.log(`⚠️  MCQ question not found: ${questionId}`);
          result.answers[answerIndex].isCorrect = false;
          result.answers[answerIndex].points = 0;
        }
      } catch (error) {
        console.error('❌ Error fetching MCQ question:', error);
        result.answers[answerIndex].isCorrect = false;
        result.answers[answerIndex].points = 0;
      }
    } else if (result.answers[answerIndex].questionType === 'aptitude') {
      try {
        const aptitudeQuestion = await AptitudeQuestion.findById(questionId);
        const evaluation = evaluateAptitudeAnswer(aptitudeQuestion, answer);
        result.answers[answerIndex].isCorrect = evaluation.isCorrect;
        result.answers[answerIndex].points = evaluation.isCorrect
          ? result.answers[answerIndex].maxPoints
          : 0;
      } catch (error) {
        console.error('❌ Error fetching aptitude question:', error);
        result.answers[answerIndex].isCorrect = false;
        result.answers[answerIndex].points = 0;
      }
    } else if (result.answers[answerIndex].questionType === 'theory') {
      try {
        const theoryQuestion = await TheoryQuestion.findById(questionId);
        if (!theoryQuestion) {
          result.answers[answerIndex].points = 0;
        } else {
          const evaluation = await evaluateTheoryAnswer({
            question: { ...theoryQuestion.toObject(), maxMarks: result.answers[answerIndex].maxPoints },
            studentAnswer: answer || ''
          });
          result.answers[answerIndex].evaluation = evaluation;
          result.answers[answerIndex].points = evaluation.finalMarks;
        }
      } catch (error) {
        console.error('❌ Error evaluating theory question:', error);
        result.answers[answerIndex].points = 0;
      }
    } else if (result.answers[answerIndex].questionType === 'english_grammar') {
      try {
        const grammarQ = await EnglishGrammarQuestion.findById(questionId);
        if (!grammarQ) return;
        if (grammarQ.subType === 'parajumble') {
          const correct = JSON.stringify(grammarQ.correctOrder) === JSON.stringify(answer);
          result.answers[answerIndex].isCorrect = correct;
          result.answers[answerIndex].points = correct ? result.answers[answerIndex].maxPoints : 0;
        } else if ((grammarQ.subType === 'fill_in_blank' || (grammarQ.subType === 'sentence_correction' && !grammarQ.isSubjective)) && grammarQ.correctAnswer && typeof answer === 'string') {
          const normalized = (s) => (s || '').trim().toLowerCase();
          const isCorrect = normalized(answer) === normalized(grammarQ.correctAnswer);
          result.answers[answerIndex].isCorrect = isCorrect;
          result.answers[answerIndex].points = isCorrect ? result.answers[answerIndex].maxPoints : 0;
        } else if (grammarQ.isSubjective && grammarQ.subType === 'sentence_correction') {
          // Subjective evaluated on final submit only
        } else if (grammarQ.options && grammarQ.options.length > 0) {
          const selectedIdx = parseInt(answer, 10);
          const isCorrect = grammarQ.options[selectedIdx]?.isCorrect || false;
          result.answers[answerIndex].isCorrect = isCorrect;
          result.answers[answerIndex].points = isCorrect ? result.answers[answerIndex].maxPoints : 0;
        }
      } catch (error) {
        console.error('Error evaluating grammar:', error);
      }
    } else if (result.answers[answerIndex].questionType === 'english_vocabulary') {
      try {
        const vocabQ = await EnglishVocabularyQuestion.findById(questionId);
        if (vocabQ) {
          const selectedIdx = parseInt(answer);
          const isCorrect = vocabQ.options[selectedIdx]?.isCorrect || false;
          result.answers[answerIndex].isCorrect = isCorrect;
          result.answers[answerIndex].points = isCorrect ? result.answers[answerIndex].maxPoints : 0;
        }
      } catch (error) {
        console.error('Error evaluating vocabulary:', error);
      }
    } else if (result.answers[answerIndex].questionType === 'english_reading') {
      result.answers[answerIndex].answer = answer;
    } else if (result.answers[answerIndex].questionType === 'english_essay') {
      result.answers[answerIndex].essayContent = answer;
      result.answers[answerIndex].answer = answer;
      const plainText = (answer || '').replace(/<[^>]*>/g, '');
      result.answers[answerIndex].wordCount = plainText.split(/\s+/).filter(Boolean).length;
    } else if (result.answers[answerIndex].questionType === 'english_speaking') {
      result.answers[answerIndex].answer = answer;
    } else if (result.answers[answerIndex].questionType === 'english_listening') {
      result.answers[answerIndex].answer = answer;
    } else if (result.answers[answerIndex].questionType === 'sql') {
      result.answers[answerIndex].answer = answer;
    }

    if (note !== undefined) result.answers[answerIndex].note = note || '';
    if (flagged !== undefined) result.answers[answerIndex].flagged = !!flagged;

    if (result.answers[answerIndex].questionType === 'coding') {
      // Coding question scoring based on test cases
      if (testCasesPassed !== undefined && totalTestCases !== undefined) {
        const maxPoints = result.answers[answerIndex].maxPoints;
        result.answers[answerIndex].points = Math.round(
          (testCasesPassed / totalTestCases) * maxPoints
        );
        result.answers[answerIndex].isCorrect = (testCasesPassed === totalTestCases);
      }
    }

    await result.save();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Submit test
router.post('/:resultId/submit', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await Result.findOne({
      _id: req.params.resultId,
      studentId: req.user._id
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    if (result.status === 'completed') {
      return res.status(400).json({ message: 'Test already submitted', resultId: result._id });
    }

    // Re-evaluate all MCQ/aptitude answers before final submission
    console.log('📊 Re-evaluating all answers before submission...');
    for (let i = 0; i < result.answers.length; i++) {
      const answer = result.answers[i];
      
      if (answer.questionType === 'mcq' && answer.answer !== undefined && answer.answer !== null) {
        try {
          const mcqQuestion = await MCQQuestion.findById(answer.questionId);
          if (mcqQuestion && mcqQuestion.options) {
            const selectedOptionIndex = parseInt(answer.answer);
            const selectedOption = mcqQuestion.options[selectedOptionIndex];
            
            if (selectedOption && selectedOption.isCorrect) {
              answer.isCorrect = true;
              answer.points = answer.maxPoints;
              console.log(`✅ MCQ question ${answer.questionId}: Correct (option ${selectedOptionIndex})`);
            } else {
              answer.isCorrect = false;
              answer.points = 0;
              console.log(`❌ MCQ question ${answer.questionId}: Incorrect (option ${selectedOptionIndex})`);
            }
          }
        } catch (error) {
          console.error(`❌ Error evaluating MCQ question ${answer.questionId}:`, error);
          answer.isCorrect = false;
          answer.points = 0;
        }
      }

      if (answer.questionType === 'aptitude' && answer.answer !== undefined && answer.answer !== null) {
        try {
          const aptitudeQuestion = await AptitudeQuestion.findById(answer.questionId);
          const evaluation = evaluateAptitudeAnswer(aptitudeQuestion, answer.answer);
          answer.isCorrect = evaluation.isCorrect;
          answer.points = evaluation.isCorrect ? answer.maxPoints : 0;
        } catch (error) {
          console.error(`❌ Error evaluating aptitude question ${answer.questionId}:`, error);
          answer.isCorrect = false;
          answer.points = 0;
        }
      }

      if (answer.questionType === 'theory' && answer.answer !== undefined && answer.answer !== null) {
        try {
          const theoryQuestion = await TheoryQuestion.findById(answer.questionId);
          if (!theoryQuestion) {
            answer.points = 0;
          } else if (!answer.manualOverride?.isManual) {
            const evaluation = await evaluateTheoryAnswer({
              question: { ...theoryQuestion.toObject(), maxMarks: answer.maxPoints },
              studentAnswer: answer.answer || ''
            });
            answer.evaluation = evaluation;
            answer.points = evaluation.finalMarks;
          }
        } catch (error) {
          console.error(`❌ Error evaluating theory question ${answer.questionId}:`, error);
          answer.points = 0;
        }
      }

      if (answer.questionType === 'sql') {
        try {
          const test = await Test.findById(result.testId);
          if (!test || test.type !== 'sql' || !test.datasetTemplateId) {
            answer.points = 0;
            answer.isCorrect = false;
          } else {
            const template = await DatasetTemplate.findById(test.datasetTemplateId);
            const sqlQuestion = await SQLQuestion.findById(answer.questionId);
            if (!template || !sqlQuestion) {
              answer.points = 0;
              answer.isCorrect = false;
            } else {
              const studentSql = (answer.answer && answer.answer.trim()) || '';
              if (!studentSql) {
                answer.points = 0;
                answer.isCorrect = false;
              } else {
                const run = runInSandbox(template.schemaSql, template.dataSql, studentSql);
                if (!run.success) {
                  answer.points = 0;
                  answer.isCorrect = false;
                } else {
                  const expected = sqlQuestion.expectedOutputHash;
                  const match =
                    run.outputHash === expected ||
                    (run.outputHashSet && run.outputHashSet === expected);
                  answer.isCorrect = match;
                  answer.points = match ? answer.maxPoints : 0;
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Error evaluating SQL question ${answer.questionId}:`, error);
          answer.points = 0;
          answer.isCorrect = false;
        }
      }
    }

    // Evaluate English questions on final submission
    for (let i = 0; i < result.answers.length; i++) {
      const answer = result.answers[i];

      if (answer.questionType === 'english_grammar' && answer.answer !== undefined && answer.answer !== null) {
        try {
          const grammarQ = await EnglishGrammarQuestion.findById(answer.questionId);
          if (grammarQ) {
            if (grammarQ.isSubjective && grammarQ.subType === 'sentence_correction' && typeof answer.answer === 'string') {
              const eval_ = await evaluateGrammarSubjective(grammarQ, answer.answer);
              answer.englishEvaluation = { grammarScore: eval_.grammarScore, detailedFeedback: eval_.detailedFeedback, suggestions: eval_.suggestions };
              answer.isCorrect = eval_.isCorrect;
              answer.points = Math.round(eval_.grammarScore * answer.maxPoints);
            } else if (grammarQ.subType === 'parajumble') {
              const correct = JSON.stringify(grammarQ.correctOrder) === JSON.stringify(answer.answer);
              answer.isCorrect = correct;
              answer.points = correct ? answer.maxPoints : 0;
            } else if ((grammarQ.subType === 'fill_in_blank' || (grammarQ.subType === 'sentence_correction' && !grammarQ.isSubjective)) && grammarQ.correctAnswer && typeof answer.answer === 'string') {
              const normalized = (s) => (s || '').trim().toLowerCase();
              const isCorrect = normalized(answer.answer) === normalized(grammarQ.correctAnswer);
              answer.isCorrect = isCorrect;
              answer.points = isCorrect ? answer.maxPoints : 0;
            } else if (grammarQ.options && grammarQ.options.length > 0) {
              const selectedIdx = parseInt(answer.answer, 10);
              const isCorrect = grammarQ.options[selectedIdx]?.isCorrect || false;
              answer.isCorrect = isCorrect;
              answer.points = isCorrect ? answer.maxPoints : 0;
            }
          }
        } catch (error) {
          console.error(`Error evaluating grammar ${answer.questionId}:`, error.message);
        }
      }

      if (answer.questionType === 'english_vocabulary' && answer.answer !== undefined && answer.answer !== null) {
        try {
          const vocabQ = await EnglishVocabularyQuestion.findById(answer.questionId);
          if (vocabQ) {
            const selectedIdx = parseInt(answer.answer);
            answer.isCorrect = vocabQ.options[selectedIdx]?.isCorrect || false;
            answer.points = answer.isCorrect ? answer.maxPoints : 0;
          }
        } catch (error) {
          console.error(`Error evaluating vocabulary ${answer.questionId}:`, error.message);
        }
      }

      if (answer.questionType === 'english_reading' && answer.answer) {
        try {
          const readingQ = await EnglishReadingQuestion.findById(answer.questionId);
          if (readingQ) {
            let totalPts = 0;
            const subAnswers = [];
            for (let sIdx = 0; sIdx < readingQ.questions.length; sIdx++) {
              const subQ = readingQ.questions[sIdx];
              const subAns = answer.answer[sIdx];
              if (subQ.questionType === 'mcq' || subQ.questionType === 'true_false') {
                const isCorrect = subQ.options[parseInt(subAns)]?.isCorrect || false;
                const pts = isCorrect ? (subQ.points || 5) : 0;
                totalPts += pts;
                subAnswers.push({ subQuestionIndex: sIdx, answer: subAns, isCorrect, points: pts, maxPoints: subQ.points || 5 });
              } else if ((subQ.questionType === 'short_answer' || subQ.questionType === 'inference') && subAns) {
                const eval_ = await evaluateReadingShortAnswer(readingQ.passage.content, subQ, subAns);
                const pts = Math.round(eval_.finalScore * (subQ.points || 5));
                totalPts += pts;
                subAnswers.push({
                  subQuestionIndex: sIdx,
                  answer: subAns,
                  isCorrect: eval_.finalScore >= 0.5,
                  points: pts,
                  maxPoints: subQ.points || 5,
                  feedback: eval_.detailedFeedback || null
                });
              }
            }
            answer.subAnswers = subAnswers;
            answer.points = totalPts;
          }
        } catch (error) {
          console.error(`Error evaluating reading ${answer.questionId}:`, error.message);
        }
      }

      if (answer.questionType === 'english_essay' && (answer.essayContent || answer.answer)) {
        try {
          const essayQ = await EnglishEssayQuestion.findById(answer.questionId);
          if (essayQ) {
            const content = answer.essayContent || answer.answer || '';
            const eval_ = await evaluateEssay(essayQ, content);

            let plagiarismResult = null;
            try {
              const otherResults = await Result.find({
                testId: result.testId,
                _id: { $ne: result._id },
                status: 'completed'
              }).select('answers');
              const otherEssays = otherResults.flatMap(r =>
                (r.answers || [])
                  .filter(a => a.questionId?.toString() === answer.questionId?.toString() && (a.essayContent || a.answer))
                  .map(a => a.essayContent || a.answer)
              );
              plagiarismResult = await checkPlagiarism(content, otherEssays);
            } catch (plagErr) {
              console.error('Plagiarism check error:', plagErr.message);
            }

            answer.englishEvaluation = {
              grammarScore: eval_.grammarScore, vocabularyScore: eval_.vocabularyScore, coherenceScore: eval_.coherenceScore,
              structureScore: eval_.structureScore, toneScore: eval_.toneScore, relevanceScore: eval_.relevanceScore,
              detailedFeedback: eval_.detailedFeedback, suggestions: eval_.suggestions,
              ...(plagiarismResult && {
                plagiarism: {
                  originalityScore: plagiarismResult.originalityScore,
                  suspicionLevel: plagiarismResult.suspicionLevel,
                  isLikelyOriginal: plagiarismResult.isLikelyOriginal,
                  indicators: plagiarismResult.indicators,
                  crossSubmissionSimilarity: plagiarismResult.crossSubmissionSimilarity,
                  feedback: plagiarismResult.feedback
                }
              })
            };
            answer.wordCount = eval_.wordCount;
            answer.points = Math.round(eval_.finalScore * answer.maxPoints);

            if (plagiarismResult && plagiarismResult.suspicionLevel === 'high') {
              answer.points = Math.round(answer.points * 0.5);
              answer.flagged = true;
            } else if (plagiarismResult && plagiarismResult.suspicionLevel === 'medium') {
              answer.points = Math.round(answer.points * 0.8);
              answer.flagged = true;
            }
          }
        } catch (error) {
          console.error(`Error evaluating essay ${answer.questionId}:`, error.message);
        }
      }

      if (answer.questionType === 'english_speaking' && answer.audioFileUrl) {
        try {
          const speakingQ = await EnglishSpeakingQuestion.findById(answer.questionId);
          if (speakingQ) {
            const eval_ = await evaluateSpeaking(answer.audioFileUrl, speakingQ);
            answer.englishEvaluation = {
              pronunciationScore: eval_.pronunciationScore, fluencyScore: eval_.fluencyScore,
              coherenceScore: eval_.coherenceScore, vocabularyScore: eval_.vocabularyScore, grammarScore: eval_.grammarScore,
              confidenceScore: eval_.confidenceScore, transcription: eval_.transcription,
              speakingRate: eval_.speakingRate, pauseAnalysis: eval_.pauseAnalysis,
              fillerWords: eval_.fillerWords, vocabularyDiversity: eval_.vocabularyDiversity,
              accentClarity: eval_.accentClarity, detailedFeedback: eval_.detailedFeedback
            };
            answer.points = Math.round(eval_.finalScore * answer.maxPoints);
          }
        } catch (error) {
          console.error(`Error evaluating speaking ${answer.questionId}:`, error.message);
        }
      }

      if (answer.questionType === 'english_listening' && answer.answer) {
        try {
          const listeningQ = await EnglishListeningQuestion.findById(answer.questionId);
          if (listeningQ) {
            let totalPts = 0;
            const subAnswers = [];
            for (let sIdx = 0; sIdx < listeningQ.questions.length; sIdx++) {
              const subQ = listeningQ.questions[sIdx];
              const subAns = answer.answer[sIdx];
              if (subQ.questionType === 'mcq' || subQ.questionType === 'true_false') {
                const isCorrect = subQ.options[parseInt(subAns)]?.isCorrect || false;
                const pts = isCorrect ? (subQ.points || 5) : 0;
                totalPts += pts;
                subAnswers.push({ subQuestionIndex: sIdx, answer: subAns, isCorrect, points: pts, maxPoints: subQ.points || 5 });
              } else if ((subQ.questionType === 'fill_in_blank' || subQ.questionType === 'short_answer') && subAns) {
                if (subQ.correctAnswer && subAns.toLowerCase().trim() === subQ.correctAnswer.toLowerCase().trim()) {
                  totalPts += subQ.points || 5;
                  subAnswers.push({ subQuestionIndex: sIdx, answer: subAns, isCorrect: true, points: subQ.points || 5, maxPoints: subQ.points || 5 });
                } else if (subQ.questionType === 'short_answer' && listeningQ.audioTranscript) {
                  const eval_ = await evaluateListeningShortAnswer(listeningQ.audioTranscript, subQ, subAns);
                  const pts = Math.round(eval_.finalScore * (subQ.points || 5));
                  totalPts += pts;
                  subAnswers.push({
                    subQuestionIndex: sIdx,
                    answer: subAns,
                    isCorrect: eval_.finalScore >= 0.5,
                    points: pts,
                    maxPoints: subQ.points || 5,
                    feedback: eval_.detailedFeedback || null
                  });
                } else {
                  subAnswers.push({ subQuestionIndex: sIdx, answer: subAns, isCorrect: false, points: 0, maxPoints: subQ.points || 5 });
                }
              }
            }
            answer.subAnswers = subAnswers;
            answer.points = totalPts;
          }
        } catch (error) {
          console.error(`Error evaluating listening ${answer.questionId}:`, error.message);
        }
      }
    }

    // Calculate section scores for English tests
    const test = await Test.findById(result.testId);
    if (test && test.type === 'english' && test.englishSections?.length) {
      const sectionScores = [];
      for (const section of test.englishSections) {
        const sectionQuestions = test.questions.filter(q => q.sectionId === section.sectionType);
        const sectionQIds = sectionQuestions.map(q => q.questionId.toString());
        const sectionAnswers = result.answers.filter(a => sectionQIds.includes(a.questionId.toString()));
        const score = sectionAnswers.reduce((sum, a) => sum + (a.points || 0), 0);
        const maxScore = sectionQuestions.reduce((sum, q) => sum + (q.points || 10), 0);
        sectionScores.push({
          sectionType: section.sectionType,
          score,
          maxScore,
          percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
        });
      }
      result.sectionScores = sectionScores;
    } else if (test && test.type !== 'english') {
      result.sectionScores = buildSectionScoresForStandardTest(test, result);
    }

    // Calculate total score
    result.totalScore = result.answers.reduce((sum, a) => sum + (a.points || 0), 0);
    result.percentage = (result.maxScore > 0)
      ? Math.round((result.totalScore / result.maxScore) * 100)
      : 0;
    result.submittedAt = new Date();
    result.timeSpent = Math.floor((result.submittedAt - result.startedAt) / 1000);
    result.status = 'completed';
    
    console.log(`✅ Test submitted: Score ${result.totalScore}/${result.maxScore} (${result.percentage}%)`);

    await result.save();

    // Update student enrollment status
    const student = await User.findById(req.user._id);
    const enrollment = student.enrolledTests.find(
      et => et.testId.toString() === result.testId.toString()
    );
    if (enrollment) {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
      await student.save();
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get result by test ID (for students)
router.get('/test/:testId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await Result.findOne({
      testId: req.params.testId,
      studentId: req.user._id,
      status: 'completed'
    })
      .populate('testId', 'title type')
      .populate('studentId', 'name email')
      .sort({ submittedAt: -1 }); // Get the most recent completed result

    if (!result) {
      return res.status(404).json({ message: 'Result not found for this test' });
    }

    const out = result.toObject();
    await attachStandardQuestionDetails(out);
    await ensureSectionScores(out);
    res.json(out);
  } catch (error) {
    console.error('❌ Error fetching result by test ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get question details for a result (MCQ/Aptitude)
router.get('/:resultId/questions', auth, async (req, res) => {
  try {
    const result = await Result.findById(req.params.resultId)
      .populate('testId', 'title type')
      .populate('studentId', 'name email');

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    if (req.user.role === 'student' && result.studentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'vendor_admin' && result.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const mcqIds = result.answers
      .filter(a => a.questionType === 'mcq' && a.questionId)
      .map(a => a.questionId);
    const aptitudeIds = result.answers
      .filter(a => a.questionType === 'aptitude' && a.questionId)
      .map(a => a.questionId);
    const theoryIds = result.answers
      .filter(a => a.questionType === 'theory' && a.questionId)
      .map(a => a.questionId);
    const sqlIds = result.answers
      .filter(a => a.questionType === 'sql' && a.questionId)
      .map(a => a.questionId);

    const questionMap = {};

    const mcqQuestions = await MCQQuestion.find({ _id: { $in: mcqIds } });
    mcqQuestions.forEach(q => {
      questionMap[q._id.toString()] = q.toObject();
    });

    const aptitudeQuestions = await AptitudeQuestion.find({ _id: { $in: aptitudeIds } });
    aptitudeQuestions.forEach(q => {
      questionMap[q._id.toString()] = q.toObject();
    });

    const theoryQuestions = await TheoryQuestion.find({ _id: { $in: theoryIds } })
      .populate('subjectId', 'name')
      .populate('topicId', 'name');
    theoryQuestions.forEach(q => {
      questionMap[q._id.toString()] = q.toObject();
    });

    const sqlQuestions = await SQLQuestion.find({ _id: { $in: sqlIds } }).select('text marks schemaSql expectedOutput');
    sqlQuestions.forEach(q => {
      questionMap[q._id.toString()] = q.toObject();
    });

    const codingIds = result.answers
      .filter(a => a.questionType === 'coding' && a.questionId)
      .map(a => a.questionId);
    const codingQuestions = await CodingQuestion.find({ _id: { $in: codingIds } });
    codingQuestions.forEach(q => {
      questionMap[q._id.toString()] = sanitizeCodingQuestionForStudent(q);
    });

    res.json(questionMap);
  } catch (error) {
    console.error('❌ Error fetching result question details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get result
router.get('/:resultId', auth, async (req, res) => {
  try {
    // Check if it's a test ID route (should be handled above, but just in case)
    if (req.params.resultId === 'test') {
      return res.status(400).json({ message: 'Invalid result ID' });
    }

    const result = await Result.findById(req.params.resultId)
      .populate('testId', 'title type')
      .populate('studentId', 'name email');

    if (!result) {
      console.log('❌ Result not found:', req.params.resultId);
      return res.status(404).json({ message: 'Result not found' });
    }

    // Check access
    if (req.user.role === 'student' && result.studentId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'vendor_admin' && result.vendorId.toString() !== req.user.vendorId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const out = result.toObject();

    if (out.testId?.type === 'english' && out.status === 'completed') {
      const ENGLISH_MODELS = {
        english_grammar: EnglishGrammarQuestion,
        english_vocabulary: EnglishVocabularyQuestion,
        english_reading: EnglishReadingQuestion,
        english_essay: EnglishEssayQuestion,
        english_speaking: EnglishSpeakingQuestion,
        english_listening: EnglishListeningQuestion
      };
      for (let i = 0; i < out.answers.length; i++) {
        const a = out.answers[i];
        const Model = ENGLISH_MODELS[a.questionType];
        if (Model && a.questionId) {
          try {
            const q = await Model.findById(a.questionId).lean();
            if (q) {
              out.answers[i].questionDetails = {
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                questionText: q.questionText,
                word: q.word,
                subType: q.subType,
                sampleResponse: q.sampleResponse,
                referenceAnswer: q.referenceAnswer,
                passage: q.passage,
                questions: q.questions
              };
            }
          } catch (err) {
            // ignore per-question fetch errors
          }
        }
      }
      const totalCompleted = await Result.countDocuments({
        testId: result.testId._id || result.testId,
        status: 'completed'
      });
      const scoredLower = await Result.countDocuments({
        testId: result.testId._id || result.testId,
        status: 'completed',
        percentage: { $lt: result.percentage }
      });
      out.percentile = totalCompleted > 0 ? Math.round((scoredLower / totalCompleted) * 100) : null;
    }

    if (out.status === 'completed' && out.testId?.type !== 'english') {
      await attachStandardQuestionDetails(out);
      await ensureSectionScores(out);
    }

    res.json(out);
  } catch (error) {
    console.error('❌ Error fetching result:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Practice a question from a completed result (visible test cases only, no solutions)
router.get('/:resultId/practice/:questionId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await Result.findOne({
      _id: req.params.resultId,
      studentId: req.user._id,
      status: 'completed',
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    const qid = req.params.questionId;
    const answer = result.answers.find(
      (a) => a.questionId && a.questionId.toString() === qid
    );

    if (!answer) {
      return res.status(404).json({ message: 'Question not part of this result' });
    }

    let question = null;
    if (answer.questionType === 'coding') {
      const row = await CodingQuestion.findById(qid);
      question = sanitizeCodingQuestionForStudent(row);
    } else if (answer.questionType === 'mcq') {
      question = await MCQQuestion.findById(qid).lean();
    } else if (answer.questionType === 'aptitude') {
      question = await AptitudeQuestion.findById(qid).lean();
    } else if (answer.questionType === 'theory') {
      question = await TheoryQuestion.findById(qid).lean();
    } else if (answer.questionType === 'sql') {
      question = await SQLQuestion.findById(qid).lean();
    }

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      questionType: answer.questionType,
      question,
      submittedAnswer: answer.answer,
      language: answer.language,
      points: answer.points,
      maxPoints: answer.maxPoints,
      testCasesPassed: answer.testCasesPassed,
      totalTestCases: answer.totalTestCases,
      isCorrect: answer.isCorrect,
    });
  } catch (error) {
    console.error('❌ Error fetching practice question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Track violation
router.post('/:resultId/violation', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await Result.findOne({
      _id: req.params.resultId,
      studentId: req.user._id,
      status: 'in_progress'
    });

    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }

    const { type, details } = req.body;

    result.violations.push({
      type: normalizeViolationType(type),
      details: details || '',
      timestamp: new Date()
    });

    result.violationCount = result.violations.length;

    // Auto-submit if max violations reached
    if (result.violationCount >= MAX_VIOLATIONS) {
      // Calculate final score
      result.totalScore = result.answers.reduce((sum, a) => sum + (a.points || 0), 0);
      result.percentage = Math.round((result.totalScore / result.maxScore) * 100);
      result.submittedAt = new Date();
      result.timeSpent = Math.floor((result.submittedAt - result.startedAt) / 1000);
      result.status = 'completed';
      result.autoSubmitted = true;

      // Update student enrollment status
      const student = await User.findById(req.user._id);
      const enrollment = student.enrolledTests.find(
        et => et.testId.toString() === result.testId.toString()
      );
      if (enrollment) {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
        await student.save();
      }
    }

    await result.save();

    res.json({
      violationCount: result.violationCount,
      maxViolations: MAX_VIOLATIONS,
      autoSubmitted: result.autoSubmitted,
      status: result.status
    });
  } catch (error) {
    console.error('❌ Error tracking violation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get student results
router.get('/student/:studentId', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware
], async (req, res) => {
  try {
    const results = await Result.find({
      studentId: req.params.studentId,
      vendorId: req.vendorId
    })
      .populate('testId', 'title type')
      .sort({ submittedAt: -1 });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Manual score update for theory answers
router.patch('/:resultId/answers/:answerId/manual-score', [
  auth,
  authorize('vendor_admin'),
  tenantMiddleware
], async (req, res) => {
  try {
    const { score, feedback } = req.body;
    const result = await Result.findOne({
      _id: req.params.resultId,
      vendorId: req.vendorId
    });
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }
    const answer = result.answers.id(req.params.answerId);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }
    const manualScorable = ['theory', 'english_grammar', 'english_reading', 'english_essay', 'english_speaking', 'english_listening'];
    if (!manualScorable.includes(answer.questionType)) {
      return res.status(400).json({ message: 'Manual scoring not supported for this question type' });
    }

    const manualScore = Math.max(0, Math.min(Number(score), answer.maxPoints));
    answer.points = manualScore;
    answer.manualOverride = {
      isManual: true,
      score: manualScore,
      feedback: feedback || '',
      updatedBy: req.user._id,
      updatedAt: new Date()
    };

    result.totalScore = result.answers.reduce((sum, a) => sum + (a.points || 0), 0);
    result.percentage = Math.round((result.totalScore / result.maxScore) * 100);

    await result.save();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload speaking audio for a result
router.post('/:resultId/upload-audio', auth, uploadSpeaking.single('audio'), async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ message: 'Access denied' });

    const result = await Result.findOne({ _id: req.params.resultId, studentId: req.user._id });
    if (!result) return res.status(404).json({ message: 'Result not found' });
    if (!req.file) return res.status(400).json({ message: 'No audio file uploaded' });

    const { questionId } = req.body;
    if (!questionId) return res.status(400).json({ message: 'questionId is required' });

    const answerIndex = result.answers.findIndex(a => a.questionId.toString() === questionId);
    if (answerIndex === -1) return res.status(400).json({ message: 'Question not found in test' });

    const filename = `${Date.now()}-${req.file.originalname}`;
    const r2Key = `uploads/speaking/${req.params.resultId}/${filename}`;
    console.log(`📤 Uploading speaking audio to R2: ${r2Key} (${req.file.size} bytes)`);
    const audioUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    console.log(`✅ Speaking audio uploaded: ${audioUrl}`);

    result.answers[answerIndex].audioFileUrl = audioUrl;
    result.answers[answerIndex].answer = audioUrl;
    await result.save();

    res.json({ audioUrl, message: 'Audio uploaded successfully' });
  } catch (error) {
    console.error('❌ Speaking audio upload error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

