const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const Classroom = require('../models/Classroom');
const User = require('../models/User');
const Test = require('../models/Test');

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

// Get all classrooms
router.get('/', async (req, res) => {
  try {
    console.log('📥 Fetching classrooms for vendor:', req.vendorId);
    const classrooms = await Classroom.find({ vendorId: req.vendorId, isActive: true })
      .populate('students', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${classrooms.length} classrooms`);
    res.json(classrooms);
  } catch (error) {
    console.error('❌ Error fetching classrooms:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single classroom
router.get('/:id', async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    })
      .populate('students', 'name email')
      .populate('assignedTests.testId', 'title type duration')
      .populate('assignedTests.assignedBy', 'name email');

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    res.json(classroom);
  } catch (error) {
    console.error('❌ Error fetching classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create classroom
router.post('/', [
  body('name').trim().notEmpty().withMessage('Classroom name is required'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    // Check if classroom name already exists for this vendor
    const existingClassroom = await Classroom.findOne({
      name: name.trim(),
      vendorId: req.vendorId,
      isActive: true
    });

    if (existingClassroom) {
      return res.status(400).json({ message: 'Classroom with this name already exists' });
    }

    const classroom = new Classroom({
      name: name.trim(),
      description: description?.trim() || '',
      vendorId: req.vendorId,
      createdBy: req.user._id,
      students: [],
      assignedTests: [],
      isActive: true
    });

    await classroom.save();
    console.log(`✅ Classroom created: ${classroom.name} (${classroom._id})`);

    const populatedClassroom = await Classroom.findById(classroom._id)
      .populate('createdBy', 'name email');

    res.status(201).json(populatedClassroom);
  } catch (error) {
    console.error('❌ Error creating classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update classroom
router.put('/:id', [
  body('name').optional().trim().notEmpty().withMessage('Classroom name cannot be empty'),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const { name, description } = req.body;

    if (name && name.trim() !== classroom.name) {
      // Check if new name already exists
      const existingClassroom = await Classroom.findOne({
        name: name.trim(),
        vendorId: req.vendorId,
        isActive: true,
        _id: { $ne: req.params.id }
      });

      if (existingClassroom) {
        return res.status(400).json({ message: 'Classroom with this name already exists' });
      }

      classroom.name = name.trim();
    }

    if (description !== undefined) {
      classroom.description = description?.trim() || '';
    }

    await classroom.save();
    console.log(`✅ Classroom updated: ${classroom.name}`);

    const updatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'name email')
      .populate('createdBy', 'name email');

    res.json(updatedClassroom);
  } catch (error) {
    console.error('❌ Error updating classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete classroom (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    classroom.isActive = false;
    await classroom.save();
    console.log(`✅ Classroom deleted: ${classroom.name}`);

    res.json({ message: 'Classroom deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk add students to classroom (by email or create new)
router.post('/:id/students/bulk', [
  body('students').isArray().withMessage('students must be an array'),
  body('students.*.name').optional().trim(),
  body('students.*.email').isEmail().withMessage('Invalid email format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const { students } = req.body; // Array of {name, email, password}
    const addedStudents = [];
    const skippedStudents = [];
    const createdStudents = [];

    for (const studentData of students) {
      const normalizedEmail = studentData.email.toLowerCase().trim();
      
      // Check if student exists
      let student = await User.findOne({
        email: normalizedEmail,
        vendorId: req.vendorId,
        role: 'student'
      });

      // Create student if doesn't exist
      if (!student) {
        if (!studentData.name) {
          skippedStudents.push({
            email: normalizedEmail,
            reason: 'Name required for new students'
          });
          continue;
        }

        student = new User({
          name: studentData.name.trim(),
          email: normalizedEmail,
          password: studentData.password || 'student123',
          role: 'student',
          vendorId: req.vendorId,
          isActive: true
        });
        await student.save();
        createdStudents.push({ id: student._id, name: student.name, email: student.email });
      }

      // Check if already in classroom
      const existingStudentIds = classroom.students.map(id => id.toString());
      if (existingStudentIds.includes(student._id.toString())) {
        skippedStudents.push({
          email: normalizedEmail,
          reason: 'Already in classroom'
        });
        continue;
      }

      // Add to classroom
      classroom.students.push(student._id);
      addedStudents.push({ id: student._id, name: student.name, email: student.email });
    }

    await classroom.save();

    console.log(`✅ Bulk added ${addedStudents.length} students to classroom: ${classroom.name}`);

    const updatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'name email');

    res.json({
      message: `${addedStudents.length} student(s) added successfully`,
      added: addedStudents,
      created: createdStudents,
      skipped: skippedStudents,
      classroom: updatedClassroom
    });
  } catch (error) {
    console.error('❌ Error bulk adding students to classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add students to classroom
router.post('/:id/students', [
  body('studentIds').isArray().withMessage('studentIds must be an array'),
  body('studentIds.*').isMongoId().withMessage('Invalid student ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const { studentIds } = req.body;

    // Verify all students belong to this vendor
    const students = await User.find({
      _id: { $in: studentIds },
      vendorId: req.vendorId,
      role: 'student'
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: 'Some students not found or do not belong to this vendor' });
    }

    // Add students (avoid duplicates)
    const existingStudentIds = classroom.students.map(id => id.toString());
    const newStudentIds = studentIds.filter(id => !existingStudentIds.includes(id.toString()));

    if (newStudentIds.length === 0) {
      return res.status(400).json({ message: 'All students are already in this classroom' });
    }

    classroom.students.push(...newStudentIds);
    await classroom.save();

    console.log(`✅ Added ${newStudentIds.length} students to classroom: ${classroom.name}`);

    const updatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'name email');

    res.json({
      message: `${newStudentIds.length} student(s) added successfully`,
      classroom: updatedClassroom
    });
  } catch (error) {
    console.error('❌ Error adding students to classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove student from classroom
router.delete('/:id/students/:studentId', async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    classroom.students = classroom.students.filter(
      id => id.toString() !== req.params.studentId
    );

    await classroom.save();
    console.log(`✅ Removed student from classroom: ${classroom.name}`);

    const updatedClassroom = await Classroom.findById(classroom._id)
      .populate('students', 'name email');

    res.json({
      message: 'Student removed successfully',
      classroom: updatedClassroom
    });
  } catch (error) {
    console.error('❌ Error removing student from classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Assign test to classroom
router.post('/:id/tests/:testId', async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    const test = await Test.findOne({
      _id: req.params.testId,
      vendorId: req.vendorId
    });

    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    // Check if test is already assigned
    const alreadyAssigned = classroom.assignedTests.some(
      at => at.testId.toString() === req.params.testId
    );

    if (alreadyAssigned) {
      return res.status(400).json({ message: 'Test is already assigned to this classroom' });
    }

    // Add test to classroom's assigned tests
    classroom.assignedTests.push({
      testId: test._id,
      assignedAt: new Date(),
      assignedBy: req.user._id
    });

    await classroom.save();

    // Assign test to all students in the classroom
    const enrolledCount = await assignTestToStudents(test._id, classroom.students, req.vendorId);

    console.log(`✅ Test assigned to classroom: ${classroom.name}, ${enrolledCount} students enrolled`);

    const updatedClassroom = await Classroom.findById(classroom._id)
      .populate('assignedTests.testId', 'title type duration')
      .populate('assignedTests.assignedBy', 'name email');

    res.json({
      message: `Test assigned successfully to ${enrolledCount} student(s)`,
      classroom: updatedClassroom
    });
  } catch (error) {
    console.error('❌ Error assigning test to classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove test from classroom
router.delete('/:id/tests/:testId', async (req, res) => {
  try {
    const classroom = await Classroom.findOne({
      _id: req.params.id,
      vendorId: req.vendorId
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found' });
    }

    classroom.assignedTests = classroom.assignedTests.filter(
      at => at.testId.toString() !== req.params.testId
    );

    await classroom.save();
    console.log(`✅ Test removed from classroom: ${classroom.name}`);

    const updatedClassroom = await Classroom.findById(classroom._id)
      .populate('assignedTests.testId', 'title type duration');

    res.json({
      message: 'Test removed successfully',
      classroom: updatedClassroom
    });
  } catch (error) {
    console.error('❌ Error removing test from classroom:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to assign test to students
async function assignTestToStudents(testId, studentIds, vendorId) {
  let enrolledCount = 0;

  for (const studentId of studentIds) {
    try {
      const student = await User.findById(studentId);
      if (!student || student.vendorId.toString() !== vendorId.toString()) {
        continue;
      }

      // Check if test is already assigned
      const existingEnrollment = student.enrolledTests.find(
        et => et.testId.toString() === testId.toString()
      );

      if (!existingEnrollment) {
        student.enrolledTests.push({
          testId: testId,
          assignedAt: new Date(),
          status: 'assigned'
        });
        await student.save();
        enrolledCount++;
      }
    } catch (error) {
      console.error(`❌ Error enrolling student ${studentId}:`, error);
    }
  }

  return enrolledCount;
}

module.exports = router;

