const DEFAULT_STUDENT_PASSWORD = 'student123';

/**
 * Parse a CSV-style bulk row (mirrors backend studentEnrollment.parseBulkStudentRow).
 */
export function parseBulkStudentRow(line) {
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

export function parseBulkStudentText(raw) {
  const lines = raw.split('\n').filter((line) => line.trim());
  const students = [];
  const invalidLines = [];

  lines.forEach((line, index) => {
    const header = line.toLowerCase();
    if (
      index === 0 &&
      header.includes('name') &&
      header.includes('email') &&
      (header.includes('enrollment') || header.includes('password'))
    ) {
      return;
    }

    const parsed = parseBulkStudentRow(line);
    if (!parsed.valid) {
      invalidLines.push({ line: index + 1, error: parsed.error });
      return;
    }
    students.push(parsed.student);
  });

  return { students, invalidLines };
}

export const BULK_STUDENT_FORMAT_HINT =
  'Name,Email,EnrollmentNumber,Password — use 4 columns for enrollment # (password optional). Legacy 3-column rows remain Name,Email,Password.';

export const BULK_STUDENT_SAMPLE = `John Doe,john@example.com,ENR-2024-001,student123
Jane Smith,jane@example.com,ENR-2024-002`;

export function matchesStudentSearch(student, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    student?.name?.toLowerCase().includes(q) ||
    student?.email?.toLowerCase().includes(q) ||
    student?.enrollmentNumber?.toLowerCase().includes(q)
  );
}

export function matchesNestedStudentSearch(record, query) {
  const student = record?.studentId || record;
  return matchesStudentSearch(student, query);
}
