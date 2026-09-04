const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const { auth, authorize } = require('../middleware/auth');
const tenantMiddleware = require('../middleware/tenant');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  getOrCreateProgress,
  loadCurriculum,
  ensureLectureEntry,
  recomputeProgress,
  assertLectureAccessible,
  isModuleUnlocked,
} = require('../utils/courseProgressService');
const {
  applyHeartbeat,
  pickDuration,
  watchedPercent,
} = require('../utils/courseWatchProgress');
const { scoreFromResult, buildCourseScorecard } = require('../utils/courseScorecard');
const {
  DONE_STATUSES,
  pickOfficialQuizResult,
  applyOfficialQuizProgress,
} = require('../utils/courseQuizAttempts');
const {
  moduleAssessmentRef,
  loadModuleAssessmentMeta,
  formatTestLabel,
  effectiveTestKind,
} = require('../utils/moduleAssessment');
const {
  loadOfficialSubmissionScore,
  applyOfficialAssessmentProgress,
} = require('../utils/courseAssessmentProgress');
const { signMediaToken, DEFAULT_TTL_SEC } = require('../utils/courseMediaToken');
const { getSignedDownloadUrl } = require('../utils/r2Storage');

const Course = require('../models/Course');
const CourseEnrollment = require('../models/CourseEnrollment');
const CourseVendorAllocation = require('../models/CourseVendorAllocation');
const CourseProgress = require('../models/CourseProgress');
const CourseLecture = require('../models/CourseLecture');
const CourseModule = require('../models/CourseModule');
const Result = require('../models/Result');
const Test = require('../models/Test');
const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const ProjectSubmission = require('../models/ProjectSubmission');
const SystemDesignSubmission = require('../models/SystemDesignSubmission');
const Assignment = require('../models/Assignment');
const SystemDesignProblem = require('../models/SystemDesignProblem');

router.use(auth);
router.use(authorize('student'));
router.use(tenantMiddleware);

async function getActiveEnrollment(courseId, studentId, vendorId) {
  return CourseEnrollment.findOne({
    courseId,
    studentId,
    vendorId,
    status: 'active',
  });
}

async function assertVisibleAllocation(courseId, vendorId) {
  const alloc = await CourseVendorAllocation.findOne({
    courseId,
    vendorId,
    isActive: true,
    visibility: 'visible',
  });
  if (!alloc) {
    const err = new Error('Course is not available');
    err.status = 404;
    throw err;
  }
  return alloc;
}

async function batchLoadModuleAssessmentMetas(modules) {
  const moduleRefs = (modules || []).map((m) => moduleAssessmentRef(m));

  const idsByType = {
    test: [],
    interview: [],
    assignment: [],
    system_design: [],
  };
  for (const ref of moduleRefs) {
    if (!ref) continue;
    idsByType[ref.type].push(ref.id);
  }

  const [tests, interviews, assignments, problems] = await Promise.all([
    idsByType.test.length
      ? Test.find({ _id: { $in: idsByType.test } })
          .select('title type duration questions source')
          .lean()
      : Promise.resolve([]),
    idsByType.interview.length
      ? Interview.find({ _id: { $in: idsByType.interview } })
          .select('title interviewType topic difficulty duration settings')
          .lean()
      : Promise.resolve([]),
    idsByType.assignment.length
      ? Assignment.find({ _id: { $in: idsByType.assignment } })
          .select('title category difficulty duration totalMarks')
          .lean()
      : Promise.resolve([]),
    idsByType.system_design.length
      ? SystemDesignProblem.find({ _id: { $in: idsByType.system_design } })
          .select('title difficulty estimatedTime category')
          .lean()
      : Promise.resolve([]),
  ]);

  const testMap = new Map(tests.map((t) => [String(t._id), t]));
  const interviewMap = new Map(interviews.map((i) => [String(i._id), i]));
  const assignmentMap = new Map(assignments.map((a) => [String(a._id), a]));
  const problemMap = new Map(problems.map((p) => [String(p._id), p]));

  const metaByModuleId = new Map();

  (modules || []).forEach((mod, idx) => {
    const ref = moduleRefs[idx];
    if (!ref) return;

    let meta = null;

    if (ref.type === 'test') {
      const test = testMap.get(String(ref.id));
      if (!test) return;
      const kind = effectiveTestKind(test);
      meta = {
        type: 'test',
        id: test._id,
        title: test.title,
        kind,
        durationMin: test.duration,
        questionCount: test.questions?.length || 0,
        label: formatTestLabel(kind),
      };
    } else if (ref.type === 'interview') {
      const interview = interviewMap.get(String(ref.id));
      if (!interview) return;
      meta = {
        type: 'interview',
        id: interview._id,
        title: interview.title,
        kind: interview.interviewType || 'interview',
        durationMin: interview.duration,
        label: 'Mock interview',
        topic: interview.topic,
        difficulty: interview.difficulty,
      };
    } else if (ref.type === 'assignment') {
      const assignment = assignmentMap.get(String(ref.id));
      if (!assignment) return;
      meta = {
        type: 'assignment',
        id: assignment._id,
        title: assignment.title,
        kind: assignment.category || 'project',
        durationMin: assignment.duration,
        maxScore: assignment.totalMarks,
        label: 'AI project evaluation',
      };
    } else if (ref.type === 'system_design') {
      const problem = problemMap.get(String(ref.id));
      if (!problem) return;
      meta = {
        type: 'system_design',
        id: problem._id,
        title: problem.title,
        kind: problem.category || 'system_design',
        durationMin: problem.estimatedTime,
        label: 'System design',
        difficulty: problem.difficulty,
      };
    }

    if (meta) metaByModuleId.set(String(mod._id), meta);
  });

  return metaByModuleId;
}

router.get('/', async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    // Resolve visible, published courses up front so pagination counts are exact
    const visibleAllocs = await CourseVendorAllocation.find({
      vendorId: req.vendorId,
      isActive: true,
      visibility: 'visible',
    })
      .select('courseId')
      .lean();
    const visibleCourseIds = visibleAllocs.map((a) => a.courseId);

    if (!visibleCourseIds.length) {
      return res.json(paginatedResponse({ items: [], page, limit, total: 0 }));
    }

    const publishedCourses = await Course.find({
      _id: { $in: visibleCourseIds },
      status: 'published',
    })
      .select('_id')
      .lean();

    const filter = {
      studentId: req.user._id,
      vendorId: req.vendorId,
      status: 'active',
      courseId: { $in: publishedCourses.map((c) => c._id) },
    };

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.find(filter)
        .sort({ assignedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('courseId', 'title slug description level estimatedHours status coverKey unlockMode')
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

    const items = enrollments
      .filter((e) => e.courseId)
      .map((e) => ({
        enrollmentId: e._id,
        assignedAt: e.assignedAt,
        dueAt: e.dueAt,
        course: e.courseId,
        progress: progressMap.get(String(e._id)) || { percentComplete: 0 },
      }));

    res.json(paginatedResponse({ items, page, limit, total }));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:courseId', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled in this course' });
    await assertVisibleAllocation(req.params.courseId, req.vendorId);

    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum || curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }

    const progress = await getOrCreateProgress(enrollment, curriculum);

    const resultIds = (progress.modules || []).map((m) => m.resultId).filter(Boolean);
    const results = resultIds.length
      ? await Result.find({ _id: { $in: resultIds }, studentId: req.user._id })
          .select('totalScore maxScore percentage status')
          .lean()
      : [];
    const resultMap = new Map(results.map((r) => [String(r._id), r]));

    const assessmentMetas = await batchLoadModuleAssessmentMetas(curriculum.modules);

    const progressModulesById = new Map(
      (progress.modules || []).map((m) => [String(m.moduleId), m])
    );
    const progressLecturesById = new Map(
      (progress.lectures || []).map((l) => [String(l.lectureId), l])
    );

    const modules = [];
    for (let i = 0; i < curriculum.modules.length; i += 1) {
      const mod = curriculum.modules[i];
      const modProg = progressModulesById.get(String(mod._id));

      // unlockMode = open => every module unlocked
      // sequential => module i unlocked only if i==0 or previous module is completed
      const unlockMode = curriculum.course?.unlockMode || 'sequential';
      const unlocked =
        unlockMode === 'open' ||
        i === 0 ||
        (() => {
          const prev = curriculum.modules[i - 1];
          const prevEntry = prev ? progressModulesById.get(String(prev._id)) : null;
          return !!prevEntry?.completedAt;
        })();

      const assessmentMeta = assessmentMetas.get(String(mod._id));
      const live = modProg?.resultId ? resultMap.get(String(modProg.resultId)) : null;
      const quizScore =
        scoreFromResult(live) ||
        (modProg?.quizStatus === 'submitted' && (modProg.quizMaxScore || 0) > 0
          ? {
              resultId: modProg.resultId || modProg.submissionId || null,
              totalScore: Number(modProg.quizScore) || 0,
              maxScore: Number(modProg.quizMaxScore) || 0,
              percentage: Number(modProg.quizPercentage) || 0,
            }
          : null);
      modules.push({
        _id: mod._id,
        title: mod.title,
        description: mod.description,
        order: mod.order,
        unlocked,
        // hasQuiz only when the linked assessment doc still exists —
        // a dangling ref must not render a quiz that 404s on start
        hasQuiz: Boolean(assessmentMeta),
        assessment: assessmentMeta,
        quiz: assessmentMeta,
        quizStatus: modProg?.quizStatus || (assessmentMeta ? 'locked' : 'none'),
        quizAttemptCount: Number(modProg?.quizAttemptCount) || (modProg?.quizStatus === 'submitted' ? 1 : 0),
        quizScore,
        completedAt: modProg?.completedAt || null,
        lectures: mod.lectures.map((l) => {
          const lp = progressLecturesById.get(String(l._id));
          return {
            _id: l._id,
            title: l.title,
            description: l.description,
            order: l.order,
            unlocked,
            completed: !!lp?.completedAt,
            watchedSecondsUnique: lp?.watchedSecondsUnique || 0,
            durationSec: pickDuration(l.video?.durationSec, lp?.reportedDurationSec),
            videoStatus: l.video?.status || 'none',
            hasNotesPdf: !!l.notesPdfKey,
            hasNotesHtml: !!(l.notesHtml && String(l.notesHtml).trim()),
          };
        }),
      });
    }

    res.json({
      course: {
        _id: curriculum.course._id,
        title: curriculum.course.title,
        description: curriculum.course.description,
        level: curriculum.course.level,
        estimatedHours: curriculum.course.estimatedHours,
        unlockMode: curriculum.course.unlockMode === 'open' ? 'open' : 'sequential',
      },
      enrollment: {
        _id: enrollment._id,
        dueAt: enrollment.dueAt,
        assignedAt: enrollment.assignedAt,
      },
      progress: {
        percentComplete: progress.percentComplete,
        completedAt: progress.completedAt,
        currentModuleId: progress.currentModuleId,
      },
      scorecard: buildCourseScorecard(modules),
      modules,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

router.get('/:courseId/lectures/:lectureId', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });
    await assertVisibleAllocation(req.params.courseId, req.vendorId);

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    }).lean();
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum || curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }
    const progress = await getOrCreateProgress(enrollment, curriculum);
    await assertLectureAccessible(progress, lecture, curriculum);

    const lp = progress.lectures.find((l) => String(l.lectureId) === String(lecture._id));

    // Notes-only / empty: mark opened for completion path
    if (
      lecture.video?.status !== 'ready' &&
      (lecture.notesPdfKey || (lecture.notesHtml && String(lecture.notesHtml).trim()))
    ) {
      const entry = ensureLectureEntry(progress, lecture._id);
      if (!entry.notesOpened) {
        entry.notesOpened = true;
        await recomputeProgress(progress, curriculum);
        await progress.save();
      }
    }

    res.json({
      lecture: {
        _id: lecture._id,
        moduleId: lecture.moduleId,
        title: lecture.title,
        description: lecture.description,
        notesHtml: lecture.notesHtml || '',
        hasNotesPdf: !!lecture.notesPdfKey,
        hasNotesHtml: !!(lecture.notesHtml && String(lecture.notesHtml).trim()),
        notesPdfFileName: lecture.notesPdfFileName,
        video: {
          status: lecture.video?.status || 'none',
          durationSec: pickDuration(lecture.video?.durationSec, lp?.reportedDurationSec),
        },
      },
      progress: {
        watchedSecondsUnique: lp?.watchedSecondsUnique || 0,
        maxPosition: lp?.maxPosition || 0,
        durationSec: pickDuration(lecture.video?.durationSec, lp?.reportedDurationSec),
        watchedPercent: watchedPercent(
          lp?.watchedSecondsUnique || 0,
          pickDuration(lecture.video?.durationSec, lp?.reportedDurationSec)
        ),
        completedAt: lp?.completedAt || null,
      },
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

router.post('/:courseId/lectures/:lectureId/playback', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });
    await assertVisibleAllocation(req.params.courseId, req.vendorId);

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });
    if (lecture.video?.status !== 'ready' || !lecture.video.hlsPrefix) {
      return res.status(400).json({ message: 'Video not ready' });
    }

    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum || curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }
    const progress = await getOrCreateProgress(enrollment, curriculum);
    await assertLectureAccessible(progress, lecture, curriculum);

    const token = signMediaToken({
      studentId: req.user._id,
      courseId: lecture.courseId,
      lectureId: lecture._id,
    });

    // Relative to API base (/api) — frontend joins with axios baseURL
    const playlistPath = `/courses-media/${lecture.courseId}/lectures/${lecture._id}/master.m3u8?token=${encodeURIComponent(token)}`;

    res.json({
      playlistUrl: playlistPath,
      token,
      expiresIn: DEFAULT_TTL_SEC,
      durationSec: lecture.video.durationSec || 0,
      resumePosition: (() => {
        const lp = progress.lectures.find((l) => String(l.lectureId) === String(lecture._id));
        return lp?.maxPosition || 0;
      })(),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

router.get('/:courseId/lectures/:lectureId/notes-pdf', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });
    await assertVisibleAllocation(req.params.courseId, req.vendorId);

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture?.notesPdfKey) {
      return res.status(404).json({ message: 'Notes PDF not found' });
    }

    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum || curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }
    const progress = await getOrCreateProgress(enrollment, curriculum);
    await assertLectureAccessible(progress, lecture, curriculum);

    const entry = ensureLectureEntry(progress, lecture._id);
    entry.notesOpened = true;
    await recomputeProgress(progress, curriculum);
    await progress.save();

    const url = await getSignedDownloadUrl(lecture.notesPdfKey, 300);
    res.json({
      url,
      fileName: lecture.notesPdfFileName || 'notes.pdf',
      expiresIn: 300,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

router.post(
  '/:courseId/lectures/:lectureId/heartbeat',
  [
    body('positionSec').isFloat({ min: 0 }),
    body('deltaWatchedSec').isFloat({ min: 0 }),
    body('durationSec').optional().isFloat({ min: 0, max: 43200 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
      }

      const enrollment = await getActiveEnrollment(
        req.params.courseId,
        req.user._id,
        req.vendorId
      );
      if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });

      const lecture = await CourseLecture.findOne({
        _id: req.params.lectureId,
        courseId: req.params.courseId,
      });
      if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

      const curriculum = await loadCurriculum(req.params.courseId);
      if (!curriculum || curriculum.course.status !== 'published') {
        return res.status(404).json({ message: 'Course not found' });
      }
      const progress = await getOrCreateProgress(enrollment, curriculum);
      await assertLectureAccessible(progress, lecture, curriculum);

      const entry = ensureLectureEntry(progress, lecture._id);
      const durationSec = pickDuration(lecture.video?.durationSec, req.body.durationSec);
      if (durationSec > 0) entry.reportedDurationSec = durationSec;
      const updated = applyHeartbeat(entry, {
        positionSec: req.body.positionSec,
        deltaWatchedSec: req.body.deltaWatchedSec,
        durationSec,
      });
      entry.intervals = updated.intervals;
      entry.watchedSecondsUnique = updated.watchedSecondsUnique;
      entry.maxPosition = updated.maxPosition;
      progress.lastHeartbeatAt = new Date();

      await recomputeProgress(progress, curriculum);
      await progress.save();

      const fresh = progress.lectures.find((l) => String(l.lectureId) === String(lecture._id));
      res.json({
        watchedSecondsUnique: fresh.watchedSecondsUnique,
        maxPosition: fresh.maxPosition,
        durationSec,
        watchedPercent: watchedPercent(fresh.watchedSecondsUnique, durationSec),
        completed: !!fresh.completedAt,
        percentComplete: progress.percentComplete,
      });
    } catch (error) {
      res.status(error.status || 500).json({ message: error.message || 'Server error' });
    }
  }
);

router.post('/:courseId/lectures/:lectureId/open-notes', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });

    const lecture = await CourseLecture.findOne({
      _id: req.params.lectureId,
      courseId: req.params.courseId,
    });
    if (!lecture) return res.status(404).json({ message: 'Lecture not found' });

    const curriculum = await loadCurriculum(req.params.courseId);
    if (!curriculum || curriculum.course.status !== 'published') {
      return res.status(404).json({ message: 'Course not found' });
    }
    const progress = await getOrCreateProgress(enrollment, curriculum);
    await assertLectureAccessible(progress, lecture, curriculum);

    const entry = ensureLectureEntry(progress, lecture._id);
    entry.notesOpened = true;
    await recomputeProgress(progress, curriculum);
    await progress.save();

    res.json({
      completed: !!entry.completedAt,
      percentComplete: progress.percentComplete,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

/** Start or resume module assessment */
router.post('/:courseId/modules/:moduleId/quiz/start', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });
    await assertVisibleAllocation(req.params.courseId, req.vendorId);

    const mod = await CourseModule.findOne({
      _id: req.params.moduleId,
      courseId: req.params.courseId,
    });
    const assessmentRef = moduleAssessmentRef(mod);
    if (!assessmentRef) return res.status(404).json({ message: 'No assessment for this module' });

    const progress = await getOrCreateProgress(enrollment);
    const unlocked = await isModuleUnlocked(progress, mod._id);
    if (!unlocked) {
      return res.status(403).json({ message: 'Module is locked' });
    }

    const modProg = progress.modules.find((m) => String(m.moduleId) === String(mod._id));
    if (modProg?.quizStatus === 'locked') {
      return res.status(403).json({ message: 'Complete all lectures before the assessment' });
    }

    const meta = await loadModuleAssessmentMeta(mod);
    if (!meta) return res.status(404).json({ message: 'Assessment not found' });

    const courseContext = {
      courseId: req.params.courseId,
      moduleId: mod._id,
    };

    if (assessmentRef.type === 'test') {
      const [completed, inProgress] = await Promise.all([
        Result.find({
          testId: mod.testId,
          studentId: req.user._id,
          status: { $in: DONE_STATUSES },
        })
          .select('_id totalScore maxScore percentage status submittedAt createdAt courseId moduleId')
          .lean(),
        Result.findOne({
          testId: mod.testId,
          studentId: req.user._id,
          status: 'in_progress',
        })
          .select('_id')
          .lean(),
      ]);
      const official = pickOfficialQuizResult(completed, courseContext);
      const quizScore =
        scoreFromResult(official) ||
        (modProg?.quizStatus === 'submitted' && (modProg.quizMaxScore || 0) > 0
          ? {
              resultId: modProg.resultId || null,
              totalScore: Number(modProg.quizScore) || 0,
              maxScore: Number(modProg.quizMaxScore) || 0,
              percentage: Number(modProg.quizPercentage) || 0,
            }
          : null);

      return res.json({
        assessmentType: 'test',
        testId: meta.id,
        assessmentId: meta.id,
        title: meta.title,
        type: meta.kind,
        duration: meta.durationMin,
        label: meta.label,
        practice: !!official,
        alreadySubmitted: !!official,
        attemptNumber: completed.length + (inProgress ? 0 : 1),
        officialResultId: official?._id || modProg?.resultId || null,
        resultId: official?._id || modProg?.resultId || null,
        inProgress: !!inProgress,
        quizScore,
        courseContext,
      });
    }

    const submitted = modProg?.quizStatus === 'submitted';
    const quizScore =
      submitted && modProg?.quizMaxScore
        ? {
            resultId: modProg.submissionId || modProg.resultId || null,
            totalScore: Number(modProg.quizScore) || 0,
            maxScore: Number(modProg.quizMaxScore) || 0,
            percentage: Number(modProg.quizPercentage) || 0,
          }
        : null;

    res.json({
      assessmentType: assessmentRef.type,
      assessmentId: meta.id,
      title: meta.title,
      label: meta.label,
      duration: meta.durationMin,
      practice: submitted,
      alreadySubmitted: submitted,
      quizScore,
      courseContext,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

/**
 * Mark module assessment submitted.
 * Body: { resultId } for tests, { submissionId } for interview/assignment/system design
 */
router.post('/:courseId/modules/:moduleId/quiz/complete', async (req, res) => {
  try {
    const enrollment = await getActiveEnrollment(
      req.params.courseId,
      req.user._id,
      req.vendorId
    );
    if (!enrollment) return res.status(404).json({ message: 'Not enrolled' });

    const mod = await CourseModule.findOne({
      _id: req.params.moduleId,
      courseId: req.params.courseId,
    });
    const assessmentRef = moduleAssessmentRef(mod);
    if (!assessmentRef) return res.status(404).json({ message: 'No assessment for this module' });

    const submissionId = req.body.submissionId || req.body.resultId;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ message: 'submissionId or resultId required' });
    }

    const progress = await getOrCreateProgress(enrollment);
    let modProg = progress.modules.find((m) => String(m.moduleId) === String(mod._id));
    if (!modProg) {
      modProg = {
        moduleId: mod._id,
        lecturesCompleted: 0,
        quizStatus: 'available',
        resultId: null,
        submissionId: null,
        submittedAt: null,
        completedAt: null,
      };
      progress.modules.push(modProg);
    }

    let practice = false;
    let attemptCount = 1;
    let officialSubmissionId = submissionId;
    let quizScore = null;

    if (assessmentRef.type === 'test') {
      const result = await Result.findOne({
        _id: submissionId,
        testId: mod.testId,
        studentId: req.user._id,
        status: { $in: DONE_STATUSES },
      });
      if (!result) {
        return res.status(400).json({ message: 'Completed result not found for this assessment' });
      }

      const attempts = await Result.find({
        testId: mod.testId,
        studentId: req.user._id,
        status: { $in: DONE_STATUSES },
      })
        .select('_id totalScore maxScore percentage status submittedAt createdAt courseId moduleId')
        .lean();
      const official =
        pickOfficialQuizResult(attempts, {
          courseId: req.params.courseId,
          moduleId: mod._id,
        }) || result;
      const outcome = applyOfficialQuizProgress(modProg, {
        currentResult: result,
        officialResult: official,
        attemptCount: attempts.length,
      });
      practice = outcome.practice;
      attemptCount = outcome.attemptCount;
      officialSubmissionId = outcome.officialResultId;
      quizScore = outcome.quizScore;
    } else if (assessmentRef.type === 'interview') {
      const session = await InterviewSession.findOne({
        _id: submissionId,
        interviewId: mod.interviewId,
        studentId: req.user._id,
        status: 'completed',
      });
      if (!session) {
        return res.status(400).json({ message: 'Completed interview session not found' });
      }
      const prior = await InterviewSession.find({
        interviewId: mod.interviewId,
        studentId: req.user._id,
        status: 'completed',
      })
        .select('_id submittedAt createdAt overallScore readinessPercent')
        .sort({ submittedAt: 1, createdAt: 1 })
        .lean();
      officialSubmissionId = prior[0]?._id || session._id;
      const officialSession =
        prior.find((s) => String(s._id) === String(officialSubmissionId)) || session;
      quizScore = await loadOfficialSubmissionScore('interview', officialSession._id);
      const outcome = applyOfficialAssessmentProgress(modProg, {
        assessmentType: 'interview',
        currentSubmissionId: session._id,
        officialSubmissionId: officialSession._id,
        quizScore,
        attemptCount: prior.length,
      });
      practice = outcome.practice;
      attemptCount = prior.length;
    } else if (assessmentRef.type === 'assignment') {
      const submission = await ProjectSubmission.findOne({
        _id: submissionId,
        assignmentId: mod.assignmentId,
        studentId: req.user._id,
      });
      if (!submission) {
        return res.status(400).json({ message: 'Project submission not found' });
      }
      const assignment = await Assignment.findById(mod.assignmentId).select('totalMarks').lean();
      const prior = await ProjectSubmission.find({
        assignmentId: mod.assignmentId,
        studentId: req.user._id,
      })
        .select('_id submittedAt createdAt')
        .sort({ submittedAt: 1, createdAt: 1 })
        .lean();
      officialSubmissionId = prior[0]?._id || submission._id;
      quizScore = await loadOfficialSubmissionScore('assignment', officialSubmissionId, {
        assignment,
      });
      const outcome = applyOfficialAssessmentProgress(modProg, {
        assessmentType: 'assignment',
        currentSubmissionId: submission._id,
        officialSubmissionId,
        quizScore,
        attemptCount: prior.length,
      });
      practice = outcome.practice;
      attemptCount = prior.length;
    } else if (assessmentRef.type === 'system_design') {
      const submission = await SystemDesignSubmission.findOne({
        _id: submissionId,
        problemId: mod.systemDesignProblemId,
        studentId: req.user._id,
        status: { $in: ['submitted', 'evaluating', 'evaluated', 'follow_up'] },
      });
      if (!submission) {
        return res.status(400).json({ message: 'System design submission not found' });
      }
      const prior = await SystemDesignSubmission.find({
        problemId: mod.systemDesignProblemId,
        studentId: req.user._id,
        status: { $in: ['submitted', 'evaluating', 'evaluated', 'follow_up'] },
      })
        .select('_id submittedAt createdAt totalScore percentage')
        .sort({ submittedAt: 1, createdAt: 1 })
        .lean();
      officialSubmissionId = prior[0]?._id || submission._id;
      quizScore = await loadOfficialSubmissionScore('system_design', officialSubmissionId);
      const outcome = applyOfficialAssessmentProgress(modProg, {
        assessmentType: 'system_design',
        currentSubmissionId: submission._id,
        officialSubmissionId,
        quizScore,
        attemptCount: prior.length,
      });
      practice = outcome.practice;
      attemptCount = prior.length;
    }

    const curriculum = await loadCurriculum(req.params.courseId);
    await recomputeProgress(progress, curriculum);
    await progress.save();

    res.json({
      success: true,
      percentComplete: progress.percentComplete,
      moduleCompleted: !!modProg.completedAt,
      nextModuleId: progress.currentModuleId,
      practice,
      attemptCount,
      officialResultId: officialSubmissionId,
      assessmentType: assessmentRef.type,
      quizScore,
      thisAttempt: quizScore,
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Server error' });
  }
});

module.exports = router;
