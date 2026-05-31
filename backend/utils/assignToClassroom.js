const Classroom = require('../models/Classroom');
const User = require('../models/User');

/**
 * Enroll students in a test (skips already enrolled).
 */
async function enrollStudentsInTest(testId, studentIds, vendorId) {
  const assigned = [];
  const seen = new Set();

  for (const studentId of studentIds) {
    const id = studentId?.toString?.() || String(studentId);
    if (seen.has(id)) continue;
    seen.add(id);

    const student = await User.findOne({
      _id: id,
      vendorId,
      role: 'student',
    });
    if (!student) continue;

    const alreadyAssigned = student.enrolledTests.some(
      (et) => et.testId.toString() === testId.toString()
    );
    if (!alreadyAssigned) {
      student.enrolledTests.push({
        testId,
        assignedAt: new Date(),
        status: 'assigned',
      });
      await student.save();
      assigned.push(id);
    }
  }

  return assigned;
}

/**
 * Enroll students in an interview (skips already enrolled).
 */
async function enrollStudentsInInterview(interviewId, studentIds, vendorId) {
  const assigned = [];
  const seen = new Set();

  for (const studentId of studentIds) {
    const id = studentId?.toString?.() || String(studentId);
    if (seen.has(id)) continue;
    seen.add(id);

    const student = await User.findOne({
      _id: id,
      vendorId,
      role: 'student',
    });
    if (!student) continue;

    const alreadyAssigned = (student.enrolledInterviews || []).some(
      (ei) => (ei.interviewId || ei).toString() === interviewId.toString()
    );
    if (!alreadyAssigned) {
      student.enrolledInterviews = student.enrolledInterviews || [];
      student.enrolledInterviews.push({
        interviewId,
        assignedAt: new Date(),
        status: 'assigned',
      });
      await student.save();
      assigned.push(id);
    }
  }

  return assigned;
}

/**
 * Link test on classroom record and enroll all classroom students.
 */
async function assignTestToClassrooms(testId, classroomIds, vendorId, assignedBy) {
  let enrolledCount = 0;
  const classroomsUpdated = [];

  for (const classroomId of classroomIds) {
    const classroom = await Classroom.findOne({ _id: classroomId, vendorId });
    if (!classroom) continue;

    const alreadyOnClassroom = classroom.assignedTests.some(
      (at) => at.testId.toString() === testId.toString()
    );
    if (!alreadyOnClassroom) {
      classroom.assignedTests.push({
        testId,
        assignedAt: new Date(),
        assignedBy,
      });
      await classroom.save();
      classroomsUpdated.push(classroom._id);
    }

    const studentIds = (classroom.students || []).map((s) => s.toString());
    const assigned = await enrollStudentsInTest(testId, studentIds, vendorId);
    enrolledCount += assigned.length;
  }

  return { enrolledCount, classroomsUpdated };
}

/**
 * Link interview on classroom record and enroll all classroom students.
 */
async function assignInterviewToClassrooms(interviewId, classroomIds, vendorId, assignedBy) {
  let enrolledCount = 0;
  const classroomsUpdated = [];

  for (const classroomId of classroomIds) {
    const classroom = await Classroom.findOne({ _id: classroomId, vendorId });
    if (!classroom) continue;

    classroom.assignedInterviews = classroom.assignedInterviews || [];
    const alreadyOnClassroom = classroom.assignedInterviews.some(
      (ai) => (ai.interviewId || ai).toString() === interviewId.toString()
    );
    if (!alreadyOnClassroom) {
      classroom.assignedInterviews.push({
        interviewId,
        assignedAt: new Date(),
        assignedBy,
      });
      await classroom.save();
      classroomsUpdated.push(classroom._id);
    }

    const studentIds = (classroom.students || []).map((s) => s.toString());
    const assigned = await enrollStudentsInInterview(interviewId, studentIds, vendorId);
    enrolledCount += assigned.length;
  }

  return { enrolledCount, classroomsUpdated };
}

module.exports = {
  enrollStudentsInTest,
  enrollStudentsInInterview,
  assignTestToClassrooms,
  assignInterviewToClassrooms,
};
