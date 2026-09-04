/** Normalize student profile from a course enrollment row. */
export function getEnrollmentStudent(enrollment) {
  if (!enrollment) return null;
  if (enrollment.studentId && typeof enrollment.studentId === 'object') {
    return enrollment.studentId;
  }
  if (enrollment.student && typeof enrollment.student === 'object') {
    return enrollment.student;
  }
  return {
    _id: enrollment.studentId,
    name: enrollment.studentName || 'Student',
    email: enrollment.studentEmail || '',
  };
}

export function getStudentRecordId(student) {
  if (!student) return '';
  return String(student._id || student.id || '');
}
