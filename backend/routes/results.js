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
const { evaluateTheoryAnswer } = require('../utils/aiEvaluation');

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

    // Check if result already exists (in_progress or completed)
    let result = await Result.findOne({
      testId: test._id,
      studentId: req.user._id
    });

    if (result) {
      if (result.status === 'completed') {
        console.log('⚠️  Test already completed');
        return res.status(400).json({ 
          message: 'Test already completed',
          resultId: result._id 
        });
      }
      console.log('✅ Returning existing in-progress result');
      return res.json(result);
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

    const { questionId, answer, language, testCasesPassed, totalTestCases } = req.body;

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
    } else {
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
      return res.status(400).json({ message: 'Test already submitted' });
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
    }

    // Calculate total score
    result.totalScore = result.answers.reduce((sum, a) => sum + (a.points || 0), 0);
    result.percentage = Math.round((result.totalScore / result.maxScore) * 100);
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

    res.json(result);
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

    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching result:', error);
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
    const MAX_VIOLATIONS = parseInt(process.env.MAX_VIOLATIONS || '3', 10);

    // Add violation
    result.violations.push({
      type,
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
    if (answer.questionType !== 'theory') {
      return res.status(400).json({ message: 'Manual scoring only supported for theory answers' });
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

module.exports = router;

