const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { uploadToR2, deleteFromR2, getKeyFromUrl } = require('../utils/r2Storage');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Test = require('../models/Test');
const Result = require('../models/Result');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const Classroom = require('../models/Classroom');
const DatasetTemplate = require('../models/DatasetTemplate');
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');
const AptitudeQuestion = require('../models/AptitudeQuestion');
const TheoryQuestion = require('../models/TheoryQuestion');
const {
  buildReportData,
  generateExcelBuffer,
  sanitizeFilename,
  getColumnDefs,
} = require('../utils/reports');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

router.use((req, res, next) => {
  console.log('✅ All middleware passed for vendor admin route:', req.path);
  console.log('   User:', req.user?.email, 'Role:', req.user?.role, 'VendorId:', req.vendorId);
  next();
});

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_ALLOWED_EXT = /\.(jpe?g|png|gif|webp)$/i;
const LOGO_ALLOWED_MIME = /^image\/(jpeg|png|gif|webp)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (LOGO_ALLOWED_EXT.test(ext) && LOGO_ALLOWED_MIME.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only PNG, JPG, GIF, or WebP images are allowed (max 5 MB)'));
  },
});

const handleMulterError = (err, req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Logo file is too large. Maximum size is 5 MB.' });
  }
  return res.status(400).json({ message: err.message || 'Invalid file upload' });
};

// Get vendor info
router.get('/vendor', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update vendor settings (merge into existing settings — do not wipe fields)
router.put('/vendor', async (req, res) => {
  try {
    const { settings: incoming } = req.body;
    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const current = vendor.settings?.toObject?.() || vendor.settings || {};

    let leetcodeAnalyticsUrl =
      incoming?.leetcodeAnalyticsUrl !== undefined
        ? String(incoming.leetcodeAnalyticsUrl || '').trim()
        : (current.leetcodeAnalyticsUrl || '');

    if (leetcodeAnalyticsUrl) {
      try {
        const parsed = new URL(leetcodeAnalyticsUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return res.status(400).json({ message: 'LeetCode Analytics URL must start with http:// or https://' });
        }
        leetcodeAnalyticsUrl = parsed.toString();
      } catch {
        return res.status(400).json({ message: 'Invalid LeetCode Analytics URL' });
      }
    }

    vendor.settings = {
      primaryColor: incoming?.primaryColor ?? current.primaryColor ?? '#ED0331',
      secondaryColor: incoming?.secondaryColor ?? current.secondaryColor ?? '#87021C',
      theme: incoming?.theme ?? current.theme ?? 'light',
      leetcodeAnalyticsUrl,
    };
    vendor.markModified('settings');
    await vendor.save();

    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload logo (stored in Cloudflare R2)
router.post('/vendor/logo', (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err) return handleMulterError(err, req, res, next);
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Use field name "logo".' });
    }

    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (vendor.logo) {
      const oldKey = getKeyFromUrl(vendor.logo);
      if (oldKey) await deleteFromR2(oldKey);
    }

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `vendor-${req.vendorId}-${Date.now()}${ext}`;
    const r2Key = `uploads/logos/${filename}`;
    console.log(`📤 Uploading vendor logo to R2: ${r2Key}`);
    const publicUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    console.log(`✅ Vendor logo uploaded: ${publicUrl}`);

    vendor.logo = publicUrl;
    await vendor.save();

    res.json({
      logo: vendor.logo,
      companyName: vendor.companyName,
      settings: vendor.settings,
    });
  } catch (error) {
    console.error('❌ Logo upload error:', error.message);
    const isR2Config = /R2 environment variables/i.test(error.message);
    res.status(isR2Config ? 503 : 500).json({
      message: isR2Config
        ? 'Logo storage is not configured. Set Cloudflare R2 environment variables on the server.'
        : 'Failed to upload logo',
      error: error.message,
    });
  }
});

// Remove logo
router.delete('/vendor/logo', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (vendor.logo) {
      const oldKey = getKeyFromUrl(vendor.logo);
      if (oldKey) await deleteFromR2(oldKey);
      vendor.logo = null;
      await vendor.save();
    }

    res.json({ logo: null, message: 'Logo removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for vendor:', req.vendorId);
    const vendorId = req.vendorId;
    const [
      testDocs,
      totalStudents,
      totalResults,
      completedResults,
      totalClassrooms,
      totalInterviews,
      totalAssignments,
      totalSystemDesigns,
      totalDatasetTemplates,
      codingQuestions,
      mcqQuestions,
      aptitudeQuestions,
      theoryQuestions,
    ] = await Promise.all([
      Test.find({ vendorId }).select('type').lean(),
      User.countDocuments({ vendorId, role: 'student' }),
      Result.countDocuments({ vendorId }),
      Result.countDocuments({ vendorId, status: 'completed' }),
      Classroom.countDocuments({ vendorId }),
      Interview.countDocuments({ vendorId }),
      Assignment.countDocuments({ vendorId }),
      SystemDesignProblem.countDocuments({ vendorId }),
      DatasetTemplate.countDocuments({ vendorId }),
      CodingQuestion.countDocuments({ vendorId }),
      MCQQuestion.countDocuments({ vendorId }),
      AptitudeQuestion.countDocuments({ vendorId }),
      TheoryQuestion.countDocuments({ vendorId }),
    ]);

    const testsByType = {};
    for (const doc of testDocs) {
      const type = doc.type || 'other';
      testsByType[type] = (testsByType[type] || 0) + 1;
    }

    const totalTests = testDocs.length;
    // Sidebar counts — same rules as vendor TestList filters
    const sectionCounts = {
      coding: testsByType.coding || 0,
      aptitude: testsByType.aptitude || 0,
      mcq: testsByType.mcq || 0,
      english: testsByType.english || 0,
      theory: testsByType.theory || 0,
      mixed: testsByType.mixed || 0,
      tools: testsByType.sql || 0,
      project: totalAssignments,
      interview: totalInterviews,
      system: totalSystemDesigns,
      company: 0,
    };

    const totalAssessments =
      totalTests + totalInterviews + totalAssignments + totalSystemDesigns;

    console.log(`✅ Stats: Tests: ${totalTests}, Assessments: ${totalAssessments}, Students: ${totalStudents}`);

    res.json({
      totalTests,
      totalStudents,
      totalResults,
      completedResults,
      totalClassrooms,
      totalInterviews,
      totalAssignments,
      totalSystemDesigns,
      totalDatasetTemplates,
      totalAssessments,
      testsByType,
      sectionCounts,
      questions: {
        coding: codingQuestions,
        mcq: mcqQuestions,
        aptitude: aptitudeQuestions,
        theory: theoryQuestions,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get students with optional pagination (default page size for large orgs)
router.get('/students', async (req, res) => {
  try {
    console.log('📥 Fetching students for vendor:', req.vendorId);
    const Classroom = require('../models/Classroom');
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });
    const classroomId = String(req.query.classroomId || '').trim();

    const filter = {
      vendorId: req.vendorId,
      role: 'student',
      accountOrigin: { $ne: 'contest' },
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      filter.$or = [
        { name: regex },
        { email: regex },
        { enrollmentNumber: regex },
      ];
    }

    const classrooms = await Classroom.find({ vendorId: req.vendorId, isActive: true })
      .select('name students')
      .lean();

    if (classroomId) {
      const classroom = classrooms.find((c) => String(c._id) === classroomId);
      const memberIds = (classroom?.students || []).map((id) => String(id));
      if (!memberIds.length) {
        return res.json(paginatedResponse({ items: [], page, limit, total: 0 }));
      }
      filter._id = { $in: memberIds };
    }

    const studentClassroomMap = new Map();
    classrooms.forEach((classroom) => {
      (classroom.students || []).forEach((studentId) => {
        const key = String(studentId);
        if (!studentClassroomMap.has(key)) studentClassroomMap.set(key, []);
        studentClassroomMap.get(key).push({ id: classroom._id, name: classroom.name });
      });
    });

    const [students, total] = await Promise.all([
      User.find(filter)
        .select('name email enrollmentNumber isActive createdAt enrolledTests')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const items = students.map((student) => ({
      ...student,
      classrooms: studentClassroomMap.get(String(student._id)) || [],
    }));

    console.log(`✅ Found ${items.length}/${total} students (page ${page})`);
    res.json(paginatedResponse({ items, page, limit, total }));
  } catch (error) {
    console.error('❌ Error fetching students:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single student
router.get('/students/:studentId', async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.studentId,
      vendorId: req.vendorId,
      role: 'student',
      accountOrigin: { $ne: 'contest' },
    }).select('-password');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('❌ Error fetching student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update student details
router.put('/students/:studentId', async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.studentId,
      vendorId: req.vendorId,
      role: 'student',
      accountOrigin: { $ne: 'contest' },
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const { name, email, enrollmentNumber, password, isActive } = req.body;

    if (name != null) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ message: 'Name is required' });
      }
      student.name = trimmedName;
    }

    if (email != null) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        return res.status(400).json({ message: 'A valid email is required' });
      }
      if (normalizedEmail !== student.email) {
        const emailTaken = await User.findOne({ email: normalizedEmail });
        if (emailTaken && emailTaken._id.toString() !== student._id.toString()) {
          return res.status(400).json({ message: 'Email is already in use' });
        }
        student.email = normalizedEmail;
      }
    }

    if (enrollmentNumber !== undefined) {
      const resolved = await resolveEnrollmentNumberForUpdate(
        student,
        enrollmentNumber,
        req.vendorId
      );
      if (!resolved.ok) {
        return res.status(400).json({ message: resolved.reason });
      }
    }

    if (password != null && String(password).trim()) {
      if (String(password).trim().length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      student.password = String(password).trim();
    }

    if (typeof isActive === 'boolean') {
      student.isActive = isActive;
    }

    await student.save();

    const studentObj = student.toObject();
    delete studentObj.password;

    res.json({
      message: 'Student updated successfully',
      student: studentObj,
    });
  } catch (error) {
    console.error('❌ Error updating student:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Enrollment number is already used by another student in your organization.',
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Enroll students (bulk)
router.post('/students/enroll', async (req, res) => {
  try {
    console.log('📥 Enrolling students for vendor:', req.vendorId);
    const { students } = req.body; // Array of {name, email, password}
    
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'Students array is required' });
    }

    const enrolledStudents = [];
    const skippedStudents = [];

    for (const studentData of students) {
      // Normalize email
      const normalizedEmail = studentData.email.toLowerCase().trim();
      const enrollmentNumber = normalizeEnrollmentNumber(studentData.enrollmentNumber);
      
      console.log(`🔍 Checking student: ${normalizedEmail}`);
      
      // Match by email first — assign vendorId if student exists without one
      let existingUser = await User.findOne({ email: normalizedEmail });

      if (existingUser) {
        if (existingUser.role !== 'student') {
          skippedStudents.push({
            email: normalizedEmail,
            reason: 'Email already used by a non-student account',
          });
          continue;
        }

        const existingVendor = existingUser.vendorId?.toString();
        const targetVendor = req.vendorId.toString();

        if (existingVendor && existingVendor !== targetVendor) {
          skippedStudents.push({
            email: normalizedEmail,
            reason: 'Student belongs to another organization',
          });
          continue;
        }

        if (!existingUser.vendorId) {
          existingUser.vendorId = req.vendorId;
          await existingUser.save();
          console.log(`✅ Assigned vendorId to existing student: ${normalizedEmail}`);
        }

        if (enrollmentNumber) {
          const applied = await applyEnrollmentNumberToExisting(
            existingUser,
            enrollmentNumber,
            req.vendorId
          );
          if (!applied.ok) {
            skippedStudents.push({ email: normalizedEmail, reason: applied.reason });
            continue;
          }
        }

        enrolledStudents.push(studentResponseFields(existingUser));
        continue;
      }

      if (enrollmentNumber) {
        const conflict = await findEnrollmentConflict(req.vendorId, enrollmentNumber);
        if (conflict) {
          skippedStudents.push({
            email: normalizedEmail,
            reason: `Enrollment number "${enrollmentNumber}" is already used by ${conflict.email}`,
          });
          continue;
        }
      }

      const student = new User({
        name: studentData.name.trim(),
        email: normalizedEmail,
        password: studentData.password || 'student123',
        role: 'student',
        vendorId: req.vendorId,
        accountOrigin: 'vendor_enrolled',
        isActive: true,
        ...(enrollmentNumber ? { enrollmentNumber } : {}),
      });

      await student.save();
      console.log(`✅ Student created: ${student.name} (${student.email})`);
      
      enrolledStudents.push(studentResponseFields(student));
    }

    console.log(`✅ Enrollment complete: ${enrolledStudents.length} enrolled, ${skippedStudents.length} skipped`);

    // Update vendor stats
    const Vendor = require('../models/Vendor');
    await Vendor.findByIdAndUpdate(req.vendorId, { 
      $inc: { 'stats.totalStudents': enrolledStudents.length } 
    });

    res.status(201).json({ 
      enrolled: enrolledStudents,
      skipped: skippedStudents,
      message: `${enrolledStudents.length} student(s) enrolled successfully`
    });
  } catch (error) {
    console.error('❌ Error enrolling students:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'An enrollment number in this batch is already used by another student in your organization.',
      });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get tests (paginated list for vendor panel)
router.get('/tests', async (req, res) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 30,
      maxLimit: 100,
    });
    const type = String(req.query.type || '').trim();

    const filter = { vendorId: req.vendorId };
    if (type) filter.type = type;

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.title = new RegExp(escaped, 'i');
    }

    const [tests, total] = await Promise.all([
      Test.find(filter)
        .select('title type duration isActive createdAt updatedAt questions createdBy settings')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Test.countDocuments(filter),
    ]);

    res.json(paginatedResponse({ items: tests, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get test results (paginated — excludes heavy answer payloads in list view)
router.get('/tests/:testId/results', async (req, res) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const filter = {
      testId: req.params.testId,
      vendorId: req.vendorId,
    };

    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingStudents = await User.find({
        vendorId: req.vendorId,
        role: 'student',
        $or: [
          { name: new RegExp(escaped, 'i') },
          { email: new RegExp(escaped, 'i') },
          { enrollmentNumber: new RegExp(escaped, 'i') },
        ],
      })
        .select('_id')
        .lean();

      const studentIds = matchingStudents.map((s) => s._id);
      if (!studentIds.length) {
        const emptySummary = { total: 0, completed: 0, average: 0, highest: 0, lowest: 0 };
        return res.json(
          paginatedResponse({
            items: [],
            page,
            limit,
            total: 0,
            extra: { summary: emptySummary },
          })
        );
      }
      filter.studentId = { $in: studentIds };
    }

    const summaryFilter = {
      testId: req.params.testId,
      vendorId: req.vendorId,
    };

    const [results, total, summaryRows] = await Promise.all([
      Result.find(filter)
        .select(
          'studentId status totalScore maxScore percentage submittedAt startedAt timeSpent autoSubmitted violationCount'
        )
        .populate('studentId', 'name email enrollmentNumber')
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Result.countDocuments(filter),
      Result.aggregate([
        { $match: summaryFilter },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            average: { $avg: '$percentage' },
            highest: { $max: '$percentage' },
            lowest: { $min: '$percentage' },
          },
        },
      ]),
    ]);

    const raw = summaryRows[0] || {};
    const summary = {
      total: raw.total || 0,
      completed: raw.completed || 0,
      average: raw.average != null ? Math.round(raw.average) : 0,
      highest: raw.highest != null ? Math.round(raw.highest) : 0,
      lowest: raw.lowest != null ? Math.round(raw.lowest) : 0,
    };

    res.json(paginatedResponse({ items: results, page, limit, total, extra: { summary } }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const {
  getAnalyticsOverview,
  getAnalyticsTests,
  getClassroomAnalytics,
} = require('../utils/analytics/vendorAnalytics');
const {
  normalizeEnrollmentNumber,
  findEnrollmentConflict,
  applyEnrollmentNumberToExisting,
  resolveEnrollmentNumberForUpdate,
  studentResponseFields,
} = require('../utils/studentEnrollment');

// Lightweight overview — fast initial load
router.get('/analytics/overview', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
    const overview = await getAnalyticsOverview(req.vendorId, { days });
    res.json(overview);
  } catch (error) {
    console.error('❌ Error fetching analytics overview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Paginated test performance
router.get('/analytics/tests', async (req, res) => {
  try {
    const data = await getAnalyticsTests(req.vendorId, {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || '',
      sort: req.query.sort || 'submissions',
    });
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching analytics tests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Classroom drill-down with paginated students
router.get('/analytics/classrooms/:classroomId', async (req, res) => {
  try {
    const data = await getClassroomAnalytics(req.vendorId, req.params.classroomId, {
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search || '',
    });
    if (!data) {
      return res.status(404).json({ message: 'Classroom not found' });
    }
    res.json(data);
  } catch (error) {
    console.error('❌ Error fetching classroom analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Backward-compatible alias — returns overview only (no heavy student payloads)
router.get('/analytics', async (req, res) => {
  try {
    const overview = await getAnalyticsOverview(req.vendorId, { days: 30 });
    res.json(overview);
  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Speaking analytics for a specific test
router.get('/tests/:testId/speaking-analytics', async (req, res) => {
  try {
    const results = await Result.find({
      testId: req.params.testId,
      vendorId: req.vendorId,
      status: 'completed'
    }).populate('studentId', 'name email enrollmentNumber');

    const speakingAnswers = [];
    results.forEach(r => {
      (r.answers || []).forEach(a => {
        if (a.questionType === 'english_speaking' && a.englishEvaluation) {
          speakingAnswers.push({
            studentName: r.studentId?.name || 'Unknown',
            studentEmail: r.studentId?.email || '',
            questionId: a.questionId,
            points: a.points,
            maxPoints: a.maxPoints,
            audioUrl: a.audioFileUrl,
            evaluation: a.englishEvaluation
          });
        }
      });
    });

    if (speakingAnswers.length === 0) {
      return res.json({ totalSubmissions: 0, averages: {}, distribution: {} });
    }

    const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) : 0;

    const averages = {
      pronunciation: avg(speakingAnswers.map(a => a.evaluation.pronunciationScore || 0)),
      fluency: avg(speakingAnswers.map(a => a.evaluation.fluencyScore || 0)),
      coherence: avg(speakingAnswers.map(a => a.evaluation.coherenceScore || 0)),
      vocabulary: avg(speakingAnswers.map(a => a.evaluation.vocabularyScore || 0)),
      grammar: avg(speakingAnswers.map(a => a.evaluation.grammarScore || 0)),
      confidence: avg(speakingAnswers.map(a => a.evaluation.confidenceScore || 0)),
    };

    const avgSpeakingRate = speakingAnswers.reduce((sum, a) => sum + (a.evaluation.speakingRate || 0), 0) / speakingAnswers.length;
    const avgFillerWords = speakingAnswers.reduce((sum, a) => sum + (a.evaluation.fillerWords || 0), 0) / speakingAnswers.length;
    const avgVocabDiversity = speakingAnswers.reduce((sum, a) => sum + (a.evaluation.vocabularyDiversity || 0), 0) / speakingAnswers.length;

    const scoreRanges = { excellent: 0, good: 0, average: 0, poor: 0 };
    speakingAnswers.forEach(a => {
      const pct = a.maxPoints > 0 ? (a.points / a.maxPoints) * 100 : 0;
      if (pct >= 80) scoreRanges.excellent++;
      else if (pct >= 60) scoreRanges.good++;
      else if (pct >= 40) scoreRanges.average++;
      else scoreRanges.poor++;
    });

    res.json({
      totalSubmissions: speakingAnswers.length,
      averages,
      avgSpeakingRate: Math.round(avgSpeakingRate),
      avgFillerWords: Math.round(avgFillerWords * 10) / 10,
      avgVocabDiversity: Math.round(avgVocabDiversity * 100),
      distribution: scoreRanges,
      topPerformers: speakingAnswers
        .sort((a, b) => (b.points / (b.maxPoints || 1)) - (a.points / (a.maxPoints || 1)))
        .slice(0, 5)
        .map(a => ({
          name: a.studentName,
          email: a.studentEmail,
          score: a.points,
          maxScore: a.maxPoints,
          pronunciation: Math.round((a.evaluation.pronunciationScore || 0) * 100),
          fluency: Math.round((a.evaluation.fluencyScore || 0) * 100),
        }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// —— Excel report export ——
const assertVendorResource = (doc, vendorId, label) => {
  if (!doc) return { error: { status: 404, message: `${label} not found` } };
  if (doc.vendorId.toString() !== vendorId.toString()) {
    return { error: { status: 403, message: 'Access denied' } };
  }
  return { doc };
};

router.get('/tests/:testId/report-options', async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    const check = assertVendorResource(test, req.vendorId, 'Test');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });
    res.json(getColumnDefs('test', test));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/tests/:testId/export', async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    const check = assertVendorResource(test, req.vendorId, 'Test');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });

    const selectedKeys = Array.isArray(req.body?.columns) ? req.body.columns : [];
    if (!selectedKeys.length) {
      return res.status(400).json({ message: 'Select at least one column to export.' });
    }

    const reportData = await buildReportData('test', test, req.vendorId);
    const buffer = await generateExcelBuffer({
      category: 'test',
      test,
      selectedKeys,
      reportData,
    });

    const filename = `${sanitizeFilename(test.title)}_report.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Test export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

router.get('/interviews/:interviewId/report-options', async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    const check = assertVendorResource(interview, req.vendorId, 'Interview');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });
    res.json(getColumnDefs('interview'));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/interviews/:interviewId/export', async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.interviewId);
    const check = assertVendorResource(interview, req.vendorId, 'Interview');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });

    const selectedKeys = Array.isArray(req.body?.columns) ? req.body.columns : [];
    if (!selectedKeys.length) {
      return res.status(400).json({ message: 'Select at least one column to export.' });
    }

    const reportData = await buildReportData('interview', interview, req.vendorId);
    const buffer = await generateExcelBuffer({
      category: 'interview',
      selectedKeys,
      reportData,
    });

    const filename = `${sanitizeFilename(interview.title)}_interview_report.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Interview export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

router.get('/assignments/:assignmentId/report-options', async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    const check = assertVendorResource(assignment, req.vendorId, 'Assignment');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });
    res.json(getColumnDefs('assignment'));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/assignments/:assignmentId/export', async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId);
    const check = assertVendorResource(assignment, req.vendorId, 'Assignment');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });

    const selectedKeys = Array.isArray(req.body?.columns) ? req.body.columns : [];
    if (!selectedKeys.length) {
      return res.status(400).json({ message: 'Select at least one column to export.' });
    }

    const reportData = await buildReportData('assignment', assignment, req.vendorId);
    const buffer = await generateExcelBuffer({
      category: 'assignment',
      selectedKeys,
      reportData,
    });

    const filename = `${sanitizeFilename(assignment.title)}_assignment_report.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Assignment export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

router.get('/system-design/:problemId/report-options', async (req, res) => {
  try {
    const problem = await SystemDesignProblem.findById(req.params.problemId);
    const check = assertVendorResource(problem, req.vendorId, 'System design problem');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });
    res.json(getColumnDefs('system_design'));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/system-design/:problemId/export', async (req, res) => {
  try {
    const problem = await SystemDesignProblem.findById(req.params.problemId);
    const check = assertVendorResource(problem, req.vendorId, 'System design problem');
    if (check.error) return res.status(check.error.status).json({ message: check.error.message });

    const selectedKeys = Array.isArray(req.body?.columns) ? req.body.columns : [];
    if (!selectedKeys.length) {
      return res.status(400).json({ message: 'Select at least one column to export.' });
    }

    const reportData = await buildReportData('system_design', problem, req.vendorId);
    const buffer = await generateExcelBuffer({
      category: 'system_design',
      selectedKeys,
      reportData,
    });

    const filename = `${sanitizeFilename(problem.title)}_system_design_report.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('System design export error:', error);
    res.status(500).json({ message: 'Export failed', error: error.message });
  }
});

module.exports = router;

