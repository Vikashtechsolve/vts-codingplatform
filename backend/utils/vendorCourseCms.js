const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { uniqueCourseSlug } = require('./courseSlug');
const { getSignedUploadUrl, deleteFromR2, deletePrefixFromR2 } = require('./r2Storage');
const { canVendorAccessTest } = require('./platformTestAccess');
const {
  canVendorAccessInterview,
  canVendorAccessAssignment,
  canVendorAccessSystemDesign,
} = require('./platformAssessmentAccess');

const Course = require('../models/Course');
const CourseModule = require('../models/CourseModule');
const CourseLecture = require('../models/CourseLecture');
const CourseVendorAllocation = require('../models/CourseVendorAllocation');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');

function badRequest(res, errors) {
  return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
}

function clearModuleAssessments(mod) {
  mod.testId = null;
  mod.interviewId = null;
  mod.assignmentId = null;
  mod.systemDesignProblemId = null;
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
  if (!plain.questions?.length) return { ...plain, questions: [] };

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
      const docs = await getModel()
        .find({ _id: { $in: ids } })
        .select('title question questionText text')
        .lean();
      for (const doc of docs) {
        labelMap.set(String(doc._id), doc.title || doc.question || doc.questionText || doc.text || 'Question');
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

async function resolveModuleAssessment(mod) {
  if (mod.testId) {
    const test = await Test.findById(mod.testId).lean();
    if (!test) return null;
    return { type: 'test', item: await populateTestQuestionsForAdmin(test) };
  }
  if (mod.interviewId) {
    const interview = await Interview.findById(mod.interviewId).lean();
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

async function assertVendorCanUseQuestions(vendorId, questions) {
  const idsByType = {};
  for (const q of questions || []) {
    if (!q?.type || !q?.questionId) {
      const err = new Error('Each question needs type and questionId');
      err.status = 400;
      throw err;
    }
    if (!idsByType[q.type]) idsByType[q.type] = [];
    idsByType[q.type].push(q.questionId);
  }

  await Promise.all(
    Object.entries(idsByType).map(async ([type, ids]) => {
      const getModel = QUESTION_MODELS[type];
      if (!getModel) {
        const err = new Error(`Unsupported question type ${type}`);
        err.status = 400;
        throw err;
      }
      const docs = await getModel()
        .find({ _id: { $in: ids } })
        .select('_id isGlobal vendorId')
        .lean();
      const found = new Set(docs.map((d) => String(d._id)));
      for (const id of ids) {
        if (!found.has(String(id))) {
          const err = new Error(`Question ${id} not found`);
          err.status = 400;
          throw err;
        }
      }
      for (const doc of docs) {
        const ok = doc.isGlobal || String(doc.vendorId) === String(vendorId);
        if (!ok) {
          const err = new Error('One or more questions are outside your bank');
          err.status = 403;
          throw err;
        }
      }
    })
  );
  return null;
}

async function getVendorOwnedCourse(courseId, vendorId, res) {
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400).json({ message: 'Invalid course id' });
    return null;
  }
  const course = await Course.findOne({
    _id: courseId,
    vendorId,
    source: 'vendor',
  });
  if (!course) {
    res.status(404).json({ message: 'Course not found or you cannot edit this course' });
    return null;
  }
  return course;
}

async function getOwnedModule(courseId, moduleId, vendorId, res) {
  const course = await getVendorOwnedCourse(courseId, vendorId, res);
  if (!course) return { course: null, mod: null };
  const mod = await CourseModule.findOne({ _id: moduleId, courseId });
  if (!mod) {
    res.status(404).json({ message: 'Module not found' });
    return { course, mod: null };
  }
  return { course, mod };
}

async function ensureSelfAllocation(course, userId) {
  await CourseVendorAllocation.findOneAndUpdate(
    { courseId: course._id, vendorId: course.vendorId },
    {
      $setOnInsert: {
        allocatedBy: userId,
        allocatedAt: new Date(),
        visibility: 'visible',
      },
      $set: { isActive: true },
    },
    { upsert: true, new: true }
  );
}

function registerVendorCourseCms(router) {
  router.post(
    '/',
    [
      body('title').trim().notEmpty().withMessage('Title is required'),
      body('description').optional().isString(),
      body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
      body('estimatedHours').optional().isFloat({ min: 0 }),
      body('unlockMode').optional().isIn(['sequential', 'open']),
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
          source: 'vendor',
          vendorId: req.vendorId,
          unlockMode: req.body.unlockMode === 'open' ? 'open' : 'sequential',
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });
        await ensureSelfAllocation(course, req.user._id);
        res.status(201).json(course);
      } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  );

  router.patch(
    '/:courseId',
    [
      body('title').optional().trim().notEmpty(),
      body('status').optional().isIn(['draft', 'published', 'archived']),
      body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
      body('unlockMode').optional().isIn(['sequential', 'open']),
    ],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return badRequest(res, errors);
        const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
        if (!course) return;

        const { title, description, level, estimatedHours, status, unlockMode } = req.body;
        if (title != null) {
          course.title = title.trim();
          course.slug = await uniqueCourseSlug(Course, title, course._id);
        }
        if (description != null) course.description = description;
        if (level != null) course.level = level;
        if (estimatedHours != null) course.estimatedHours = estimatedHours;
        if (unlockMode != null) course.unlockMode = unlockMode;
        if (status != null) {
          if (status === 'published' && !(course.moduleOrder?.length > 0)) {
            const modCount = await CourseModule.countDocuments({ courseId: course._id });
            if (modCount === 0) {
              return res.status(400).json({ message: 'Add at least one module before publishing' });
            }
          }
          course.status = status;
        }
        course.updatedBy = req.user._id;
        await course.save();
        await ensureSelfAllocation(course, req.user._id);
        res.json(course);
      } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  );

  router.delete('/:courseId', async (req, res) => {
    try {
      const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
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

  router.post(
    '/:courseId/modules',
    [body('title').trim().notEmpty().withMessage('Title is required')],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return badRequest(res, errors);
        const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
        if (!course) return;

        const maxOrder = await CourseModule.findOne({ courseId: course._id })
          .sort({ order: -1 })
          .select('order')
          .lean();
        const mod = await CourseModule.create({
          courseId: course._id,
          title: req.body.title.trim(),
          description: req.body.description || '',
          order: (maxOrder?.order ?? -1) + 1,
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
      const { mod } = await getOwnedModule(req.params.courseId, req.params.moduleId, req.vendorId, res);
      if (!mod) return;
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
      const { course, mod } = await getOwnedModule(
        req.params.courseId,
        req.params.moduleId,
        req.vendorId,
        res
      );
      if (!mod) return;

      const lectures = await CourseLecture.find({ moduleId: mod._id });
      for (const lec of lectures) {
        if (lec.video?.originalKey) await deleteFromR2(lec.video.originalKey);
        if (lec.video?.hlsPrefix) await deletePrefixFromR2(lec.video.hlsPrefix);
        if (lec.notesPdfKey) await deleteFromR2(lec.notesPdfKey);
      }
      await CourseLecture.deleteMany({ moduleId: mod._id });
      await CourseModule.deleteOne({ _id: mod._id });
      course.moduleOrder = course.moduleOrder.filter((id) => String(id) !== String(mod._id));
      course.updatedBy = req.user._id;
      await course.save();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.post(
    '/:courseId/modules/:moduleId/lectures',
    [body('title').trim().notEmpty().withMessage('Title is required')],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return badRequest(res, errors);
        const { mod } = await getOwnedModule(
          req.params.courseId,
          req.params.moduleId,
          req.vendorId,
          res
        );
        if (!mod) return;

        const maxOrder = await CourseLecture.findOne({ moduleId: mod._id })
          .sort({ order: -1 })
          .select('order')
          .lean();
        const lecture = await CourseLecture.create({
          courseId: req.params.courseId,
          moduleId: mod._id,
          title: req.body.title.trim(),
          description: req.body.description || '',
          order: (maxOrder?.order ?? -1) + 1,
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
      const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
      if (!course) return;
      const lecture = await CourseLecture.findOne({
        _id: req.params.lectureId,
        courseId: course._id,
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
      const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
      if (!course) return;
      const lecture = await CourseLecture.findOne({
        _id: req.params.lectureId,
        courseId: course._id,
      });
      if (!lecture) return res.status(404).json({ message: 'Lecture not found' });
      if (lecture.video?.originalKey) await deleteFromR2(lecture.video.originalKey);
      if (lecture.video?.hlsPrefix) await deletePrefixFromR2(lecture.video.hlsPrefix);
      if (lecture.notesPdfKey) await deleteFromR2(lecture.notesPdfKey);
      await CourseModule.updateOne({ _id: lecture.moduleId }, { $pull: { lectureOrder: lecture._id } });
      await CourseLecture.deleteOne({ _id: lecture._id });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.post(
    '/:courseId/lectures/:lectureId/video/upload-url',
    [body('fileName').trim().notEmpty(), body('contentType').trim().notEmpty()],
    async (req, res) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return badRequest(res, errors);
        const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
        if (!course) return;
        const lecture = await CourseLecture.findOne({
          _id: req.params.lectureId,
          courseId: course._id,
        });
        if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

        const ext = (req.body.fileName.match(/\.[a-z0-9]+$/i) || ['.mp4'])[0].toLowerCase();
        const key = `courses/${lecture.courseId}/lectures/${lecture._id}/original${ext}`;
        if (lecture.video?.originalKey && lecture.video.originalKey !== key) {
          await deleteFromR2(lecture.video.originalKey);
        }
        const uploadUrl = await getSignedUploadUrl(key, req.body.contentType, 900);
        lecture.video = {
          ...(lecture.video?.toObject?.() || lecture.video || {}),
          originalKey: key,
          originalFileName: req.body.fileName,
          contentType: req.body.contentType,
          status: 'uploading',
          errorMessage: null,
        };
        await lecture.save();
        res.json({ uploadUrl, key, expiresIn: 900 });
      } catch (error) {
        res.status(500).json({ message: error.message || 'Failed to create upload URL' });
      }
    }
  );

  router.post('/:courseId/lectures/:lectureId/video/complete', async (req, res) => {
    try {
      const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
      if (!course) return;
      const lecture = await CourseLecture.findOne({
        _id: req.params.lectureId,
        courseId: course._id,
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
    [body('fileName').trim().notEmpty()],
    async (req, res) => {
      try {
        const course = await getVendorOwnedCourse(req.params.courseId, req.vendorId, res);
        if (!course) return;
        const lecture = await CourseLecture.findOne({
          _id: req.params.lectureId,
          courseId: course._id,
        });
        if (!lecture) return res.status(404).json({ message: 'Lecture not found' });
        const key = `courses/${lecture.courseId}/lectures/${lecture._id}/notes.pdf`;
        if (lecture.notesPdfKey && lecture.notesPdfKey !== key) await deleteFromR2(lecture.notesPdfKey);
        const uploadUrl = await getSignedUploadUrl(key, req.body.contentType || 'application/pdf', 900);
        lecture.notesPdfKey = key;
        lecture.notesPdfFileName = req.body.fileName;
        await lecture.save();
        res.json({ uploadUrl, key, expiresIn: 900 });
      } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  );

  router.get('/:courseId/modules/:moduleId/assessment', async (req, res) => {
    try {
      const { mod } = await getOwnedModule(
        req.params.courseId,
        req.params.moduleId,
        req.vendorId,
        res
      );
      if (!mod) return;
      res.json({ assessment: await resolveModuleAssessment(mod) });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.put('/:courseId/modules/:moduleId/assessment', async (req, res) => {
    try {
      const { mod } = await getOwnedModule(
        req.params.courseId,
        req.params.moduleId,
        req.vendorId,
        res
      );
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
        if (!test || !(await canVendorAccessTest(test, req.vendorId))) {
          return res.status(404).json({ message: 'Test not found' });
        }
        mod.testId = test._id;
      } else if (type === 'interview') {
        const interview = await Interview.findById(assessmentId);
        if (!interview || !(await canVendorAccessInterview(interview, req.vendorId))) {
          return res.status(404).json({ message: 'Interview not found' });
        }
        mod.interviewId = interview._id;
      } else if (type === 'assignment') {
        const assignment = await Assignment.findById(assessmentId);
        if (!assignment || !(await canVendorAccessAssignment(assignment, req.vendorId))) {
          return res.status(404).json({ message: 'Assignment not found' });
        }
        mod.assignmentId = assignment._id;
      } else if (type === 'system_design') {
        const problem = await SystemDesignProblem.findById(assessmentId);
        if (!problem || !(await canVendorAccessSystemDesign(problem, req.vendorId))) {
          return res.status(404).json({ message: 'System design problem not found' });
        }
        mod.systemDesignProblemId = problem._id;
      } else {
        return res.status(400).json({ message: 'Invalid assessment type' });
      }

      await mod.save();
      res.json({ module: mod, assessment: await resolveModuleAssessment(mod) });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  router.put('/:courseId/modules/:moduleId/test', async (req, res) => {
    try {
      const { mod } = await getOwnedModule(
        req.params.courseId,
        req.params.moduleId,
        req.vendorId,
        res
      );
      if (!mod) return;
      const { testId, create, update } = req.body;

      if (update && typeof update === 'object') {
        if (!mod.testId) return res.status(404).json({ message: 'No quiz linked to this module' });
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
          await assertVendorCanUseQuestions(req.vendorId, update.questions);
          test.questions = update.questions.map((q, index) => ({
            type: q.type,
            questionId: q.questionId,
            questionType: q.questionType,
            points: q.points ?? 10,
            order: index + 1,
          }));
        }
        if (Array.isArray(update.appendQuestions) && update.appendQuestions.length) {
          await assertVendorCanUseQuestions(req.vendorId, update.appendQuestions);
          const existing = new Set(test.questions.map((q) => `${q.type}:${String(q.questionId)}`));
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
        return res.json({ module: mod, test: await populateTestQuestionsForAdmin(test) });
      }

      if (testId) {
        const test = await Test.findById(testId);
        if (!test || !(await canVendorAccessTest(test, req.vendorId))) {
          return res.status(404).json({ message: 'Test not found' });
        }
        clearModuleAssessments(mod);
        mod.testId = test._id;
        await mod.save();
        return res.json({ module: mod, test: await populateTestQuestionsForAdmin(test) });
      }

      if (create && typeof create === 'object') {
        const { title, description, type, duration, questions, settings } = create;
        if (!title || !type || !duration || !Array.isArray(questions) || !questions.length) {
          return res.status(400).json({
            message: 'create requires title, type, duration, and questions[]',
          });
        }
        await assertVendorCanUseQuestions(req.vendorId, questions);
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
          vendorId: req.vendorId,
          createdBy: req.user._id,
          isActive: true,
        });
        clearModuleAssessments(mod);
        mod.testId = test._id;
        await mod.save();
        return res.status(201).json({ module: mod, test: await populateTestQuestionsForAdmin(test) });
      }

      if (testId === null || req.body.clear === true) {
        clearModuleAssessments(mod);
        await mod.save();
        return res.json({ module: mod, test: null });
      }

      return res.status(400).json({ message: 'Provide testId, create payload, or clear: true' });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || 'Server error' });
    }
  });
}

module.exports = {
  registerVendorCourseCms,
  getVendorOwnedCourse,
  ensureSelfAllocation,
  populateTestQuestionsForAdmin,
};
