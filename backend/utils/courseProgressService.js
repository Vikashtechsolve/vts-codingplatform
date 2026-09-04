const Course = require('../models/Course');
const CourseModule = require('../models/CourseModule');
const CourseLecture = require('../models/CourseLecture');
const CourseProgress = require('../models/CourseProgress');
const { isLectureVideoComplete, pickDuration } = require('./courseWatchProgress');
const { moduleHasAssessment, liveAssessmentModuleIds } = require('./moduleAssessment');

async function loadCurriculum(courseId) {
  const course = await Course.findById(courseId).lean();
  if (!course) return null;
  const modules = await CourseModule.find({ courseId }).sort({ order: 1 }).lean();
  const lectures = await CourseLecture.find({ courseId }).sort({ order: 1 }).lean();
  const lecturesByModule = new Map();
  for (const lec of lectures) {
    const key = String(lec.moduleId);
    if (!lecturesByModule.has(key)) lecturesByModule.set(key, []);
    lecturesByModule.get(key).push(lec);
  }
  const orderedModules = (course.moduleOrder?.length
    ? course.moduleOrder
        .map((id) => modules.find((m) => String(m._id) === String(id)))
        .filter(Boolean)
    : modules);

  return {
    course,
    modules: orderedModules.map((mod) => {
      const list = lecturesByModule.get(String(mod._id)) || [];
      const ordered = (mod.lectureOrder?.length
        ? mod.lectureOrder
            .map((id) => list.find((l) => String(l._id) === String(id)))
            .filter(Boolean)
        : list);
      return { ...mod, lectures: ordered };
    }),
  };
}

function ensureLectureEntry(progress, lectureId) {
  let entry = progress.lectures.find((l) => String(l.lectureId) === String(lectureId));
  if (!entry) {
    entry = {
      lectureId,
      watchedSecondsUnique: 0,
      maxPosition: 0,
      reportedDurationSec: 0,
      intervals: [],
      notesOpened: false,
      completedAt: null,
    };
    progress.lectures.push(entry);
  }
  return entry;
}

function ensureModuleEntry(progress, moduleDoc) {
  let entry = progress.modules.find((m) => String(m.moduleId) === String(moduleDoc._id));
  if (!entry) {
    entry = {
      moduleId: moduleDoc._id,
      lecturesCompleted: 0,
      quizStatus: moduleHasAssessment(moduleDoc) ? 'locked' : 'none',
      resultId: null,
      submittedAt: null,
      completedAt: null,
    };
    progress.modules.push(entry);
  }
  return entry;
}

function isLectureContentComplete(lecture, lectureProgress) {
  if (!lectureProgress) return false;
  if (lectureProgress.completedAt) return true;

  const videoReady = lecture.video?.status === 'ready';
  const duration = pickDuration(
    lecture.video?.durationSec,
    lectureProgress.reportedDurationSec
  );
  const hasNotes =
    !!lecture.notesPdfKey || !!(lecture.notesHtml && String(lecture.notesHtml).trim());

  if (videoReady) {
    if (duration <= 0) return false;
    return isLectureVideoComplete(lectureProgress.watchedSecondsUnique, duration);
  }
  if (hasNotes) {
    return !!lectureProgress.notesOpened;
  }
  return !!lectureProgress.notesOpened;
}

/**
 * Recompute module/course completion and lock states from curriculum + progress.
 */
async function recomputeProgress(progressDoc, curriculumArg) {
  const curriculum = curriculumArg || (await loadCurriculum(progressDoc.courseId));
  if (!curriculum) return progressDoc;

  // A module whose linked assessment doc was deleted must not block
  // completion forever — treat it as having no quiz.
  const liveAssessments = await liveAssessmentModuleIds(curriculum.modules);

  let completedModules = 0;
  const totalModules = curriculum.modules.length || 1;

  for (let i = 0; i < curriculum.modules.length; i += 1) {
    const mod = curriculum.modules[i];
    const prev = i > 0 ? curriculum.modules[i - 1] : null;
    const prevEntry = prev
      ? progressDoc.modules.find((m) => String(m.moduleId) === String(prev._id))
      : null;
    const prevComplete =
      curriculum.course?.unlockMode === 'open' || !prev || !!prevEntry?.completedAt;

    const modEntry = ensureModuleEntry(progressDoc, mod);
    let lecturesDone = 0;

    for (const lec of mod.lectures) {
      const lecEntry = ensureLectureEntry(progressDoc, lec._id);
      if (isLectureContentComplete(lec, lecEntry)) {
        if (!lecEntry.completedAt) lecEntry.completedAt = new Date();
        lecturesDone += 1;
      }
    }

    modEntry.lecturesCompleted = lecturesDone;
    const allLecturesDone =
      mod.lectures.length === 0 || lecturesDone >= mod.lectures.length;

    const hasLiveAssessment = liveAssessments.has(String(mod._id));
    if (hasLiveAssessment) {
      if (modEntry.quizStatus === 'submitted') {
        // keep
      } else if (allLecturesDone && prevComplete) {
        modEntry.quizStatus = 'available';
      } else {
        modEntry.quizStatus = 'locked';
      }
    } else if (modEntry.quizStatus !== 'submitted') {
      // Preserve 'submitted' (score already earned) even if the doc is gone
      modEntry.quizStatus = 'none';
    }

    const quizOk = !hasLiveAssessment || modEntry.quizStatus === 'submitted';
    if (prevComplete && allLecturesDone && quizOk) {
      if (!modEntry.completedAt) modEntry.completedAt = new Date();
      completedModules += 1;
    } else {
      modEntry.completedAt = null;
    }
  }

  progressDoc.percentComplete = Math.round((completedModules / totalModules) * 100);
  progressDoc.completedAt =
    completedModules >= curriculum.modules.length && curriculum.modules.length > 0
      ? progressDoc.completedAt || new Date()
      : null;

  const firstIncomplete = curriculum.modules.find((mod) => {
    const entry = progressDoc.modules.find((m) => String(m.moduleId) === String(mod._id));
    return !entry?.completedAt;
  });
  progressDoc.currentModuleId = firstIncomplete?._id || curriculum.modules.at(-1)?._id || null;

  return progressDoc;
}

async function getOrCreateProgress(enrollment, curriculumArg) {
  let progress = await CourseProgress.findOne({ enrollmentId: enrollment._id });
  if (!progress) {
    const curriculum = curriculumArg || (await loadCurriculum(enrollment.courseId));
    progress = new CourseProgress({
      enrollmentId: enrollment._id,
      courseId: enrollment.courseId,
      studentId: enrollment.studentId,
      vendorId: enrollment.vendorId,
      currentModuleId: curriculum?.modules?.[0]?._id || null,
      lectures: [],
      modules: (curriculum?.modules || []).map((mod) => ({
        moduleId: mod._id,
        lecturesCompleted: 0,
        quizStatus: moduleHasAssessment(mod) ? 'locked' : 'none',
      })),
    });
  }
  await recomputeProgress(progress, curriculumArg);
  await progress.save();
  return progress;
}

/**
 * Is module unlocked for this progress? Module index 0 always if enrolled; else previous complete.
 */
async function isModuleUnlocked(progressDoc, moduleId, curriculumArg) {
  const curriculum = curriculumArg || (await loadCurriculum(progressDoc.courseId));
  if (!curriculum) return false;
  const idx = curriculum.modules.findIndex((m) => String(m._id) === String(moduleId));
  if (idx < 0) return false;
  if (curriculum.course?.unlockMode === 'open') return true;
  if (idx === 0) return true;
  const prev = curriculum.modules[idx - 1];
  const prevEntry = progressDoc.modules.find((m) => String(m.moduleId) === String(prev._id));
  return !!prevEntry?.completedAt;
}

async function assertLectureAccessible(progressDoc, lecture, curriculumArg) {
  const curriculum = curriculumArg || (await loadCurriculum(progressDoc.courseId));
  const unlocked = await isModuleUnlocked(progressDoc, lecture.moduleId, curriculum);
  if (!unlocked) {
    const err = new Error('Module is locked. Complete the previous module first.');
    err.status = 403;
    throw err;
  }
}

module.exports = {
  loadCurriculum,
  ensureLectureEntry,
  ensureModuleEntry,
  isLectureContentComplete,
  recomputeProgress,
  getOrCreateProgress,
  isModuleUnlocked,
  assertLectureAccessible,
};
