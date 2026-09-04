import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiFileText,
  FiLayers,
  FiLock,
  FiPlay,
  FiTarget,
  FiVideo,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import CourseProgressRing from '../../components/Courses/CourseProgressRing';
import CourseScorecard from '../../components/Courses/CourseScorecard';
import CourseModuleQuizCard from '../../components/Courses/CourseModuleQuizCard';
import { courseProgressPercent, lectureWatchPercent } from '../../utils/courseWatchClient';
import {
  studentRouteForAssessmentType,
  officialScoreRouteForAssessment,
} from '../../utils/courseAssessment';
import '../../styles/courses-pages.css';
import '../Student/Dashboard.css';

const COURSES_ACCENT = '#4f46e5';
const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

const formatDuration = (sec) => {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  if (!n) return '0m';
  const h = Math.floor(n / 3600);
  const m = Math.round((n % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const moduleProgress = (mod) => {
  const lectures = mod.lectures || [];
  const lectureDone = lectures.filter((l) => l.completed).length;
  const quizDone = mod.hasQuiz && mod.quizStatus === 'submitted' ? 1 : 0;
  const total = lectures.length + (mod.hasQuiz ? 1 : 0);
  const done = lectureDone + quizDone;
  const pct = total ? Math.round((done / total) * 100) : mod.completedAt ? 100 : 0;
  return { lectureDone, lectureTotal: lectures.length, done, total, pct };
};

const lectureWatchPct = (lec) =>
  lectureWatchPercent({
    unique: lec.watchedSecondsUnique,
    duration: lec.durationSec,
    completed: lec.completed,
  });

const StudentCoursePlayer = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const outlineRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizMessage, setQuizMessage] = useState('');
  const [openModuleId, setOpenModuleId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/student/courses/${courseId}`);
      setData(res.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const analytics = useMemo(() => {
    const modules = data?.modules || [];
    const lectures = modules.flatMap((m) => m.lectures || []);
    const lectureDone = lectures.filter((l) => l.completed).length;
    const watchedSec = lectures.reduce((s, l) => {
      const unique = l.watchedSecondsUnique || 0;
      const dur = l.durationSec || 0;
      return s + (dur > 0 ? Math.min(unique, dur) : unique);
    }, 0);
    const durationSec = lectures.reduce((s, l) => s + (l.durationSec || 0), 0);
    const moduleDone = modules.filter((m) => m.completedAt).length;
    const quizzes = modules.filter((m) => m.hasQuiz);
    const quizDone = quizzes.filter((m) => m.quizStatus === 'submitted').length;
    return {
      lectureDone,
      lectureTotal: lectures.length,
      watchedSec,
      durationSec,
      moduleDone,
      moduleTotal: modules.length,
      quizDone,
      quizTotal: quizzes.length,
    };
  }, [data]);

  const firstIncomplete = useMemo(() => {
    if (!data?.modules) return null;
    for (const mod of data.modules) {
      if (!mod.unlocked) continue;
      const lec = (mod.lectures || []).find((l) => !l.completed);
      if (lec) return { mod, lec };
      if (mod.hasQuiz && mod.quizStatus === 'available') return { mod, quiz: true };
    }
    return null;
  }, [data]);

  useEffect(() => {
    if (!data?.modules?.length) return;
    const preferred =
      firstIncomplete?.mod?._id ||
      data.progress?.currentModuleId ||
      data.modules.find((m) => m.unlocked)?._id ||
      data.modules[0]._id;
    setOpenModuleId((prev) => prev || preferred);
    const id = window.requestAnimationFrame(() => {
      if (outlineRef.current) outlineRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(id);
  }, [data, firstIncomplete]);

  const openQuizResult = (mod) => {
    const type = mod.assessment?.type || mod.quiz?.type || 'test';
    const submissionId = mod.quizScore?.resultId;
    const route = officialScoreRouteForAssessment(
      type,
      submissionId,
      courseId,
      mod._id || mod.moduleId
    );
    if (route) {
      navigate(route);
      return true;
    }
    return false;
  };

  const startQuiz = async (moduleId) => {
    setQuizMessage('');
    try {
      const { data: start } = await axiosInstance.post(
        `/student/courses/${courseId}/modules/${moduleId}/quiz/start`
      );
      const type = start.assessmentType || 'test';
      const assessmentId = start.assessmentId || start.testId;
      const route = studentRouteForAssessmentType(type, assessmentId, courseId, moduleId, start.type);
      if (!route) {
        setQuizMessage('Assessment is not available for this module.');
        return;
      }
      navigate(route);
    } catch (err) {
      setQuizMessage(err.response?.data?.message || 'Cannot start assessment');
    }
  };

  const goLecture = (lectureId) => {
    navigate(`/student/courses/${courseId}/lectures/${lectureId}`, {
      preventScrollReset: true,
    });
  };

  if (loading) {
    return (
      <div className="student-page">
        <div className="student-dashboard-loading">
          <div className="student-loading-spinner" />
          <p>Loading course…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="student-page">
        <div className="student-empty-card">
          <p>{error || 'Course not found'}</p>
          <Link to="/student/courses" className="section-back">
            <FiArrowLeft /> All courses
          </Link>
        </div>
      </div>
    );
  }

  const serverPct = Math.round(data.progress?.percentComplete || 0);
  const pct = courseProgressPercent({
    lectureDone: analytics.lectureDone,
    lectureTotal: analytics.lectureTotal,
    quizDone: analytics.quizDone,
    quizTotal: analytics.quizTotal,
    serverPct,
  });
  const done = !!data.progress?.completedAt || pct >= 100;
  const dueDays = daysUntil(data.enrollment?.dueAt);
  const nextLecId = firstIncomplete?.lec?._id;
  const statusLabel = done ? 'Completed' : pct > 0 ? 'In progress' : 'Ready to start';

  return (
    <div className="student-page sco" style={{ '--courses-accent': COURSES_ACCENT }}>
      <nav className="sco-crumb">
        <Link to="/student/courses">
          <FiArrowLeft size={14} /> Courses
        </Link>
        <span>/</span>
        <span>{data.course.title}</span>
      </nav>

      <header className="sco-hero">
        <div className="sco-hero-glow" aria-hidden />
        <div className="sco-hero-copy">
          <p className="sco-hero-eyebrow">{statusLabel}</p>
          <h1>{data.course.title}</h1>
          <div className="sco-pills">
            {data.course.level && (
              <span className="sco-pill">
                <FiLayers size={12} /> {LEVEL_LABELS[data.course.level] || data.course.level}
              </span>
            )}
            {data.course.estimatedHours != null && (
              <span className="sco-pill">
                <FiClock size={12} /> {data.course.estimatedHours}h
              </span>
            )}
            <span className="sco-pill">
              <FiLock size={12} />
              {data.course.unlockMode === 'open' ? 'All modules open' : 'Unlock in order'}
            </span>
            {dueDays != null && (
              <span className={`sco-pill ${dueDays < 0 ? 'is-late' : ''}`}>
                <FiTarget size={12} />
                {dueDays < 0 ? 'Overdue' : dueDays === 0 ? 'Due today' : `${dueDays}d left`}
              </span>
            )}
          </div>
          <div className="sco-stat-row">
            <div className="sco-stat">
              <FiVideo />
              <b>
                {analytics.lectureDone}/{analytics.lectureTotal}
              </b>
              <span>Lectures</span>
            </div>
            <div className="sco-stat">
              <FiLayers />
              <b>
                {analytics.moduleDone}/{analytics.moduleTotal}
              </b>
              <span>Modules</span>
            </div>
            <div className="sco-stat">
              <FiClock />
              <b>{formatDuration(analytics.watchedSec)}</b>
              <span>Watched</span>
            </div>
            <div className="sco-stat">
              <FiFileText />
              <b>
                {data.scorecard?.quizzesSubmitted > 0
                  ? `${data.scorecard.percentage}%`
                  : `${analytics.quizDone}/${analytics.quizTotal || 0}`}
              </b>
              <span>{data.scorecard?.quizzesSubmitted > 0 ? 'Quiz score' : 'Quizzes'}</span>
            </div>
          </div>
        </div>
        <div className="sco-hero-cta">
          <CourseProgressRing percent={pct} size={108} label="Complete" />
          {firstIncomplete?.lec && (
            <button type="button" className="sco-start" onClick={() => goLecture(firstIncomplete.lec._id)}>
              <FiPlay /> {pct > 0 ? 'Continue' : 'Start learning'}
            </button>
          )}
          {firstIncomplete?.quiz && !firstIncomplete?.lec && (
            <button type="button" className="sco-start" onClick={() => startQuiz(firstIncomplete.mod._id)}>
              <FiFileText /> Take quiz
            </button>
          )}
          {done && !firstIncomplete && <p className="sco-done-msg">Course complete</p>}
        </div>
      </header>

      {quizMessage && <p className="sco-banner">{quizMessage}</p>}

      <div className="sco-workspace">
        <section className="sco-outline" aria-label="Course content">
          <div className="sco-outline-head">
            <div>
              <h2>Course content</h2>
              <p>
                {analytics.lectureDone} of {analytics.lectureTotal} lectures complete
                {data.course.unlockMode === 'open'
                  ? ' · every module is open'
                  : ' · finish a module to unlock the next'}
              </p>
            </div>
            <span className="sco-outline-pct">{pct}%</span>
          </div>

          <div className="sco-outline-scroll" ref={outlineRef}>
            {(data.modules || []).map((mod, idx) => {
              const mp = moduleProgress(mod);
              const open = String(openModuleId) === String(mod._id);
              const locked = !mod.unlocked;
              const showQuiz = !!(mod.hasQuiz || (mod.quizStatus && mod.quizStatus !== 'none'));
              const quizSubmitted = mod.quizStatus === 'submitted';
              const quizLocked = locked || mod.quizStatus === 'locked';
              return (
                <article
                  key={mod._id}
                  className={`sco-mod ${open ? 'is-open' : ''} ${locked ? 'is-locked' : ''} ${mod.completedAt ? 'is-done' : ''}`}
                  style={{ '--stagger': `${idx * 70}ms` }}
                >
                  <button
                    type="button"
                    className="sco-mod-head"
                    onClick={() => setOpenModuleId(open ? null : mod._id)}
                    aria-expanded={open}
                  >
                    <span className="sco-mod-idx">
                      {locked ? <FiLock size={14} /> : mod.completedAt ? <FiCheck size={16} /> : idx + 1}
                    </span>
                    <span className="sco-mod-copy">
                      <span className="sco-mod-kicker">Module {idx + 1}</span>
                      <strong title={mod.title}>{mod.title}</strong>
                      <em>
                        {locked
                          ? 'Locked until the previous module is complete'
                          : `${mp.lectureDone}/${mp.lectureTotal} lectures`}
                        {showQuiz ? ` · Quiz ${quizSubmitted ? 'done' : 'pending'}` : ''}
                      </em>
                    </span>
                    <span className="sco-mod-meta">
                      <b>{mp.pct}%</b>
                      <FiChevronDown className="sco-mod-chevron" />
                    </span>
                  </button>
                  <div className="sco-mod-body">
                    <div className="sco-mod-body-inner">
                      <div className="sco-mod-section">
                        <p className="sco-lec-label">Lectures</p>
                        <ul className="sco-lec-list sco-lec-panel">
                          {(mod.lectures || []).map((lec) => {
                            const watchPct = lectureWatchPct(lec);
                            const isNext = String(lec._id) === String(nextLecId);
                            const showProgress = !lec.completed && watchPct > 0;
                            return (
                              <li key={lec._id}>
                                <button
                                  type="button"
                                  className={`sco-lec ${lec.completed ? 'is-done' : ''} ${isNext ? 'is-next' : ''}`}
                                  disabled={locked}
                                  onClick={() => goLecture(lec._id)}
                                >
                                  <span className="sco-lec-ico">
                                    {lec.completed ? <FiCheck size={14} /> : <FiPlay size={14} />}
                                  </span>
                                  <span className="sco-lec-copy">
                                    <span className="sco-lec-top">
                                      <strong>{lec.title}</strong>
                                      <span className={`sco-lec-tag ${lec.completed ? 'is-on' : isNext ? 'is-next' : ''}`}>
                                        {lec.completed ? 'Done' : isNext ? 'Up next' : showProgress ? 'In progress' : 'Start'}
                                      </span>
                                    </span>
                                    <em>
                                      {lec.durationSec ? formatDuration(lec.durationSec) : 'Lecture'}
                                      {lec.hasNotesHtml || lec.hasNotesPdf ? ' · Notes' : ''}
                                    </em>
                                    {showProgress && (
                                      <span className="sco-lec-progress" aria-label={`${watchPct}% watched`}>
                                        <span className="sco-lec-progress-track">
                                          <i style={{ width: `${watchPct}%` }} />
                                        </span>
                                        <span className="sco-lec-progress-val">{watchPct}%</span>
                                      </span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>

                      {showQuiz && (
                        <div className="sco-mod-section sco-mod-section--quiz">
                          <p className="sco-lec-label">Quiz part</p>
                          <CourseModuleQuizCard
                            mod={mod}
                            locked={quizLocked && !quizSubmitted}
                            onStart={() => startQuiz(mod._id)}
                            onViewOfficial={() => openQuizResult(mod)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="sco-side">
          <CourseScorecard
            scorecard={data.scorecard}
            onOpenQuiz={(q) => {
              // Scorecard rows are summaries — resolve the full module so
              // openQuizResult sees quizScore/assessment fields
              const mod = (data.modules || []).find(
                (m) => String(m._id) === String(q.moduleId)
              );
              if (mod?.quizScore?.resultId && openQuizResult(mod)) return;
              setOpenModuleId(q.moduleId);
            }}
          />
          <div className="sco-continue">
            <p>Continue learning</p>
            {firstIncomplete?.lec ? (
              <>
                <div className="sco-continue-play" aria-hidden>
                  <FiPlay />
                </div>
                <h3>{firstIncomplete.lec.title}</h3>
                <em>{firstIncomplete.mod.title}</em>
                <button type="button" className="sco-start sco-start--block" onClick={() => goLecture(firstIncomplete.lec._id)}>
                  <FiPlay /> Resume lecture
                </button>
              </>
            ) : firstIncomplete?.quiz ? (
              <>
                <div className="sco-continue-play" aria-hidden>
                  <FiFileText />
                </div>
                <h3>Module quiz</h3>
                <em>{firstIncomplete.mod.title}</em>
                <button type="button" className="sco-start sco-start--block" onClick={() => startQuiz(firstIncomplete.mod._id)}>
                  Take quiz
                </button>
              </>
            ) : (
              <div className="sco-next-done">
                <FiCheck /> You finished this course
              </div>
            )}
          </div>
          <div className="sco-side-stats">
            <div>
              <span>Remaining</span>
              <strong>{formatDuration(Math.max(0, analytics.durationSec - analytics.watchedSec))}</strong>
            </div>
            <div>
              <span>Quizzes left</span>
              <strong>{Math.max(0, analytics.quizTotal - analytics.quizDone)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StudentCoursePlayer;
