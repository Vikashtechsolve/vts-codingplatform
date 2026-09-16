const StudentPracticeProfile = require('../../models/StudentPracticeProfile');
const User = require('../../models/User');

async function getLeaderboard({ vendorId, classroomId, limit = 50 }) {
  let studentIds = null;
  if (classroomId) {
    const students = await User.find({
      vendorId,
      role: 'student',
      classrooms: classroomId,
    })
      .select('_id')
      .lean();
    studentIds = students.map((s) => s._id);
    if (!studentIds.length) return [];
  }

  const filter = { vendorId };
  if (studentIds) filter.studentId = { $in: studentIds };

  const rows = await StudentPracticeProfile.find(filter)
    .sort({ codingScore: -1, problemsSolved: -1, successRate: -1 })
    .limit(Math.min(limit, 100))
    .populate('studentId', 'name email')
    .lean();

  return rows.map((row, idx) => ({
    rank: idx + 1,
    studentId: row.studentId?._id || row.studentId,
    name: row.studentId?.name || 'Student',
    codingScore: row.codingScore || 0,
    problemsSolved: row.problemsSolved || 0,
    successRate: row.successRate || 0,
    streak: row.streak?.current || 0,
  }));
}

async function getPercentile(studentId, vendorId) {
  const profiles = await StudentPracticeProfile.find({ vendorId })
    .select('studentId codingScore')
    .sort({ codingScore: -1 })
    .lean();

  if (!profiles.length) return null;
  const idx = profiles.findIndex((p) => String(p.studentId) === String(studentId));
  if (idx < 0) return null;
  const percentile = Math.round(((profiles.length - idx) / profiles.length) * 100);
  return { rank: idx + 1, total: profiles.length, percentile };
}

module.exports = {
  getLeaderboard,
  getPercentile,
};
