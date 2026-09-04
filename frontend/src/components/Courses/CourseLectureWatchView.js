import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiClipboard,
  FiDownload,
  FiFileText,
  FiLock,
  FiPlay,
} from 'react-icons/fi';
import CourseHlsPlayer from './CourseHlsPlayer';
import RichTextDisplay from '../RichTextDisplay';

const formatDuration = (sec) => {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const CourseLectureWatchView = ({
  courseTitle,
  backTo,
  backLabel = 'Back to course',
  modules = [],
  lecture,
  lectureId,
  courseId,
  playlistUrl,
  resumePosition = 0,
  onSelectLecture,
  onStartQuiz,
  onDownloadPdf,
  onProgress,
  enableHeartbeat = false,
  watchedSeconds = 0,
  durationSec = 0,
  isComplete = false,
  previewBanner = '',
  pdfLoading = false,
  switching = false,
}) => {
  const lecturesFlat = [];
  modules.forEach((mod) => {
    (mod.lectures || []).forEach((lec) => {
      lecturesFlat.push({ ...lec, moduleId: mod._id, unlocked: mod.unlocked !== false });
    });
  });
  const idx = lecturesFlat.findIndex((l) => String(l._id) === String(lectureId));
  const prev = idx > 0 ? lecturesFlat[idx - 1] : null;
  const next = idx >= 0 && idx < lecturesFlat.length - 1 ? lecturesFlat[idx + 1] : null;
  const videoStatus = lecture?.video?.status || lecture?.videoStatus || 'none';
  const duration = Number(durationSec) || lecture?.video?.durationSec || 0;
  const hasNotes = !!(lecture?.hasNotesHtml || lecture?.hasNotesPdf || lecture?.notesHtml);

  useEffect(() => {
    const active = document.querySelector('.clw-lec-btn.is-active');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [lectureId]);

  return (
    <div className="clw">
      <nav className="clw-crumb">
        <Link to={backTo}>
          <FiChevronLeft size={14} /> {backLabel}
        </Link>
        {courseTitle && (
          <>
            <span>/</span>
            <span className="clw-crumb-course">{courseTitle}</span>
          </>
        )}
      </nav>

      {previewBanner && <p className="clw-banner">{previewBanner}</p>}

      <div className="clw-layout">
        <main className={`clw-main ${switching ? 'is-switching' : ''}`}>
          <div className="clw-video-stage">
            {playlistUrl ? (
              <CourseHlsPlayer
                playlistUrl={playlistUrl}
                courseId={courseId}
                lectureId={lectureId}
                resumePosition={resumePosition}
                onProgress={onProgress}
                enableHeartbeat={enableHeartbeat}
              />
            ) : (
              <div className="course-video-wrap courses-video-placeholder">
                {videoStatus === 'processing' || videoStatus === 'uploading'
                  ? 'Video is processing — check back shortly.'
                  : 'This lecture has no video. Notes are below.'}
              </div>
            )}
            {switching && (
              <div className="clw-switch-overlay" aria-live="polite">
                <span className="clw-switch-spinner" />
                Loading lecture…
              </div>
            )}
          </div>

          <div key={lectureId} className="clw-stage">
          <header className="clw-head">
            <div className="clw-head-text">
              <h1>{lecture?.title || 'Lecture'}</h1>
              {lecture?.description && <p>{lecture.description}</p>}
            </div>
            <div className="clw-nav-btns">
              <button
                type="button"
                className="clw-nav-btn"
                disabled={!prev || prev.unlocked === false}
                onClick={() => prev && onSelectLecture(prev._id)}
              >
                <FiChevronLeft /> Prev
              </button>
              <button
                type="button"
                className="clw-nav-btn"
                disabled={!next || next.unlocked === false}
                onClick={() => next && onSelectLecture(next._id)}
              >
                Next <FiChevronRight />
              </button>
            </div>
          </header>

          <div className="clw-meta">
            {duration > 0 && (
              <span className="courses-meta-pill">
                {enableHeartbeat
                  ? `Watched ${formatDuration(watchedSeconds)} / ${formatDuration(duration)}`
                  : formatDuration(duration)}
              </span>
            )}
            {videoStatus === 'ready' && (
              <span className="courses-badge courses-badge--ready">Video ready</span>
            )}
            {isComplete && (
              <span className="courses-badge courses-badge--published">
                <FiCheck size={12} /> Complete
              </span>
            )}
          </div>

          <section className="clw-notes">
            <div className="clw-notes-head">
              <h2>
                <FiFileText size={16} /> Lecture notes
              </h2>
              {lecture?.hasNotesPdf && (
                <button
                  type="button"
                  className="clw-pdf-btn"
                  disabled={pdfLoading}
                  onClick={onDownloadPdf}
                >
                  <FiDownload size={14} />
                  {pdfLoading ? 'Opening…' : lecture.notesPdfFileName || 'Download PDF'}
                </button>
              )}
            </div>
            {!hasNotes ? (
              <p className="courses-muted">No notes for this lecture yet.</p>
            ) : (
              <>
                {lecture?.hasNotesHtml || lecture?.notesHtml ? (
                  <div className="clw-notes-body">
                    <RichTextDisplay
                      className="rich-text-display--prose"
                      content={lecture.notesHtml || ''}
                    />
                  </div>
                ) : (
                  <p className="courses-muted">
                    PDF notes are available — use Download PDF above.
                  </p>
                )}
              </>
            )}
          </section>
          </div>
        </main>

        <aside className="clw-outline">
          <h3>Course content</h3>
          {modules.map((mod, mi) => {
            const locked = mod.unlocked === false;
            return (
              <div key={mod._id} className={`clw-mod ${locked ? 'is-locked' : ''}`}>
                <div className="clw-mod-title">
                  {locked ? <FiLock size={13} /> : <span className="clw-mod-idx">{mi + 1}</span>}
                  <span>{mod.title}</span>
                </div>
                <ul>
                  {(mod.lectures || []).map((lec) => {
                    const active = String(lec._id) === String(lectureId);
                    return (
                      <li key={lec._id}>
                        <button
                          type="button"
                          className={`clw-lec-btn ${active ? 'is-active' : ''} ${lec.completed ? 'is-done' : ''}`}
                          disabled={locked}
                          onClick={() => onSelectLecture(lec._id)}
                          title={lec.title}
                        >
                          {lec.completed ? <FiCheck size={13} /> : <FiPlay size={13} />}
                          <span>{lec.title}</span>
                        </button>
                      </li>
                    );
                  })}
                  {(mod.hasQuiz || mod.quiz) && (
                    <li>
                      <button
                        type="button"
                        className="clw-lec-btn clw-lec-btn--quiz"
                        disabled={locked || !onStartQuiz || mod.quizStatus === 'locked'}
                        onClick={() => onStartQuiz?.(mod._id)}
                      >
                        <FiClipboard size={13} />
                        <span>
                          {mod.quizStatus === 'submitted'
                            ? mod.quizScore
                              ? `Quiz · ${mod.quizScore.percentage}% · Practice`
                              : 'Quiz · Practice again'
                            : mod.quiz?.title
                              ? `Quiz · ${mod.quiz.title}`
                              : onStartQuiz
                                ? 'Module quiz'
                                : 'Quiz · preview'}
                        </span>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
};

export default CourseLectureWatchView;
