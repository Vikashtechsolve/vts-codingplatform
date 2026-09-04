const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { auth, authorize } = require('../middleware/auth');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const { uniqueCourseSlug } = require('../utils/courseSlug');
const { getSignedUploadUrl, deleteFromR2, deletePrefixFromR2 } = require('../utils/r2Storage');
const { loadCurriculum } = require('../utils/courseProgressService');

const Course = require('../models/Course');
const CourseModule = require('../models/CourseModule');
const CourseLecture = require('../models/CourseLecture');
const CourseVendorAllocation = require('../models/CourseVendorAllocation');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');
const Vendor = require('../models/Vendor');

function clearModuleAssessments(mod) {
  mod.testId = null;
  mod.interviewId = null;
  mod.assignmentId = null;
  mod.systemDesignProblemId = null;
}

async function resolveModuleAssessment(mod) {
  if (mod.testId) {
    const test = await Test.findById(mod.testId).lean();
    if (!test) return null;
    const populated = await populateTestQuestionsForAdmin(test);
    return { type: 'test', item: populated };
  }
  if (mod.interviewId) {
    const interview = await Interview.findById(mod.interviewId)
      .populate('questions.questionId')
      .lean();
    return interview ? { type: 'interview', item: interview } : null;
  }
  if (mod.assignmentId) {
    const assignment = await Assignment.findById(mod.assignmentId).lean();
    return assignment ? { type: 'assignment', item: assignment } : null;
  }
  if (mod.systemDesignProblemId) {
    const problem = await SystemDesignProblem.findById(mod.systemDesignProblemId)
      .select('-referenceAnswer')
      .lean();
    return problem ? { type: 'system_design', item: problem } : null;
  }
  return null;
}

router.use(auth);
router.use(authorize('super_admin'));

function badRequest(res, errors) {
  return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
}

async function getModuleOr404(courseId, moduleId, res) {
  const mod = await CourseModule.findOne({ _id: moduleId, courseId });
  if (!mod) {
    res.status(404).json({ message: 'Module not found' });
    return null;
  }
  return mod;
}

const QUESTION_MODELS = {
  mcq: () => require('../models/MCQQuestion'),
  coding: () => require('../models/CodingQuestion'),
  aptitude: () => require('../models/AptitudeQuestion'),
  theory: () => require('../models/TheoryQuestion'),
  sql: () => require('../models/SQLQuestion'),
};

async function populateTestQuestionsForAdmin(test) {
  if (!test) return null;
  const plain = typeof test.toObject === 'function' ? test.toObject() : { ...test };
  if (!plain.questions?.length) {
    return { ...plain, questions: [] };
  }

  const idsByType = {};
  for (const q of plain.questions) {
    const key = q.type;
    if (!idsByType[key]) idsByType[key] = [];
    idsByType[key].push(q.questionId);
  }

  const labelMap = new Map();
  await Promise.all(
    Object.entries(idsByType).map(async ([type, ids]) => {
      const getModel = QUESTION_MODELS[type];
      if (!getModel) return;
      const Model = getModel();
      const docs = await Model.find({ _id: { $in: ids } })
        .select('title question text')
        .lean();
      for (const doc of docs) {
        const label = doc.title || doc.question || doc.text || 'Question';
        labelMap.set(String(doc._id), label);
      }
    })
  );

  return {
    ...plain,
    questions: plain.questions.map((q, idx) => ({
      type: q.type,
      questionId: q.questionId,
      questionType: q.questionType,
      points: q.points ?? 10,
      order: q.order ?? idx + 1,
      label: labelMap.get(String(q.questionId)) || `${q.type} question`,
    })),
  };
}

async function getCourseOr404(id, res) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ message: 'Invalid course id' });
    return null;
  }
  const course = await Course.findById(id);
  if (!course) {
    res.status(404).json({ message: 'Course not found' });
    return null;
  }
  return course;
}

// ── List / create courses ───────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const { page, limit, skip, search } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (search) {
      filter.$or = [
        { title: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { slug: new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      Course.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Course.countDocuments(filter),
    ]);

    res.json(paginatedResponse({ items, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().isString(),
    body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
    body('estimatedHours').optional().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const slug = await uniqueCourseSlug(Course, req.body.title);
      const course = await Course.create({
        title: req.body.title.trim(),
        slug,
        description: req.body.description || '',
        level: req.body.level || 'beginner',
        estimatedHours: req.body.estimatedHours || 0,
        status: 'draft',
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      res.status(201).json(course);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.get('/:courseId', async (req, res) => {
  try {
    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum) return res.status(404).json({ message: 'Course not found' });

    const allocations = await CourseVendorAllocation.find({
      courseId: req.params.courseId,
      isActive: true,
    })
      .populate('vendorId', 'name companyName email')
      .lean();

    res.json({ ...curriculum.course, modules: curriculum.modules, allocations });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch(
  '/:courseId',
  [
    body('title').optional().trim().notEmpty(),
    body('status').optional().isIn(['draft', 'published', 'archived']),
    body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const course = await getCourseOr404(req.params.courseId, res);
      if (!course) return;

      const { title, description, level, estimatedHours, status } = req.body;
      if (title != null) {
        course.title = title.trim();
        course.slug = await uniqueCourseSlug(Course, title, course._id);
      }
      if (description != null) course.description = description;
      if (level != null) course.level = level;
      if (estimatedHours != null) course.estimatedHours = estimatedHours;
      if (status != null) {
        if (status === 'published' && !(course.moduleOrder?.length > 0)) {
          const modCount = await CourseModule.countDocuments({ courseId: course._id });
          if (modCount === 0) {
            return res.status(400).json({ message: 'Add at least one module before publishing' });
          }
        }
        course.status = status;
      }
      if (req.body.unlockMode != null) {
        if (!['sequential', 'open'].includes(req.body.unlockMode)) {
          return res.status(400).json({ message: 'unlockMode must be sequential or open' });
        }
        course.unlockMode = req.body.unlockMode;
      }
      course.updatedBy = req.user._id;
      await course.save();
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/:courseId', async (req, res) => {
  try {
    const course = await getCourseOr404(req.params.courseId, res);
    if (!course) return;

    const lectures = await CourseLecture.find({ courseId: course._id }).select(
      'video.originalKey video.hlsPrefix notesPdfKey'
    );
    for (const lec of lectures) {
      if (lec.video?.originalKey) await deleteFromR2(lec.video.originalKey);
      if (lec.video?.hlsPrefix) await deletePrefixFromR2(lec.video.hlsPrefix);
      if (lec.notesPdfKey) await deleteFromR2(lec.notesPdfKey);
    }
    if (course.coverKey) await deleteFromR2(course.coverKey);

    await Promise.all([
      CourseLecture.deleteMany({ courseId: course._id }),
      CourseModule.deleteMany({ courseId: course._id }),
      CourseVendorAllocation.deleteMany({ courseId: course._id }),
      Course.deleteOne({ _id: course._id }),
    ]);

    res.json({ success: true, message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Modules ─────────────────────────────────────────────────────────

router.post(
  '/:courseId/modules',
  [body('title').trim().notEmpty().withMessage('Title is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const course = await getCourseOr404(req.params.courseId, res);
      if (!course) return;

      const maxOrder = await CourseModule.findOne({ courseId: course._id })
        .sort({ order: -1 })
        .select('order')
        .lean();
      const order = (maxOrder?.order ?? -1) + 1;

      const mod = await CourseModule.create({
        courseId: course._id,
        title: req.body.title.trim(),
        description: req.body.description || '',
        order,
      });

      course.moduleOrder.push(mod._id);
      course.updatedBy = req.user._id;
      await course.save();

      res.status(201).json(mod);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.patch('/:courseId/modules/:moduleId', async (req, res) => {
  try {
    const mod = await CourseModule.findOne({
      _id: req.params.moduleId,
      courseId: req.params.courseId,
    });
    if (!mod) return res.status(404).json({ message: 'Module not found' });

    if (req.body.title != null) mod.title = String(req.body.title).trim();
    if (req.body.description != null) mod.description = req.body.description;
    await mod.save();
    res.json(mod);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:courseId/modules/:moduleId', async (req, res) => {
  try {
    const course = await getCourseOr404(req.params.courseId, res);
    if (!course) return;

    const mod = await CourseModule.findOne({
      _id: req.params.moduleId,
      courseId: course._id,
    });
    if (!mod) return res.status(404).json({ message: 'Module not found' });

    const lectures = await CourseLecture.find({ moduleId: mod._id });
    for (const lec of lectures) {
      if (lec.video?.originalKey) await deleteFromR2(lec.video.originalKey);
      if (lec.video?.hlsPrefix) await deletePrefixFromR2(lec.video.hlsPrefix);
      if (lec.notesPdfKey) await deleteFromR2(lec.notesPdfKey);
    }
    await CourseLecture.deleteMany({ moduleId: mod._id });
    await CourseModule.deleteOne({ _id: mod._id });

    course.moduleOrder = course.moduleOrder.filter(
      (id) => String(id) !== String(mod._id)
    );
    course.updatedBy = req.user._id;
    await course.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:courseId/modules/reorder', async (req, res) => {
  try {
    const course = await getCourseOr404(req.params.courseId, res);
    if (!course) return;

    const { moduleIds } = req.body;
    if (!Array.isArray(moduleIds) || !moduleIds.length) {
      return res.status(400).json({ message: 'moduleIds array required' });
    }

    const existing = await CourseModule.find({ courseId: course._id }).select('_id');
    const existingSet = new Set(existing.map((m) => String(m._id)));
    if (
      moduleIds.length !== existingSet.size ||
      moduleIds.some((id) => !existingSet.has(String(id)))
    ) {
      return res.status(400).json({ message: 'moduleIds must match all modules' });
    }

    course.moduleOrder = moduleIds;
    await course.save();
    await Promise.all(
      moduleIds.map((id, index) =>
        CourseModule.updateOne({ _id: id }, { $set: { order: index } })
      )
    );
    res.json({ success: true, moduleOrder: course.moduleOrder });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Lectures ────────────────────────────────────────────────────────

router.post(
  '/:courseId/modules/:moduleId/lectures',
  [body('title').trim().notEmpty().withMessage('Title is required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const mod = await CourseModule.findOne({
        _id: req.params.moduleId,
        courseId: req.params.courseId,
      });
      if (!mod) return res.status(404).json({ message: 'Module not found' });

      const maxOrder = await CourseLecture.findOne({ moduleId: mod._id })
        .sort({ order: -1 })
        .select('order')
        .lean();
      const order = (maxOrder?.order ?? -1) + 1;

      const lecture = await CourseLecture.create({
        courseId: req.params.courseId,
        moduleId: mod._id,
        title: req.body.title.trim(),
        description: req.body.description || '',
        order,
        notesHtml: req.body.notesHtml || '',
      });

      mod.lectureOrder.push(lecture._id);
      await mod.save();

      res.status(201).json(lecture);
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.patch('/:courseId/lectures/:lectureId', async (req, res) => {
  try {
    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

    if (req.body.title != null) lecture.title = String(req.body.title).trim();
    if (req.body.description != null) lecture.description = req.body.description;
    if (req.body.notesHtml != null) lecture.notesHtml = req.body.notesHtml;
    await lecture.save();
    res.json(lecture);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:courseId/lectures/:lectureId', async (req, res) => {
  try {
    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

    if (lecture.video?.originalKey) await deleteFromR2(lecture.video.originalKey);
    if (lecture.video?.hlsPrefix) await deletePrefixFromR2(lecture.video.hlsPrefix);
    if (lecture.notesPdfKey) await deleteFromR2(lecture.notesPdfKey);

    await CourseModule.updateOne(
      { _id: lecture.moduleId },
      { $pull: { lectureOrder: lecture._id } }
    );
    await CourseLecture.deleteOne({ _id: lecture._id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:courseId/modules/:moduleId/lectures/reorder', async (req, res) => {
  try {
    const mod = await CourseModule.findOne({
      _id: req.params.moduleId,
      courseId: req.params.courseId,
    });
    if (!mod) return res.status(404).json({ message: 'Module not found' });

    const { lectureIds } = req.body;
    if (!Array.isArray(lectureIds)) {
      return res.status(400).json({ message: 'lectureIds array required' });
    }

    const existing = await CourseLecture.find({ moduleId: mod._id }).select('_id');
    const existingSet = new Set(existing.map((l) => String(l._id)));
    if (
      lectureIds.length !== existingSet.size ||
      lectureIds.some((id) => !existingSet.has(String(id)))
    ) {
      return res.status(400).json({ message: 'lectureIds must match all lectures' });
    }

    mod.lectureOrder = lectureIds;
    await mod.save();
    await Promise.all(
      lectureIds.map((id, index) =>
        CourseLecture.updateOne({ _id: id }, { $set: { order: index } })
      )
    );
    res.json({ success: true, lectureOrder: mod.lectureOrder });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Media upload URLs ───────────────────────────────────────────────

router.post(
  '/:courseId/lectures/:lectureId/video/upload-url',
  [
    body('fileName').trim().notEmpty(),
    body('contentType').trim().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const lecture = await CourseLecture.findOne({
        _id: req.params.lectureId,
        courseId: req.params.courseId,
      });
      if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

      const ext = (req.body.fileName.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase();
      const key = `courses/${lecture.courseId}/lectures/${lecture._id}/original${ext}`;

      if (lecture.video?.originalKey && lecture.video.originalKey !== key) {
        await deleteFromR2(lecture.video.originalKey);
      }

      const uploadUrl = await getSignedUploadUrl(key, req.body.contentType, 900);
      lecture.video = {
        ...lecture.video?.toObject?.() || lecture.video || {},
        originalKey: key,
        originalFileName: req.body.fileName,
        contentType: req.body.contentType,
        status: 'uploading',
        errorMessage: null,
      };
      await lecture.save();

      res.json({ uploadUrl, key, expiresIn: 900 });
    } catch (error) {
      res.status(500).json({
        message: error.message || 'Failed to create upload URL',
        error: error.message,
      });
    }
  }
);

router.post('/:courseId/lectures/:lectureId/video/complete', async (req, res) => {
  try {
    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });
    if (!lecture.video?.originalKey) {
      return res.status(400).json({ message: 'No video upload in progress' });
    }

    lecture.video.status = 'processing';
    await lecture.save();

    try {
      const { enqueueHlsTranscode } = require('../workers/hlsTranscodeWorker');
      await enqueueHlsTranscode(lecture._id);
    } catch (queueErr) {
      lecture.video.status = 'failed';
      lecture.video.errorMessage = `Queue unavailable: ${queueErr.message}`;
      await lecture.save();
      return res.status(503).json({
        message: 'Video uploaded but transcode queue unavailable',
        error: queueErr.message,
        lecture,
      });
    }

    res.json({ success: true, lecture });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post(
  '/:courseId/lectures/:lectureId/notes-pdf/upload-url',
  [
    body('fileName').trim().notEmpty(),
    body('contentType').optional().isString(),
  ],
  async (req, res) => {
    try {
      const lecture = await CourseLecture.findOne({
        _id: req.params.lectureId,
        courseId: req.params.courseId,
      });
      if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

      const key = `courses/${lecture.courseId}/lectures/${lecture._id}/notes.pdf`;
      if (lecture.notesPdfKey && lecture.notesPdfKey !== key) {
        await deleteFromR2(lecture.notesPdfKey);
      }

      const contentType = req.body.contentType || 'application/pdf';
      const uploadUrl = await getSignedUploadUrl(key, contentType, 900);
      lecture.notesPdfKey = key;
      lecture.notesPdfFileName = req.body.fileName;
      await lecture.save();

      res.json({ uploadUrl, key, expiresIn: 900 });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.post(
  '/:courseId/cover/upload-url',
  [body('fileName').trim().notEmpty(), body('contentType').trim().notEmpty()],
  async (req, res) => {
    try {
      const course = await getCourseOr404(req.params.courseId, res);
      if (!course) return;

      const ext = (req.body.fileName.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase();
      const key = `courses/${course._id}/cover${ext}`;
      if (course.coverKey && course.coverKey !== key) await deleteFromR2(course.coverKey);

      const uploadUrl = await getSignedUploadUrl(key, req.body.contentType, 900);
      course.coverKey = key;
      await course.save();
      res.json({ uploadUrl, key, expiresIn: 900 });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ── Module quiz attach / create / manage ─────────────────────────────

router.get('/:courseId/modules/:moduleId/test', async (req, res) => {
  try {
    const mod = await getModuleOr404(req.params.courseId, req.params.moduleId, res);
    if (!mod) return;
    if (!mod.testId) return res.json({ test: null });

    const test = await Test.findById(mod.testId).lean();
    if (!test) {
      mod.testId = null;
      await mod.save();
      return res.json({ test: null });
    }

    const populated = await populateTestQuestionsForAdmin(test);
    res.json({ test: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:courseId/modules/:moduleId/test', async (req, res) => {
  try {
    const mod = await getModuleOr404(req.params.courseId, req.params.moduleId, res);
    if (!mod) return;

    const { testId, create, update } = req.body;

    if (update && typeof update === 'object') {
      if (!mod.testId) {
        return res.status(404).json({ message: 'No quiz linked to this module' });
      }
      const test = await Test.findById(mod.testId);
      if (!test) {
        mod.testId = null;
        await mod.save();
        return res.status(404).json({ message: 'Quiz test not found' });
      }

      if (update.title != null) test.title = String(update.title).trim();
      if (update.duration != null) test.duration = Number(update.duration);
      if (Array.isArray(update.questions)) {
        if (!update.questions.length) {
          return res.status(400).json({ message: 'Quiz must have at least one question' });
        }
        test.questions = update.questions.map((q, index) => ({
          type: q.type,
          questionId: q.questionId,
          questionType: q.questionType,
          points: q.points ?? 10,
          order: index + 1,
        }));
      }
      if (Array.isArray(update.appendQuestions) && update.appendQuestions.length) {
        const existing = new Set(
          test.questions.map((q) => `${q.type}:${String(q.questionId)}`)
        );
        for (const q of update.appendQuestions) {
          const key = `${q.type}:${String(q.questionId)}`;
          if (existing.has(key)) continue;
          existing.add(key);
          test.questions.push({
            type: q.type,
            questionId: q.questionId,
            questionType: q.questionType,
            points: q.points ?? 10,
            order: test.questions.length + 1,
          });
        }
        test.questions.forEach((q, index) => {
          q.order = index + 1;
        });
      }

      await test.save();
      const populated = await populateTestQuestionsForAdmin(test);
      return res.json({ module: mod, test: populated });
    }

    if (testId) {
      const test = await Test.findById(testId);
      if (!test) return res.status(404).json({ message: 'Test not found' });
      clearModuleAssessments(mod);
      mod.testId = test._id;
      await mod.save();
      const populated = await populateTestQuestionsForAdmin(test);
      return res.json({ module: mod, test: populated });
    }

    if (create && typeof create === 'object') {
      const {
        title,
        description,
        type,
        duration,
        questions,
        settings,
      } = create;
      if (!title || !type || !duration || !Array.isArray(questions) || !questions.length) {
        return res.status(400).json({
          message: 'create requires title, type, duration, and questions[] from the bank',
        });
      }

      const test = await Test.create({
        title,
        description: description || '',
        type,
        duration,
        questions,
        settings: {
          allowMultipleAttempts: false,
          showResults: true,
          resultDisplay: 'detailed',
          shuffleQuestions: false,
          practiceMode: false,
          ...(settings || {}),
        },
        source: 'course_module',
        courseId: req.params.courseId,
        courseModuleId: mod._id,
        vendorId: null,
        createdBy: req.user._id,
        isActive: true,
      });

      clearModuleAssessments(mod);
      mod.testId = test._id;
      await mod.save();
      const populated = await populateTestQuestionsForAdmin(test);
      return res.status(201).json({ module: mod, test: populated });
    }

    if (testId === null || req.body.clear === true) {
      clearModuleAssessments(mod);
      await mod.save();
      return res.json({ module: mod, test: null });
    }

    return res.status(400).json({ message: 'Provide testId, create payload, or clear: true' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Module assessment attach (platform interviews, projects, system design) ──

router.get('/:courseId/modules/:moduleId/assessment', async (req, res) => {
  try {
    const mod = await getModuleOr404(req.params.courseId, req.params.moduleId, res);
    if (!mod) return;
    const assessment = await resolveModuleAssessment(mod);
    res.json({ assessment });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:courseId/modules/:moduleId/assessment', async (req, res) => {
  try {
    const mod = await getModuleOr404(req.params.courseId, req.params.moduleId, res);
    if (!mod) return;

    if (req.body.clear === true) {
      clearModuleAssessments(mod);
      await mod.save();
      return res.json({ module: mod, assessment: null });
    }

    const { type, assessmentId } = req.body;
    if (!type || !assessmentId) {
      return res.status(400).json({ message: 'Provide type and assessmentId, or clear: true' });
    }

    clearModuleAssessments(mod);

    if (type === 'test') {
      const test = await Test.findById(assessmentId);
      if (!test) return res.status(404).json({ message: 'Test not found' });
      mod.testId = test._id;
    } else if (type === 'interview') {
      const interview = await Interview.findOne({ _id: assessmentId, source: 'platform' });
      if (!interview) {
        return res.status(404).json({ message: 'Platform interview not found' });
      }
      mod.interviewId = interview._id;
    } else if (type === 'assignment') {
      const assignment = await Assignment.findOne({ _id: assessmentId, source: 'platform' });
      if (!assignment) {
        return res.status(404).json({ message: 'Platform assignment not found' });
      }
      mod.assignmentId = assignment._id;
    } else if (type === 'system_design') {
      const problem = await SystemDesignProblem.findOne({
        _id: assessmentId,
        source: 'platform',
      });
      if (!problem) {
        return res.status(404).json({ message: 'Platform system design problem not found' });
      }
      mod.systemDesignProblemId = problem._id;
    } else {
      return res.status(400).json({ message: 'Invalid assessment type' });
    }

    await mod.save();
    const assessment = await resolveModuleAssessment(mod);
    res.json({ module: mod, assessment });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ── Vendor allocation ───────────────────────────────────────────────

router.get('/:courseId/allocations', async (req, res) => {
  try {
    const items = await CourseVendorAllocation.find({ courseId: req.params.courseId })
      .populate('vendorId', 'name companyName email isActive')
      .sort({ allocatedAt: -1 })
      .lean();
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post(
  '/:courseId/allocations',
  [body('vendorIds').isArray({ min: 1 }).withMessage('vendorIds required')],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return badRequest(res, errors);

      const course = await getCourseOr404(req.params.courseId, res);
      if (!course) return;
      if (course.status !== 'published') {
        return res.status(400).json({ message: 'Publish the course before allocating' });
      }

      const vendorIds = req.body.vendorIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );
      const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select('_id');
      const found = new Set(vendors.map((v) => String(v._id)));

      const results = [];
      for (const vendorId of vendorIds) {
        if (!found.has(String(vendorId))) continue;
        const doc = await CourseVendorAllocation.findOneAndUpdate(
          { courseId: course._id, vendorId },
          {
            $set: {
              isActive: true,
              allocatedBy: req.user._id,
              allocatedAt: new Date(),
            },
            $setOnInsert: {
              visibility: 'visible',
              dueAt: null,
            },
          },
          { upsert: true, new: true }
        );
        results.push(doc);
      }

      res.status(201).json({ items: results });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

router.delete('/:courseId/allocations/:vendorId', async (req, res) => {
  try {
    const doc = await CourseVendorAllocation.findOneAndUpdate(
      { courseId: req.params.courseId, vendorId: req.params.vendorId },
      { $set: { isActive: false } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Allocation not found' });
    res.json({ success: true, allocation: doc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
