/**
 * Create 10 demo students, enroll them in "Demo classroom",
 * and allocate all vendor tests / interviews / assignments / system-design
 * problems to that classroom.
 *
 * Usage:
 *   node scripts/seedDemoClassroomStudents.js
 */
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Classroom = require('../models/Classroom');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');

const VENDOR_ADMIN_EMAIL = 'sales@skilltrixa.com';
const CLASSROOM_NAME = 'Demo classroom';
const PASSWORD = 'student123';

const DEMO_STUDENTS = [
  { name: 'Aarav Sharma', email: 'demo.student01@skilltrixa.com', enrollmentNumber: 'DEMO001' },
  { name: 'Diya Patel', email: 'demo.student02@skilltrixa.com', enrollmentNumber: 'DEMO002' },
  { name: 'Kabir Mehta', email: 'demo.student03@skilltrixa.com', enrollmentNumber: 'DEMO003' },
  { name: 'Ananya Reddy', email: 'demo.student04@skilltrixa.com', enrollmentNumber: 'DEMO004' },
  { name: 'Rohan Iyer', email: 'demo.student05@skilltrixa.com', enrollmentNumber: 'DEMO005' },
  { name: 'Ishita Nair', email: 'demo.student06@skilltrixa.com', enrollmentNumber: 'DEMO006' },
  { name: 'Vivaan Gupta', email: 'demo.student07@skilltrixa.com', enrollmentNumber: 'DEMO007' },
  { name: 'Meera Joshi', email: 'demo.student08@skilltrixa.com', enrollmentNumber: 'DEMO008' },
  { name: 'Arjun Singh', email: 'demo.student09@skilltrixa.com', enrollmentNumber: 'DEMO009' },
  { name: 'Priya Desai', email: 'demo.student10@skilltrixa.com', enrollmentNumber: 'DEMO010' },
];

function idStr(value) {
  return value?.toString?.() || String(value);
}

function hasId(list, field, targetId) {
  const target = idStr(targetId);
  return (list || []).some((item) => idStr(item[field] || item) === target);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({
    email: VENDOR_ADMIN_EMAIL,
    role: 'vendor_admin',
    isActive: true,
  });
  if (!admin?.vendorId) {
    throw new Error(`Vendor admin not found: ${VENDOR_ADMIN_EMAIL}`);
  }

  const vendorId = admin.vendorId;
  const assignedBy = admin._id;

  const classroom = await Classroom.findOne({
    vendorId,
    isActive: true,
    name: new RegExp(`^${CLASSROOM_NAME}$`, 'i'),
  });
  if (!classroom) {
    const names = await Classroom.find({ vendorId, isActive: true }).select('name').lean();
    throw new Error(
      `Classroom "${CLASSROOM_NAME}" not found for ${VENDOR_ADMIN_EMAIL}. Existing: ${names.map((c) => c.name).join(', ') || '(none)'}`
    );
  }

  const createdEmails = [];
  const reusedEmails = [];
  const students = [];

  for (const spec of DEMO_STUDENTS) {
    let student = await User.findOne({ email: spec.email.toLowerCase() });
    if (student) {
      if (student.role !== 'student') {
        throw new Error(`${spec.email} exists as ${student.role}, not a student`);
      }
      if (student.vendorId && idStr(student.vendorId) !== idStr(vendorId)) {
        throw new Error(`${spec.email} belongs to another vendor`);
      }
      student.vendorId = vendorId;
      student.name = spec.name;
      student.enrollmentNumber = spec.enrollmentNumber;
      student.accountOrigin = 'vendor_enrolled';
      student.isActive = true;
      student.password = PASSWORD;
      await student.save();
      reusedEmails.push(spec.email);
    } else {
      student = new User({
        name: spec.name,
        email: spec.email.toLowerCase(),
        enrollmentNumber: spec.enrollmentNumber,
        password: PASSWORD,
        role: 'student',
        vendorId,
        accountOrigin: 'vendor_enrolled',
        isActive: true,
      });
      await student.save();
      createdEmails.push(spec.email);
    }
    students.push(student);
  }

  const existingStudentIds = new Set((classroom.students || []).map(idStr));
  let newlyEnrolled = 0;
  for (const student of students) {
    if (!existingStudentIds.has(idStr(student._id))) {
      classroom.students.push(student._id);
      newlyEnrolled += 1;
    }
  }
  await classroom.save();

  const [tests, interviews, assignments, problems] = await Promise.all([
    Test.find({
      vendorId,
      source: { $ne: 'course_module' },
    }).select('_id title type source isActive').lean(),
    Interview.find({ vendorId }).select('_id title source isActive').lean(),
    Assignment.find({
      vendorId,
      status: { $ne: 'archived' },
    }).select('_id title status deadline').lean(),
    SystemDesignProblem.find({ vendorId }).select('_id title isActive assignedTo assignedClassrooms').lean(),
  ]);

  const now = new Date();
  classroom.assignedTests = classroom.assignedTests || [];
  classroom.assignedInterviews = classroom.assignedInterviews || [];

  let testsLinked = 0;
  for (const test of tests) {
    if (!hasId(classroom.assignedTests, 'testId', test._id)) {
      classroom.assignedTests.push({ testId: test._id, assignedAt: now, assignedBy });
      testsLinked += 1;
    }
  }

  let interviewsLinked = 0;
  for (const interview of interviews) {
    if (!hasId(classroom.assignedInterviews, 'interviewId', interview._id)) {
      classroom.assignedInterviews.push({
        interviewId: interview._id,
        assignedAt: now,
        assignedBy,
      });
      interviewsLinked += 1;
    }
  }
  await classroom.save();

  const studentIds = students.map((s) => s._id);
  const studentIdSet = new Set(studentIds.map(idStr));
  const assignmentNewCounts = new Map();

  for (const student of students) {
    student.enrolledTests = student.enrolledTests || [];
    student.enrolledInterviews = student.enrolledInterviews || [];
    student.enrolledAssignments = student.enrolledAssignments || [];

    for (const test of tests) {
      if (!hasId(student.enrolledTests, 'testId', test._id)) {
        student.enrolledTests.push({
          testId: test._id,
          assignedAt: now,
          status: 'assigned',
        });
      }
    }
    for (const interview of interviews) {
      if (!hasId(student.enrolledInterviews, 'interviewId', interview._id)) {
        student.enrolledInterviews.push({
          interviewId: interview._id,
          assignedAt: now,
          status: 'assigned',
        });
      }
    }
    for (const assignment of assignments) {
      if (!hasId(student.enrolledAssignments, 'assignmentId', assignment._id)) {
        student.enrolledAssignments.push({
          assignmentId: assignment._id,
          assignedAt: now,
          status: 'assigned',
          deadline: assignment.deadline,
        });
        const key = idStr(assignment._id);
        assignmentNewCounts.set(key, (assignmentNewCounts.get(key) || 0) + 1);
      }
    }
    await student.save();
  }

  let assignmentEnrollDelta = 0;
  for (const assignment of assignments) {
    const delta = assignmentNewCounts.get(idStr(assignment._id)) || 0;
    if (!delta) continue;
    assignmentEnrollDelta += delta;
    await Assignment.updateOne(
      { _id: assignment._id },
      { $inc: { totalAssigned: delta } }
    );
  }

  let problemsLinked = 0;
  for (const problem of problems) {
    const assignedTo = (problem.assignedTo || []).map(idStr);
    const assignedClassrooms = (problem.assignedClassrooms || []).map(idStr);
    const nextAssignedTo = [...assignedTo];
    for (const sid of studentIdSet) {
      if (!nextAssignedTo.includes(sid)) nextAssignedTo.push(sid);
    }
    const nextClassrooms = assignedClassrooms.includes(idStr(classroom._id))
      ? assignedClassrooms
      : [...assignedClassrooms, idStr(classroom._id)];

    const changed =
      nextAssignedTo.length !== assignedTo.length ||
      nextClassrooms.length !== assignedClassrooms.length;
    if (changed) {
      problemsLinked += 1;
      await SystemDesignProblem.updateOne(
        { _id: problem._id },
        {
          $set: {
            assignedTo: nextAssignedTo,
            assignedClassrooms: nextClassrooms,
            totalAssigned: nextAssignedTo.length,
          },
        }
      );
    }
  }

  const refreshed = await User.find({ _id: { $in: studentIds } })
    .select('name email enrollmentNumber enrolledTests enrolledInterviews enrolledAssignments')
    .lean();

  const summary = {
    vendor: VENDOR_ADMIN_EMAIL,
    classroom: { id: idStr(classroom._id), name: classroom.name, students: classroom.students.length },
    students: {
      created: createdEmails.length,
      reused: reusedEmails.length,
      newlyEnrolledInClassroom: newlyEnrolled,
    },
    allocated: {
      tests: tests.length,
      testsNewlyLinked: testsLinked,
      interviews: interviews.length,
      interviewsNewlyLinked: interviewsLinked,
      assignments: assignments.length,
      assignmentTotalAssignedDelta: assignmentEnrollDelta,
      systemDesign: problems.length,
      systemDesignUpdated: problemsLinked,
    },
    perStudent: refreshed.map((s) => ({
      email: s.email,
      tests: (s.enrolledTests || []).length,
      interviews: (s.enrolledInterviews || []).length,
      assignments: (s.enrolledAssignments || []).length,
    })),
    credentials: DEMO_STUDENTS.map((s) => ({
      name: s.name,
      enrollmentNumber: s.enrollmentNumber,
      email: s.email,
      password: PASSWORD,
    })),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
