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
const CodingQuestion = require('../models/CodingQuestion');
const MCQQuestion = require('../models/MCQQuestion');

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

router.use((req, res, next) => {
  console.log('✅ All middleware passed for vendor admin route:', req.path);
  console.log('   User:', req.user?.email, 'Role:', req.user?.role, 'VendorId:', req.vendorId);
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

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

// Update vendor settings
router.put('/vendor', async (req, res) => {
  try {
    const { settings } = req.body;
    const vendor = await Vendor.findByIdAndUpdate(
      req.vendorId,
      { settings },
      { new: true, runValidators: true }
    );
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upload logo
router.post('/vendor/logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const vendor = await Vendor.findById(req.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    if (vendor.logo) {
      const oldKey = getKeyFromUrl(vendor.logo);
      if (oldKey) await deleteFromR2(oldKey);
    }

    const filename = `vendor-${req.vendorId}-${Date.now()}${path.extname(req.file.originalname)}`;
    const r2Key = `uploads/logos/${filename}`;
    console.log(`📤 Uploading vendor logo to R2: ${r2Key}`);
    const publicUrl = await uploadToR2(req.file.buffer, r2Key, req.file.originalname);
    console.log(`✅ Vendor logo uploaded: ${publicUrl}`);

    vendor.logo = publicUrl;
    await vendor.save();

    res.json({ logo: vendor.logo });
  } catch (error) {
    console.error('❌ Logo upload error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats for vendor:', req.vendorId);
    const totalTests = await Test.countDocuments({ vendorId: req.vendorId });
    const totalStudents = await User.countDocuments({ vendorId: req.vendorId, role: 'student' });
    const totalResults = await Result.countDocuments({ vendorId: req.vendorId });
    const completedResults = await Result.countDocuments({ vendorId: req.vendorId, status: 'completed' });

    console.log(`✅ Stats: Tests: ${totalTests}, Students: ${totalStudents}, Results: ${totalResults}`);

    res.json({
      totalTests,
      totalStudents,
      totalResults,
      completedResults
    });
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all students with classroom information
router.get('/students', async (req, res) => {
  try {
    console.log('📥 Fetching students for vendor:', req.vendorId);
    const Classroom = require('../models/Classroom');
    
    const students = await User.find({ vendorId: req.vendorId, role: 'student' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    // Get classrooms for this vendor
    const classrooms = await Classroom.find({ vendorId: req.vendorId, isActive: true })
      .select('name _id students');
    
    // Map students with their classroom information
    const studentsWithClassrooms = students.map(student => {
      const studentObj = student.toObject();
      // Find which classrooms this student belongs to
      const studentClassrooms = classrooms.filter(classroom => 
        classroom.students.some(s => s.toString() === student._id.toString())
      ).map(c => ({ id: c._id, name: c.name }));
      
      studentObj.classrooms = studentClassrooms;
      return studentObj;
    });
    
    console.log(`✅ Found ${students.length} students`);
    res.json(studentsWithClassrooms);
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
      role: 'student'
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
      
      console.log(`🔍 Checking student: ${normalizedEmail}`);
      
      // Check if user already exists (case-insensitive)
      const existingUser = await User.findOne({ 
        email: normalizedEmail,
        vendorId: req.vendorId
      });
      
      if (existingUser) {
        console.log(`⚠️  Student already exists: ${normalizedEmail}`);
        skippedStudents.push({
          email: normalizedEmail,
          reason: 'Already exists'
        });
        continue; // Skip if already exists
      }

      const student = new User({
        name: studentData.name.trim(),
        email: normalizedEmail,
        password: studentData.password || 'student123',
        role: 'student',
        vendorId: req.vendorId,
        isActive: true
      });

      await student.save();
      console.log(`✅ Student created: ${student.name} (${student.email})`);
      
      enrolledStudents.push({
        id: student._id,
        name: student.name,
        email: student.email
      });
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all tests
router.get('/tests', async (req, res) => {
  try {
    const tests = await Test.find({ vendorId: req.vendorId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(tests);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get test results
router.get('/tests/:testId/results', async (req, res) => {
  try {
    const results = await Result.find({
      testId: req.params.testId,
      vendorId: req.vendorId
    })
      .populate('studentId', 'name email')
      .sort({ submittedAt: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get analytics
router.get('/analytics', async (req, res) => {
  try {
    const Classroom = require('../models/Classroom');
    const results = await Result.find({ vendorId: req.vendorId, status: 'completed' });
    const allResults = await Result.find({ vendorId: req.vendorId });
    
    // Get all classrooms
    const classrooms = await Classroom.find({ vendorId: req.vendorId, isActive: true })
      .populate('students', 'name email');
    
    // Get all students
    const allStudents = await User.find({ vendorId: req.vendorId, role: 'student' })
      .select('name email enrolledTests');
    
    // Calculate classroom-wise analytics
    console.log(`📊 Processing ${classrooms.length} classrooms for analytics`);
    const classroomAnalytics = await Promise.all(classrooms.map(async (classroom) => {
      // Handle both populated and non-populated students
      // Filter out null/undefined students (from populate match)
      const validStudents = (classroom.students || []).filter(s => s !== null && s !== undefined);
      const classroomStudentIds = validStudents.map(s => {
        if (typeof s === 'object' && s._id) {
          return s._id.toString();
        }
        return s.toString();
      });
      console.log(`   Classroom "${classroom.name}": ${classroomStudentIds.length} students (${validStudents.length} valid)`);
      
      // Get students in this classroom
      const classroomStudents = allStudents.filter(s => 
        classroomStudentIds.includes(s._id.toString())
      );
      
      // Get results for students in this classroom
      const classroomResults = results.filter(r => 
        classroomStudentIds.includes(r.studentId.toString())
      );
      
      // Get all attempts (including incomplete)
      const allAttempts = allResults.filter(r => 
        classroomStudentIds.includes(r.studentId.toString())
      );
      
      // Calculate metrics
      const totalStudents = classroomStudents.length;
      const attemptedCount = allAttempts.length > 0 ? new Set(allAttempts.map(r => r.studentId.toString())).size : 0;
      const completedCount = classroomResults.length > 0 ? new Set(classroomResults.map(r => r.studentId.toString())).size : 0;
      const averageScore = classroomResults.length > 0
        ? classroomResults.reduce((sum, r) => sum + (r.percentage || 0), 0) / classroomResults.length
        : 0;
      
      // Get test-wise performance for this classroom
      const testPerformance = [];
      const tests = await Test.find({ vendorId: req.vendorId });
      for (const test of tests) {
        const testResults = classroomResults.filter(r => 
          r.testId.toString() === test._id.toString()
        );
        if (testResults.length > 0) {
          testPerformance.push({
            testId: test._id,
            testTitle: test.title,
            submissions: testResults.length,
            averageScore: testResults.reduce((sum, r) => sum + r.percentage, 0) / testResults.length
          });
        }
      }
      
      // Get student-wise details
      const studentDetails = await Promise.all(classroomStudents.map(async (student) => {
        const studentResults = classroomResults.filter(r => 
          r.studentId.toString() === student._id.toString()
        );
        const studentAttempts = allAttempts.filter(r => 
          r.studentId.toString() === student._id.toString()
        );
        
        // Get test titles for student results
        const testScores = await Promise.all(studentResults.map(async (r) => {
          const test = await Test.findById(r.testId).select('title');
          return {
            testId: r.testId,
            testTitle: test ? test.title : 'Unknown Test',
            score: r.percentage,
            submittedAt: r.submittedAt
          };
        }));
        
        return {
          studentId: student._id,
          name: student.name,
          email: student.email,
          totalAttempts: studentAttempts.length,
          completedTests: studentResults.length,
          averageScore: studentResults.length > 0
            ? studentResults.reduce((sum, r) => sum + r.percentage, 0) / studentResults.length
            : 0,
          testScores
        };
      }));
      
      return {
        classroomId: classroom._id,
        classroomName: classroom.name,
        description: classroom.description,
        totalStudents,
        attemptedCount,
        completedCount,
        notAttemptedCount: totalStudents - attemptedCount,
        averageScore: Math.round(averageScore * 100) / 100,
        completionRate: totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0,
        attemptRate: totalStudents > 0 ? Math.round((attemptedCount / totalStudents) * 100) : 0,
        testPerformance,
        studentDetails
      };
    }));
    
    // Overall analytics
    const analytics = {
      totalTests: await Test.countDocuments({ vendorId: req.vendorId }),
      totalStudents: allStudents.length,
      totalSubmissions: results.length,
      totalAttempts: allResults.length,
      averageScore: results.length > 0
        ? Math.round((results.reduce((sum, r) => sum + r.percentage, 0) / results.length) * 100) / 100
        : 0,
      testPerformance: [],
      classroomAnalytics,
      // Additional metrics
      completionRate: allStudents.length > 0
        ? Math.round((new Set(results.map(r => r.studentId.toString())).size / allStudents.length) * 100)
        : 0,
      // Performance by difficulty
      difficultyPerformance: {
        easy: { count: 0, avgScore: 0 },
        medium: { count: 0, avgScore: 0 },
        hard: { count: 0, avgScore: 0 }
      },
      // Time-based trends (last 7 days)
      recentSubmissions: []
    };

    // Get performance per test
    const tests = await Test.find({ vendorId: req.vendorId });
    for (const test of tests) {
      const testResults = await Result.find({ testId: test._id, status: 'completed' });
      analytics.testPerformance.push({
        testId: test._id,
        testTitle: test.title,
        totalSubmissions: testResults.length,
        averageScore: testResults.length > 0
          ? Math.round((testResults.reduce((sum, r) => sum + r.percentage, 0) / testResults.length) * 100) / 100
          : 0
      });
    }
    
    // Calculate recent submissions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentResults = results.filter(r => r.submittedAt >= sevenDaysAgo);
    const dailySubmissions = {};
    recentResults.forEach(r => {
      const date = new Date(r.submittedAt).toISOString().split('T')[0];
      dailySubmissions[date] = (dailySubmissions[date] || 0) + 1;
    });
    analytics.recentSubmissions = Object.keys(dailySubmissions)
      .sort()
      .map(date => ({ date, count: dailySubmissions[date] }));

    console.log(`✅ Analytics calculated: ${classroomAnalytics.length} classrooms, ${analytics.totalTests} tests, ${analytics.totalStudents} students`);
    res.json(analytics);
  } catch (error) {
    console.error('❌ Error fetching analytics:', error);
    console.error('Error stack:', error.stack);
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
    }).populate('studentId', 'name email');

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

module.exports = router;

