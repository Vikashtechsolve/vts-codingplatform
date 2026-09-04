const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { getOrCreateProgress, loadCurriculum } = require('../utils/courseProgressService');
const { getSignedDownloadUrl } = require('../utils/r2Storage');
const { signMediaToken, DEFAULT_TTL_SEC } = require('../utils/courseMediaToken');

const Course = require('../models/Course');
const CourseLecture = require('../models/CourseLecture');
const CourseVendorAllocation = require('../models/CourseVendorAllocation');
const CourseEnrollment = require('../models/CourseEnrollment');
const CourseProgress = require('../models/CourseProgress');
const User = require('../models/User');
const { moduleHasAssessment, loadModuleAssessmentMeta } = require('../utils/moduleAssessment');
const { registerVendorCourseCms } = require('../utils/vendorCourseCms');
const {
  getActiveAllocation,
  assertVendorCourseAccess,
  resolveAssignableStudents,
  attachStudentProfiles,
} = require('../utils/courseVendorAccess');

async function assessmentMetaForModules(modules) {
  const metas = await Promise.all((modules || []).map((m) => loadModuleAssessmentMeta(m)));
  return new Map(
    (modules || []).map((m, idx) => [String(m._id), metas[idx]]).filter(([, meta]) => meta)
  );
}

function moduleAssessmentPayload(mod, metaMap) {
  const meta = metaMap.get(String(mod._id));
  if (!moduleHasAssessment(mod) || !meta) return { hasQuiz: false, quiz: null, assessment: null };
  return {
    hasQuiz: true,
    assessment: meta,
    quiz: {
      title: meta.title,
      durationMin: meta.durationMin || 0,
      type: meta.kind || meta.type,
      questionCount: meta.questionCount || 0,
      label: meta.label,
    },
  };
}

router.use(auth);
router.use(authorize('vendor_admin'));
router.use(tenantMiddleware);

registerVendorCourseCms(router);

router.get('/', async (req, res) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const allocFilter = { vendorId: req.vendorId, isActive: true };
    const allocations = await CourseVendorAllocation.find(allocFilter)
      .sort({ allocatedAt: -1 })
      .lean();

    const allocatedIds = allocations.map((a) => a.courseId);
    const origin = String(req.query.origin || 'all').toLowerCase();
    const vendorOwned = { source: 'vendor', vendorId: req.vendorId };
    const platformAllocated = {
      _id: { $in: allocatedIds },
      status: 'published',
      source: { $ne: 'vendor' },
    };
    const courseFilter =
      origin === 'vendor'
        ? vendorOwned
        : origin === 'platform'
          ? platformAllocated
          : { $or: [vendorOwned, platformAllocated] };
    if (search) {
      courseFilter.title = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      );
    }

    const [courses, total] = await Promise.all([
      Course.find(courseFilter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(courseFilter),
    ]);

    const allocByCourse = new Map(
      allocations.map((a) => [String(a.courseId), a])
    );

    const enrollmentCounts = await CourseEnrollment.aggregate([
      {
        $match: {
          vendorId: new mongoose.Types.ObjectId(req.vendorId),
          courseId: { $in: courses.map((c) => c._id) },
          status: 'active',
        },
      },
      { $group: { _id: '$courseId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      enrollmentCounts.map((e) => [String(e._id), e.count])
    );

    const items = courses.map((c) => {
      const alloc = allocByCourse.get(String(c._id));
      const owned = c.source === 'vendor' && String(c.vendorId) === String(req.vendorId);
      return {
        ...c,
        canEdit: owned,
        origin: owned ? 'vendor' : 'platform',
        allocation: alloc
          ? {
              dueAt: alloc.dueAt,
              visibility: alloc.visibility,
              allocatedAt: alloc.allocatedAt,
            }
          : null,
        enrolledCount: countMap.get(String(c._id)) || 0,
      };
    });

    res.json(paginatedResponse({ items, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:courseId', async (req, res) => {
  try {
    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum) return res.status(404).json({ message: 'Course not found' });

    const owned =
      curriculum.course.source === 'vendor' &&
      String(curriculum.course.vendorId) === String(req.vendorId);
    const alloc = await getActiveAllocation(req.params.courseId, req.vendorId);

    if (!owned && !alloc) {
      return res.status(404).json({ message: 'Course not allocated to your vendor' });
    }
    if (!owned && curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }

    const enrolledCount = await CourseEnrollment.countDocuments({
      courseId: req.params.courseId,
      vendorId: req.vendorId,
      status: 'active',
    });

    const assessmentMap = await assessmentMetaForModules(curriculum.modules);

    res.json({
      ...curriculum.course,
      canEdit: owned,
      origin: owned ? 'vendor' : 'platform',
      modules: curriculum.modules.map((m) => ({
        _id: m._id,
        title: m.title,
        description: m.description,
        order: m.order,
        testId: m.testId || null,
        interviewId: m.interviewId || null,
        assignmentId: m.assignmentId || null,
        systemDesignProblemId: m.systemDesignProblemId || null,
        ...moduleAssessmentPayload(m, assessmentMap),
        lectureCount: m.lectures.length,
        lectures: m.lectures.map((l) => ({
          _id: l._id,
          title: l.title,
          description: l.description || '',
          order: l.order,
          video: l.video || { status: 'none' },
          videoStatus: l.video?.status || 'none',
          videoDurationSec: l.video?.durationSec || 0,
          notesHtml: l.notesHtml || '',
          notesPdfFileName: l.notesPdfFileName || '',
          notesPdfKey: l.notesPdfKey || null,
          hasNotesPdf: !!l.notesPdfKey,
          hasNotesHtml: !!(l.notesHtml && String(l.notesHtml).trim()),
        })),
      })),
      allocation: alloc
        ? {
            dueAt: alloc.dueAt,
            visibility: alloc.visibility,
            allocatedAt: alloc.allocatedAt,
          }
        : null,
      enrolledCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:courseId/lectures/:lectureId', async (req, res) => {
  try {
    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum) return res.status(404).json({ message: 'Course not found' });

    const owned =
      curriculum.course.source === 'vendor' &&
      String(curriculum.course.vendorId) === String(req.vendorId);
    const alloc = await getActiveAllocation(req.params.courseId, req.vendorId);
    if (!owned && !alloc) return res.status(404).json({ message: 'Course not allocated' });
    if (!owned && curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    }).lean();
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

    const assessmentMap = await assessmentMetaForModules(curriculum.modules);

    res.json({
      course: {
        _id: curriculum.course._id,
        title: curriculum.course.title,
      },
      lecture: {
        _id: lecture._id,
        moduleId: lecture.moduleId,
        title: lecture.title,
        description: lecture.description || '',
        notesHtml: lecture.notesHtml || '',
        hasNotesPdf: !!lecture.notesPdfKey,
        hasNotesHtml: !!(lecture.notesHtml && String(lecture.notesHtml).trim()),
        notesPdfFileName: lecture.notesPdfFileName || '',
        video: {
          status: lecture.video?.status || 'none',
          durationSec: lecture.video?.durationSec || 0,
        },
      },
      modules: curriculum.modules.map((m) => ({
        _id: m._id,
        title: m.title,
        ...moduleAssessmentPayload(m, assessmentMap),
        lectures: (m.lectures || []).map((l) => ({
          _id: l._id,
          title: l.title,
          videoStatus: l.video?.status || 'none',
          hasNotesPdf: !!l.notesPdfKey,
          hasNotesHtml: !!(l.notesHtml && String(l.notesHtml).trim()),
        })),
      })),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:courseId/lectures/:lectureId/playback', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('source vendorId status').lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const owned =
      course.source === 'vendor' && String(course.vendorId) === String(req.vendorId);
    const alloc = await getActiveAllocation(req.params.courseId, req.vendorId);
    if (!owned && !alloc) return res.status(404).json({ message: 'Course not allocated' });
    if (!owned && course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });
    if (lecture.video?.status !== 'ready' || !lecture.video.hlsPrefix) {
      return res.status(400).json({ message: 'Video not ready' });
    }

    const token = signMediaToken({
      studentId: req.user._id,
      courseId: lecture.courseId,
      lectureId: lecture._id,
    });
    const playlistPath = `/courses-media/${lecture.courseId}/lectures/${lecture._id}/master.m3u8?token=${encodeURIComponent(token)}`;

    res.json({
      playlistUrl: playlistPath,
      token,
      expiresIn: DEFAULT_TTL_SEC,
      durationSec: lecture.video.durationSec || 0,
      resumePosition: 0,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:courseId/lectures/:lectureId/notes-pdf', async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId).select('source vendorId status').lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    const owned =
      course.source === 'vendor' && String(course.vendorId) === String(req.vendorId);
    const alloc = await getActiveAllocation(req.params.courseId, req.vendorId);
    if (!owned && !alloc) return res.status(404).json({ message: 'Course not allocated' });
    if (!owned && course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    }).select('notesPdfKey notesPdfFileName').lean();
    if (!lecture?.notesPdfKey) {
      return res.status(404).json({ message: 'Notes PDF not found' });
    }

    const url = await getSignedDownloadUrl(lecture.notesPdfKey, 300);
    res.json({
      url,
      fileName: lecture.notesPdfFileName || 'notes.pdf',
      expiresIn: 300,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/:courseId/settings', async (req, res) => {
  try {
    const access = await assertVendorCourseAccess(req.params.courseId, req.vendorId, req.user._id);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const alloc = access.alloc;

    if (req.body.dueAt !== undefined) {
      alloc.dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;
    }
    if (req.body.visibility != null) {
      if (!['visible', 'hidden'].includes(req.body.visibility)) {
        return res.status(400).json({ message: 'visibility must be visible or hidden' });
      }
      alloc.visibility = req.body.visibility;
    }
    await alloc.save();
    res.json({
      dueAt: alloc.dueAt,
      visibility: alloc.visibility,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * Assign course to students and/or classrooms (idempotent).
 * Body: { studentIds?: [], classroomIds?: [], dueAt?: ISO }
 */
router.post('/:courseId/assign', async (req, res) => {
  try {
    const access = await assertVendorCourseAccess(req.params.courseId, req.vendorId, req.user._id);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const alloc = access.alloc;

    // Assigning students should make the course startable for them.
    // Some self-allocation records can exist with visibility = hidden.
    if (alloc.visibility !== 'visible') {
      alloc.visibility = 'visible';
      await alloc.save();
    }

    const course = await Course.findById(req.params.courseId);
    if (!course || course.status !== 'published') {
      return res.status(400).json({ message: 'Course is not published' });
    }

    const classroomIds = (req.body.classroomIds || []).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    // Includes classroom members even when their user record is missing
    // vendorId (legacy accounts) — the util backfills it.
    const students = await resolveAssignableStudents(req.vendorId, {
      studentIds: req.body.studentIds || [],
      classroomIds,
    });

    if (!students.length) {
      return res.status(400).json({ message: 'No students to assign' });
    }

    const dueAt = req.body.dueAt
      ? new Date(req.body.dueAt)
      : alloc.dueAt || null;

    let created = 0;
    let reactivated = 0;
    for (const student of students) {
      let enrollment = await CourseEnrollment.findOne({
        courseId: course._id,
        studentId: student._id,
      });

      if (enrollment) {
        if (enrollment.status !== 'active') {
          enrollment.status = 'active';
          enrollment.assignedBy = req.user._id;
          enrollment.assignedAt = new Date();
          enrollment.vendorId = req.vendorId;
          enrollment.dueAt = dueAt;
          enrollment.source = classroomIds.length ? 'classroom' : 'individual';
          enrollment.classroomId = classroomIds[0] || null;
          await enrollment.save();
          reactivated += 1;
        }
      } else {
        enrollment = await CourseEnrollment.create({
          courseId: course._id,
          vendorId: req.vendorId,
          studentId: student._id,
          source: classroomIds.length ? 'classroom' : 'individual',
          classroomId: classroomIds[0] || null,
          assignedBy: req.user._id,
          dueAt,
          status: 'active',
        });
        created += 1;
      }

      await getOrCreateProgress(enrollment);
    }

    res.json({
      success: true,
      assigned: students.length,
      created,
      reactivated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:courseId/unassign', async (req, res) => {
  try {
    const access = await assertVendorCourseAccess(req.params.courseId, req.vendorId, req.user._id);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const studentIds = (req.body.studentIds || []).filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    if (!studentIds.length) {
      return res.status(400).json({ message: 'studentIds required' });
    }

    const result = await CourseEnrollment.updateMany(
      {
        courseId: req.params.courseId,
        vendorId: req.vendorId,
        studentId: { $in: studentIds },
        status: 'active',
      },
      { $set: { status: 'revoked' } }
    );

    res.json({ success: true, modified: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:courseId/enrollments', async (req, res) => {
  try {
    const access = await assertVendorCourseAccess(req.params.courseId, req.vendorId, req.user._id);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const filter = {
      courseId: req.params.courseId,
      vendorId: req.vendorId,
      status: 'active',
    };

    let studentIdFilter = null;
    if (search) {
      const users = await User.find({
        vendorId: req.vendorId,
        role: 'student',
        $or: [
          { name: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { email: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        ],
      })
        .select('_id')
        .limit(200)
        .lean();
      studentIdFilter = users.map((u) => u._id);
      filter.studentId = { $in: studentIdFilter };
    }

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.find(filter)
        .sort({ assignedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CourseEnrollment.countDocuments(filter),
    ]);

    const progressDocs = await CourseProgress.find({
      enrollmentId: { $in: enrollments.map((e) => e._id) },
    })
      .select('enrollmentId percentComplete completedAt currentModuleId')
      .lean();
    const progressMap = new Map(
      progressDocs.map((p) => [String(p.enrollmentId), p])
    );

    const withStudents = await attachStudentProfiles(enrollments);
    const items = withStudents.map((e) => ({
      ...e,
      progress: progressMap.get(String(e._id)) || null,
    }));

    // Summary must only count students who are still actively enrolled —
    // progress docs of unassigned (revoked) students would skew the numbers
    const activeEnrollmentIds = await CourseEnrollment.find({
      courseId: req.params.courseId,
      vendorId: req.vendorId,
      status: 'active',
    })
      .select('_id')
      .lean();

    const progressAgg = await CourseProgress.aggregate([
      {
        $match: {
          courseId: new mongoose.Types.ObjectId(req.params.courseId),
          vendorId: new mongoose.Types.ObjectId(req.vendorId),
          enrollmentId: { $in: activeEnrollmentIds.map((e) => e._id) },
        },
      },
      {
        $group: {
          _id: null,
          avgProgress: { $avg: '$percentComplete' },
          completed: {
            $sum: { $cond: [{ $gte: ['$percentComplete', 100] }, 1, 0] },
          },
          inProgress: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ['$percentComplete', 0] },
                    { $lt: ['$percentComplete', 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notStarted: {
            $sum: { $cond: [{ $lte: ['$percentComplete', 0] }, 1, 0] },
          },
        },
      },
    ]);
    const agg = progressAgg[0] || {};
    const summary = {
      enrolled: total,
      avgProgress: Math.round(agg.avgProgress || 0),
      completed: agg.completed || 0,
      inProgress: agg.inProgress || 0,
      notStarted: Math.max(0, total - (agg.completed || 0) - (agg.inProgress || 0)),
    };

    res.json({ ...paginatedResponse({ items, page, limit, total }), summary });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
