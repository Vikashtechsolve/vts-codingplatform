const User = require('../../models/User');
const InterviewSession = require('../../models/InterviewSession');
const { formatDate, formatMinutes, truncate, safeNum } = require('./formatters');
const { studentReportFields } = require('../studentEnrollment');

async function fetchEnrolledStudents(interviewId, vendorId, studentIds) {
  if (studentIds?.length) {
    return User.find({ _id: { $in: studentIds }, role: 'student' }).select('name email enrollmentNumber enrolledInterviews');
  }
  return User.find({
    vendorId,
    role: 'student',
    'enrolledInterviews.interviewId': interviewId,
  }).select('name email enrollmentNumber enrolledInterviews');
}

function getEnrollment(student, interviewId) {
  return (student.enrolledInterviews || []).find(
    (e) => e.interviewId && e.interviewId.toString() === interviewId.toString()
  );
}

function pickLatestSession(sessionsByStudent, studentId) {
  const list = sessionsByStudent.get(studentId) || [];
  if (!list.length) return null;
  return list.sort((a, b) => {
    const ta = new Date(a.submittedAt || a.startedAt || 0).getTime();
    const tb = new Date(b.submittedAt || b.startedAt || 0).getTime();
    return tb - ta;
  })[0];
}

async function buildInterviewReport(interview, vendorId, options = {}) {
  const { studentIds, participantMap: pMap } = options;
  const interviewId = interview._id;
  const sessionQuery = { interviewId, vendorId };
  if (studentIds?.length) {
    sessionQuery.studentId = { $in: studentIds };
  }
  const [students, sessions] = await Promise.all([
    fetchEnrolledStudents(interviewId, vendorId, studentIds),
    InterviewSession.find(sessionQuery)
      .populate('studentId', 'name email enrollmentNumber')
      .lean(),
  ]);

  const sessionsByStudent = new Map();
  sessions.forEach((s) => {
    const sid = (s.studentId?._id || s.studentId)?.toString();
    if (!sid) return;
    if (!sessionsByStudent.has(sid)) sessionsByStudent.set(sid, []);
    sessionsByStudent.get(sid).push(s);
  });

  const summaryRows = [];
  const detailRows = [];

  students.forEach((student) => {
    const sid = student._id.toString();
    const enrollment = getEnrollment(student, interviewId);
    const participant = pMap?.get(sid);
    const session = pickLatestSession(sessionsByStudent, sid);

    const fb = session?.finalFeedback || {};
    summaryRows.push({
      ...studentReportFields(student),
      enrollmentStatus: enrollment?.status || participant?.status || 'registered',
      attemptStatus: session?.status || 'not_started',
      startedAt: formatDate(session?.startedAt),
      submittedAt: formatDate(session?.submittedAt),
      timeSpentMinutes: formatMinutes(session?.timeSpent),
      overallScore: session?.overallScore ?? '',
      readinessPercent: session?.readinessPercent ?? '',
      finalFeedbackSummary: truncate(
        [fb.summary, ...(fb.strengths || []).slice(0, 2), ...(fb.improvements || []).slice(0, 2)]
          .filter(Boolean)
          .join(' | '),
        600
      ),
    });

    if (session?.answers?.length) {
      session.answers.forEach((ans, idx) => {
        const ev = ans.evaluation || {};
        detailRows.push({
          ...studentReportFields(student),
          questionIndex: idx + 1,
          questionText: truncate(ans.questionText, 300),
          transcript: truncate(ans.transcript, 800),
          correctness: safeNum(ev.correctness),
          depth: safeNum(ev.depth),
          structure: safeNum(ev.structure),
          confidence: safeNum(ev.confidence),
          relevance: safeNum(ev.relevance),
          overall: safeNum(ev.overall),
          answerFeedback: truncate(ev.feedback, 500),
        });
      });
    }
  });

  return {
    meta: {
      title: interview.title,
      type: interview.interviewType,
      topic: interview.topic,
      difficulty: interview.difficulty,
      totalEnrolled: students.length,
      totalSessions: sessions.length,
      generatedAt: new Date(),
    },
    summaryRows,
    detailRows,
    sectionRows: [],
  };
}

module.exports = { buildInterviewReport };
