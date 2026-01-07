const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Result = require('../models/Result');
const Test = require('../models/Test');
const User = require('../models/User');
const MCQQuestion = require('../models/MCQQuestion');

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

    // Calculate points (for MCQ, check correctness; for coding, use test cases)
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

    // Re-evaluate all MCQ answers before final submission
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

module.exports = router;

