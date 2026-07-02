const User = require('../models/User');

const STUDENT_PUBLIC_FIELDS = 'name email enrollmentNumber';
const DEFAULT_STUDENT_PASSWORD = 'student123';

function normalizeEnrollmentNumber(value) {
  if (value == null) return '';
  return String(value).trim();
}

async function findEnrollmentConflict(vendorId, enrollmentNumber, excludeUserId = null) {
  const num = normalizeEnrollmentNumber(enrollmentNumber);
  if (!num) return null;

  const query = {
    vendorId,
    role: 'student',
    enrollmentNumber: num,
  };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  return User.findOne(query);
}

/**
 * Apply enrollment number to an existing student (set if empty, reject on conflict).
 */
async function applyEnrollmentNumberToExisting(existingUser, enrollmentNumber, vendorId) {
  const num = normalizeEnrollmentNumber(enrollmentNumber);
  if (!num) return { ok: true };

  if (existingUser.enrollmentNumber && existingUser.enrollmentNumber !== num) {
    return {
      ok: false,
      reason: `Enrollment number already set (${existingUser.enrollmentNumber})`,
    };
  }

  if (!existingUser.enrollmentNumber) {
    const conflict = await findEnrollmentConflict(vendorId, num, existingUser._id);
    if (conflict) {
      return {
        ok: false,
        reason: `Enrollment number "${num}" is already used by ${conflict.email}`,
      };
    }
    existingUser.enrollmentNumber = num;
    await existingUser.save();
  }

  return { ok: true };
}

/**
 * Set or clear enrollment number when editing a student (allows change).
 */
async function resolveEnrollmentNumberForUpdate(student, enrollmentNumber, vendorId) {
  const num = normalizeEnrollmentNumber(enrollmentNumber);
  if (!num) {
    student.enrollmentNumber = null;
    return { ok: true };
  }
  if (student.enrollmentNumber === num) {
    return { ok: true };
  }
  const conflict = await findEnrollmentConflict(vendorId, num, student._id);
  if (conflict) {
    return {
      ok: false,
      reason: `Enrollment number "${num}" is already used by ${conflict.email}`,
    };
  }
  student.enrollmentNumber = num;
  return { ok: true };
}

/**
 * Parse a CSV-style bulk row.
 * - 2 cols: Name, Email
 * - 3 cols: Name, Email, Password (legacy)
 * - 4+ cols: Name, Email, EnrollmentNumber, Password
 */
function parseBulkStudentRow(line) {
  const trimmed = line.trim();
  if (!trimmed) return { valid: false, error: 'Empty line' };

  const parts = trimmed.split(',').map((s) => s.trim());
  if (parts.length < 2) {
    return { valid: false, error: 'Each line needs at least name and email' };
  }

  const [name, email, third = '', fourth = ''] = parts;
  if (!name || !email) {
    return { valid: false, error: 'Name and email are required' };
  }
  if (!email.includes('@')) {
    return { valid: false, error: `Invalid email: ${email}` };
  }

  if (parts.length >= 4) {
    return {
      valid: true,
      student: {
        name,
        email,
        enrollmentNumber: third,
        password: fourth || DEFAULT_STUDENT_PASSWORD,
      },
    };
  }

  if (parts.length === 3) {
    return {
      valid: true,
      student: {
        name,
        email,
        password: third || DEFAULT_STUDENT_PASSWORD,
      },
    };
  }

  return {
    valid: true,
    student: {
      name,
      email,
      password: DEFAULT_STUDENT_PASSWORD,
    },
  };
}

function studentResponseFields(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    enrollmentNumber: user.enrollmentNumber || '',
  };
}

function studentReportFields(student) {
  return {
    studentName: student?.name || '',
    studentEmail: student?.email || '',
    enrollmentNumber: student?.enrollmentNumber || '',
  };
}

module.exports = {
  STUDENT_PUBLIC_FIELDS,
  DEFAULT_STUDENT_PASSWORD,
  normalizeEnrollmentNumber,
  findEnrollmentConflict,
  applyEnrollmentNumberToExisting,
  resolveEnrollmentNumberForUpdate,
  parseBulkStudentRow,
  studentResponseFields,
  studentReportFields,
};
