const mongoose = require('mongoose');
const Course = require('../models/Course');
const CourseVendorAllocation = require('../models/CourseVendorAllocation');
const User = require('../models/User');
const Classroom = require('../models/Classroom');
const { ensureSelfAllocation } = require('./vendorCourseCms');

async function getActiveAllocation(courseId, vendorId) {
  return CourseVendorAllocation.findOne({
    courseId,
    vendorId,
    isActive: true,
  });
}

async function assertVendorCourseAccess(courseId, vendorId, userId) {
  const course = await Course.findById(courseId).select('source vendorId status').lean();
  if (!course) {
    return { ok: false, status: 404, message: 'Course not found' };
  }

  const owned =
    course.source === 'vendor' && String(course.vendorId) === String(vendorId);
  let alloc = await getActiveAllocation(courseId, vendorId);

  if (owned && !alloc) {
    await ensureSelfAllocation(course, userId);
    alloc = await getActiveAllocation(courseId, vendorId);
  }

  if (!owned && !alloc) {
    return { ok: false, status: 404, message: 'Course not allocated' };
  }
  if (!owned && course.status !== 'published') {
    return { ok: false, status: 404, message: 'Course not found' };
  }
  // Callers dereference alloc (save, assignedStudentIds) — never return ok without it
  if (!alloc) {
    return { ok: false, status: 500, message: 'Course allocation could not be resolved' };
  }

  return { ok: true, course, owned, alloc };
}

/**
 * Resolve students for course assignment — includes classroom members even if vendorId
 * was not set on the user yet (backfills vendorId).
 */
async function resolveAssignableStudents(vendorId, { studentIds = [], classroomIds = [] } = {}) {
  const idSet = new Set(
    (studentIds || [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map(String)
  );

  const validClassroomIds = (classroomIds || []).filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );

  if (validClassroomIds.length) {
    const classrooms = await Classroom.find({
      _id: { $in: validClassroomIds },
      vendorId,
    })
      .select('students')
      .lean();

    for (const room of classrooms) {
      for (const sid of room.students || []) {
        idSet.add(String(sid));
      }
    }
  }

  if (!idSet.size) return [];

  const users = await User.find({
    _id: { $in: [...idSet] },
    role: 'student',
  })
    .select('_id name email enrollmentNumber vendorId')
    .lean();

  const classroomMemberIds = new Set();
  if (validClassroomIds.length) {
    const memberRooms = await Classroom.find({
      vendorId,
      students: { $in: users.map((u) => u._id) },
    })
      .select('students')
      .lean();
    for (const room of memberRooms) {
      for (const sid of room.students || []) {
        classroomMemberIds.add(String(sid));
      }
    }
  }

  const resolved = [];
  const backfillIds = [];

  for (const user of users) {
    const uid = String(user._id);
    const hasVendor = user.vendorId && String(user.vendorId) === String(vendorId);
    const inClassroom = classroomMemberIds.has(uid);
    if (!hasVendor && !inClassroom) continue;
    resolved.push(user);
    if (!hasVendor) backfillIds.push(user._id);
  }

  if (backfillIds.length) {
    await User.updateMany(
      { _id: { $in: backfillIds }, vendorId: { $in: [null, undefined] } },
      { $set: { vendorId } }
    );
  }

  return resolved;
}

async function attachStudentProfiles(enrollments) {
  if (!enrollments?.length) return [];

  const studentIds = enrollments
    .map((e) => e.studentId)
    .filter(Boolean)
    .map((id) => (typeof id === 'object' && id._id ? id._id : id));

  const users = await User.find({ _id: { $in: studentIds } })
    .select('name email enrollmentNumber isActive')
    .lean();
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  return enrollments.map((e) => {
    const rawId =
      typeof e.studentId === 'object' && e.studentId?._id ? e.studentId._id : e.studentId;
    const profile = userMap.get(String(rawId)) || null;
    return {
      ...e,
      studentId: profile
        ? {
            _id: profile._id,
            name: profile.name,
            email: profile.email,
            enrollmentNumber: profile.enrollmentNumber || '',
            isActive: profile.isActive,
          }
        : {
            _id: rawId,
            name: 'Unknown student',
            email: '',
            enrollmentNumber: '',
          },
    };
  });
}

module.exports = {
  getActiveAllocation,
  assertVendorCourseAccess,
  resolveAssignableStudents,
  attachStudentProfiles,
};
