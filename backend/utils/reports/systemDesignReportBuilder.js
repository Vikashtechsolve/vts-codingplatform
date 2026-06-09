const User = require('../../models/User');
const SystemDesignSubmission = require('../../models/SystemDesignSubmission');
const { formatDate, formatMinutes, truncate, safeNum } = require('./formatters');

const SECTION_KEYS = [
  'requirements',
  'capacityEstimation',
  'coreEntities',
  'apiDesign',
  'architecture',
  'dataFlow',
  'databaseDesign',
  'scalingStrategy',
  'deepDive',
  'tradeoffs',
];

const SECTION_LABELS = {
  requirements: 'Requirements',
  capacityEstimation: 'Capacity Estimation',
  coreEntities: 'Core Entities',
  apiDesign: 'API Design',
  architecture: 'Architecture',
  dataFlow: 'Data Flow',
  databaseDesign: 'Database Design',
  scalingStrategy: 'Scaling Strategy',
  deepDive: 'Deep Dive',
  tradeoffs: 'Tradeoffs',
};

async function fetchAssignedStudents(problem, vendorId) {
  const ids = new Set((problem.assignedTo || []).map((id) => id.toString()));

  if (problem.assignedClassrooms?.length) {
    const Classroom = require('../../models/Classroom');
    const classrooms = await Classroom.find({
      _id: { $in: problem.assignedClassrooms },
      vendorId,
    }).select('students');
    classrooms.forEach((c) => {
      (c.students || []).forEach((sid) => ids.add(sid.toString()));
    });
  }

  if (!ids.size) return [];

  return User.find({
    _id: { $in: [...ids] },
    vendorId,
    role: 'student',
  }).select('name email');
}

async function buildSystemDesignReport(problem, vendorId, options = {}) {
  const { studentIds, participantMap: pMap } = options;
  const problemId = problem._id;
  const submissionQuery = { problemId, vendorId };
  if (studentIds?.length) {
    submissionQuery.studentId = { $in: studentIds };
  }
  const students = studentIds?.length
    ? await User.find({ _id: { $in: studentIds }, role: 'student' }).select('name email')
    : await fetchAssignedStudents(problem, vendorId);
  const submissions = await SystemDesignSubmission.find(submissionQuery)
    .populate('studentId', 'name email')
    .lean();

  const submissionByStudent = new Map();
  submissions.forEach((s) => {
    const sid = (s.studentId?._id || s.studentId)?.toString();
    if (sid) submissionByStudent.set(sid, s);
  });

  const summaryRows = [];
  const detailRows = [];

  students.forEach((student) => {
    const sid = student._id.toString();
    const submission = submissionByStudent.get(sid);
    const participant = pMap?.get(sid);
    const isAssigned = (problem.assignedTo || []).some(
      (id) => id.toString() === sid
    );

    summaryRows.push({
      studentName: student.name || '',
      studentEmail: student.email || '',
      assignmentStatus: isAssigned ? 'assigned' : (participant ? 'contest' : 'classroom'),
      submissionStatus: submission?.status || 'not_started',
      startedAt: formatDate(submission?.startedAt),
      submittedAt: formatDate(submission?.submittedAt),
      timeSpentMinutes: formatMinutes(submission?.timeSpent),
      totalScore: submission?.totalScore ?? '',
      maxScore: submission?.maxScore ?? '',
      percentage: submission?.percentage != null ? safeNum(submission.percentage, 1) : '',
      hintsUsedCount: submission?.hintsUsed?.length ?? 0,
      violationsCount: submission?.violations?.length ?? 0,
    });

    if (submission?.evaluation) {
      SECTION_KEYS.forEach((key) => {
        const sec = submission.evaluation[key];
        if (!sec) return;
        detailRows.push({
          studentName: student.name || '',
          studentEmail: student.email || '',
          sectionName: SECTION_LABELS[key] || key,
          sectionScore: sec.score ?? '',
          sectionMaxScore: sec.maxScore ?? '',
          sectionFeedback: truncate(
            [sec.feedback, ...(sec.strengths || []), ...(sec.improvements || [])]
              .filter(Boolean)
              .join(' | '),
            500
          ),
        });
      });
    }
  });

  return {
    meta: {
      title: problem.title,
      totalEnrolled: students.length,
      totalSubmissions: submissions.length,
      generatedAt: new Date(),
    },
    summaryRows,
    detailRows,
    sectionRows: [],
  };
}

module.exports = { buildSystemDesignReport };
