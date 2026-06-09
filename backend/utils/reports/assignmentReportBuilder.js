const User = require('../../models/User');
const ProjectSubmission = require('../../models/ProjectSubmission');
const EvaluationResult = require('../../models/EvaluationResult');
const { formatDate, formatBool, truncate, safeNum } = require('./formatters');

async function fetchEnrolledStudents(assignmentId, vendorId, studentIds) {
  if (studentIds?.length) {
    return User.find({ _id: { $in: studentIds }, role: 'student' }).select('name email enrolledAssignments');
  }
  return User.find({
    vendorId,
    role: 'student',
    'enrolledAssignments.assignmentId': assignmentId,
  }).select('name email enrolledAssignments');
}

function getEnrollment(student, assignmentId) {
  return (student.enrolledAssignments || []).find(
    (e) => e.assignmentId && e.assignmentId.toString() === assignmentId.toString()
  );
}

async function buildAssignmentReport(assignment, vendorId, options = {}) {
  const { studentIds, participantMap: pMap } = options;
  const assignmentId = assignment._id;
  const submissionQuery = { assignmentId, vendorId };
  if (studentIds?.length) {
    submissionQuery.studentId = { $in: studentIds };
  }
  const [students, submissions] = await Promise.all([
    fetchEnrolledStudents(assignmentId, vendorId, studentIds),
    ProjectSubmission.find(submissionQuery)
      .populate('studentId', 'name email')
      .lean(),
  ]);

  const submissionIds = submissions.map((s) => s._id);
  const evaluations = await EvaluationResult.find({
    submissionId: { $in: submissionIds },
  }).lean();
  const evalBySubmission = new Map(
    evaluations.map((e) => [e.submissionId.toString(), e])
  );

  const submissionByStudent = new Map();
  submissions.forEach((s) => {
    const sid = (s.studentId?._id || s.studentId)?.toString();
    if (sid) submissionByStudent.set(sid, s);
  });

  const summaryRows = [];
  const detailRows = [];

  const pct = (cat) => (cat?.percentage != null ? safeNum(cat.percentage, 1) : '');

  students.forEach((student) => {
    const sid = student._id.toString();
    const enrollment = getEnrollment(student, assignmentId);
    const participant = pMap?.get(sid);
    const submission = submissionByStudent.get(sid);
    const evaluation = submission
      ? evalBySubmission.get(submission._id.toString())
      : null;

    summaryRows.push({
      studentName: student.name || '',
      studentEmail: student.email || '',
      enrollmentStatus: enrollment?.status || participant?.status || 'registered',
      submissionStatus: submission?.status || 'not_submitted',
      submittedAt: formatDate(submission?.submittedAt),
      isLateSubmission: formatBool(submission?.isLateSubmission),
      repositoryUrl: submission?.githubRepoUrl || submission?.liveUrl || '',
      totalScore: evaluation?.totalScore ?? '',
      totalPossibleScore: evaluation?.totalPossibleScore ?? '',
      percentage: evaluation?.percentage != null ? safeNum(evaluation.percentage, 1) : '',
      grade: evaluation?.grade || '',
      featureCompletionPct: pct(evaluation?.categoryScores?.featureCompletion),
      codeQualityPct: pct(evaluation?.categoryScores?.codeQuality),
      architecturePct: pct(evaluation?.categoryScores?.architecture),
    });

    if (evaluation?.featureEvaluation?.length) {
      evaluation.featureEvaluation.forEach((feat) => {
        detailRows.push({
          studentName: student.name || '',
          studentEmail: student.email || '',
          featureName: feat.feature || '',
          featureStatus: feat.status || '',
          featureScore: feat.scoredMarks ?? '',
          featureMaxScore: feat.expectedMarks ?? '',
          featureFeedback: truncate(feat.aiAnalysis, 500),
        });
      });
    }
  });

  return {
    meta: {
      title: assignment.title,
      totalMarks: assignment.totalMarks,
      totalEnrolled: students.length,
      totalSubmissions: submissions.length,
      generatedAt: new Date(),
    },
    summaryRows,
    detailRows,
    sectionRows: [],
  };
}

module.exports = { buildAssignmentReport };
