const CodingQuestion = require('../../models/CodingQuestion');
const PracticeSubmission = require('../../models/PracticeSubmission');
const Vendor = require('../../models/Vendor');
const { runCodeBatch, deriveSubmissionStatus } = require('./runCodeBatch');
const { updateProfileAfterSubmission } = require('./practiceStatsService');

async function submitPracticeSolution({
  studentId,
  vendorId,
  questionId,
  code,
  language,
  timeSpentMs = 0,
}) {
  const question = await CodingQuestion.findOne({
    _id: questionId,
    isGlobal: true,
    practiceEnabled: true,
  });

  if (!question) {
    throw new Error('Practice question not found');
  }

  const vendor = await Vendor.findById(vendorId).select('settings.practice').lean();
  if (vendor?.settings?.practice?.enabled === false) {
    throw new Error('Practice is disabled for your organization');
  }

  const testCases = (question.testCases || []).map((tc) => ({
    input: tc.input,
    expectedOutput: tc.expectedOutput,
  }));

  if (!testCases.length) {
    throw new Error('Question has no test cases');
  }

  const batchResult = await runCodeBatch({ code, language, testCases });
  const status = deriveSubmissionStatus(batchResult);
  const passedTests = batchResult?.testCasesPassed ?? 0;
  const totalTests = batchResult?.total ?? testCases.length;
  const score = totalTests ? Math.round((passedTests / totalTests) * 100) : 0;

  const priorCount = await PracticeSubmission.countDocuments({ studentId, questionId });
  const hadAccepted = await PracticeSubmission.exists({
    studentId,
    questionId,
    status: 'accepted',
  });

  const submission = await PracticeSubmission.create({
    studentId,
    vendorId,
    questionId,
    code,
    language,
    status,
    passedTests,
    totalTests,
    score,
    timeSpentMs,
    attemptNumber: priorCount + 1,
    isFirstSolve: status === 'accepted' && !hadAccepted,
    source: 'practice',
  });

  const isNewSolve = submission.isFirstSolve;
  const isNewAttempt = priorCount === 0;

  const profile = await updateProfileAfterSubmission({
    studentId,
    vendorId,
    question,
    submission,
    isNewSolve,
    isNewAttempt,
  });

  return {
    submission,
    batchResult,
    profile,
    accepted: status === 'accepted',
  };
}

module.exports = {
  submitPracticeSolution,
};
