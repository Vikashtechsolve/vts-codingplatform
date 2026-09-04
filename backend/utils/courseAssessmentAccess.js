const mongoose = require('mongoose');
const CourseModule = require('../models/CourseModule');
const CourseEnrollment = require('../models/CourseEnrollment');
const User = require('../models/User');
const { moduleAssessmentRef } = require('./moduleAssessment');

/**
 * Resolve course module context when student starts an assessment with courseId/moduleId.
 */
async function resolveCourseModuleAssessment(req, assessmentType, assessmentId) {
  const courseId = req.body?.courseId || req.query?.courseId;
  const moduleId = req.body?.moduleId || req.query?.moduleId;
  if (
    !courseId ||
    !moduleId ||
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(moduleId) ||
    !mongoose.Types.ObjectId.isValid(assessmentId)
  ) {
    return null;
  }

  const mod = await CourseModule.findOne({ _id: moduleId, courseId }).lean();
  if (!mod) return null;

  const ref = moduleAssessmentRef(mod);
  if (!ref || ref.type !== assessmentType || String(ref.id) !== String(assessmentId)) {
    return null;
  }

  const enroll = await CourseEnrollment.findOne({
    courseId,
    studentId: req.user._id,
    vendorId: req.vendorId || req.user.vendorId,
    status: 'active',
  }).select('_id');

  if (!enroll) return null;

  return { courseId, moduleId, enrollmentId: enroll._id };
}

async function ensureStudentEnrollmentForCourseAssessment(student, ctx, assessmentType, assessmentDoc) {
  if (!ctx || !student || !assessmentDoc) return;

  const vendorId = student.vendorId;
  const assessmentId = assessmentDoc._id;

  if (assessmentType === 'test') {
    const exists = student.enrolledTests.some(
      (e) => e.testId && String(e.testId) === String(assessmentId)
    );
    if (!exists) {
      student.enrolledTests.push({ testId: assessmentId, status: 'assigned', origin: 'course' });
    }
  } else if (assessmentType === 'interview') {
    const exists = student.enrolledInterviews.some(
      (e) => e.interviewId && String(e.interviewId) === String(assessmentId)
    );
    if (!exists) {
      student.enrolledInterviews.push({
        interviewId: assessmentId,
        status: 'assigned',
        origin: 'course',
      });
    }
  } else if (assessmentType === 'assignment') {
    const exists = student.enrolledAssignments.some(
      (e) => e.assignmentId && String(e.assignmentId) === String(assessmentId)
    );
    if (!exists) {
      student.enrolledAssignments.push({
        assignmentId: assessmentId,
        status: 'assigned',
        origin: 'course',
        assignedAt: new Date(),
        deadline: assessmentDoc.deadline || null,
      });
    }
  }
  // System design uses submission doc per attempt — no enrolled list required.

  await student.save();
}

module.exports = {
  resolveCourseModuleAssessment,
  ensureStudentEnrollmentForCourseAssessment,
};
