import React from 'react';
import {
  FiCheck,
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiLoader,
  FiSave,
  FiUpload,
  FiVideo,
} from 'react-icons/fi';
import RichTextEditor from '../RichTextEditor';

export const LECTURE_STEPS = [
  { id: 'details', label: 'Details', icon: FiFileText },
  { id: 'video', label: 'Video', icon: FiVideo },
  { id: 'notes', label: 'Notes', icon: FiFileText },
];

export function getLectureStepStatus(lecture) {
  if (!lecture) {
    return { details: false, video: false, notes: false };
  }
  const videoReady = lecture.video?.status === 'ready';
  const hasNotes =
    !!lecture.notesPdfKey ||
    !!(lecture.notesHtml && String(lecture.notesHtml).trim());
  return {
    details: !!(lecture.title && lecture.title.trim()),
    video: videoReady,
    notes: hasNotes,
  };
}

export function getFirstIncompleteStep(lecture) {
  const s = getLectureStepStatus(lecture);
  if (!s.details) return 'details';
  if (!s.video) return 'video';
  return 'notes';
}

const videoStatusLabel = (status) => {
  const map = {
    none: 'Not uploaded',
    uploading: 'Uploading…',
    processing: 'Processing for streaming',
    ready: 'Ready to play',
    failed: 'Upload failed — try again',
  };
  return map[status] || status;
};

export function getStepMeta(lecture, stepId) {
  if (!lecture) {
    return { state: 'empty', hint: '—' };
  }
  const videoStatus = lecture.video?.status || 'none';
  const hasPdf = !!lecture.notesPdfKey;
  const hasHtml = !!(lecture.notesHtml && String(lecture.notesHtml).trim());

  if (stepId === 'details') {
    const ok = !!(lecture.title && lecture.title.trim());
    return { state: ok ? 'done' : 'empty', hint: ok ? 'Title saved' : 'Add title' };
  }
  if (stepId === 'video') {
    if (videoStatus === 'ready') {
      const mins = lecture.video?.durationSec
        ? `${Math.max(1, Math.round(lecture.video.durationSec / 60))} min`
        : 'Video ready';
      return { state: 'done', hint: mins };
    }
    if (videoStatus === 'uploading') return { state: 'pending', hint: 'Uploading…' };
    if (videoStatus === 'processing') return { state: 'pending', hint: 'Processing…' };
    if (videoStatus === 'failed') return { state: 'error', hint: 'Upload failed' };
    return { state: 'empty', hint: 'No video yet' };
  }
  if (stepId === 'notes') {
    if (hasPdf && hasHtml) return { state: 'done', hint: 'PDF + Rich text' };
    if (hasPdf) return { state: 'done', hint: 'PDF uploaded' };
    if (hasHtml) return { state: 'done', hint: 'Rich text added' };
    return { state: 'empty', hint: 'Optional' };
  }
  return { state: 'empty', hint: '—' };
};

const CourseLectureWorkspace = ({
  lecture,
  lectureStep,
  lectureIndex,
  lectureTotal,
  onStepChange,
  onFieldChange,
  onSave,
  onUploadVideo,
  onUploadNotesPdf,
  onPrevLecture,
  onNextLecture,
  hasPrevLecture,
  hasNextLecture,
  saving,
  uploadingVideo,
  uploadingPdf,
  justFinished,
}) => {
  const stepStatus = getLectureStepStatus(lecture);
  const videoStatus = lecture.video?.status || 'none';
  const stepIndex = LECTURE_STEPS.findIndex((s) => s.id === lectureStep);
  const completedCount = Object.values(stepStatus).filter(Boolean).length;

  const hasPdf = !!lecture.notesPdfKey;
  const hasHtml = !!(lecture.notesHtml && String(lecture.notesHtml).trim());

  const goNext = () => {
    if (stepIndex < LECTURE_STEPS.length - 1) {
      onStepChange(LECTURE_STEPS[stepIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (stepIndex > 0) {
      onStepChange(LECTURE_STEPS[stepIndex - 1].id);
    }
  };

  return (
    <div className="sa-lecture-editor">
      <div className="sa-lecture-editor-top">
        <div className="sa-lecture-editor-meta">
          <span className="sa-lecture-editor-badge">
            Lecture {lectureIndex + 1} of {lectureTotal}
          </span>
          <div className="sa-lecture-content-chips">
            <span className={`sa-lecture-chip ${stepStatus.details ? 'is-on' : ''}`}>
              Details {stepStatus.details ? '✓' : '—'}
            </span>
            <span
              className={`sa-lecture-chip ${videoStatus === 'ready' ? 'is-on' : ''} ${videoStatus === 'processing' || videoStatus === 'uploading' ? 'is-pending' : ''}`}
            >
              Video {videoStatus === 'ready' ? '✓' : videoStatus === 'processing' || videoStatus === 'uploading' ? '…' : '—'}
            </span>
            <span className={`sa-lecture-chip ${stepStatus.notes ? 'is-on' : ''}`}>
              Notes {stepStatus.notes ? '✓' : '—'}
            </span>
          </div>
        </div>
        <div className="sa-lecture-editor-lecture-nav">
          <button
            type="button"
            className="vh-btn vh-btn--ghost vh-btn--sm"
            disabled={!hasPrevLecture}
            onClick={onPrevLecture}
          >
            <FiChevronLeft /> Prev lecture
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--ghost vh-btn--sm"
            disabled={!hasNextLecture}
            onClick={onNextLecture}
          >
            Next lecture <FiChevronRight />
          </button>
        </div>
      </div>

      <nav className="sa-lecture-tabs" aria-label="Lecture sections">
        {LECTURE_STEPS.map((step) => {
          const Icon = step.icon;
          const meta = getStepMeta(lecture, step.id);
          const isCurrent = lectureStep === step.id;
          return (
            <button
              key={step.id}
              type="button"
              className={`sa-lecture-tab ${isCurrent ? 'is-current' : ''} is-${meta.state}`}
              onClick={() => onStepChange(step.id)}
            >
              <span className="sa-lecture-tab-top">
                <Icon size={15} />
                <span>{step.label}</span>
              </span>
              <span className="sa-lecture-tab-hint">{meta.hint}</span>
            </button>
          );
        })}
      </nav>

      {(justFinished || (completedCount === 3 && lectureStep === 'notes')) && (
        <div className="sa-lecture-complete-banner">
          <FiCheck size={18} />
          <span>Lecture complete</span>
          {hasNextLecture && (
            <button type="button" className="vh-btn vh-btn--primary vh-btn--sm" onClick={onNextLecture}>
              Next lecture <FiChevronRight />
            </button>
          )}
        </div>
      )}

      <div className="sa-lecture-editor-card" key={lectureStep}>
        {lectureStep === 'details' && (
          <>
            <header className="sa-lecture-editor-card-head">
              <h3>Lecture details</h3>
              <p>Title and summary shown in the course outline.</p>
            </header>
            <div className="vh-form-grid vh-form-grid--2">
              <div className="vh-field">
                <label htmlFor="lec-title">Title</label>
                <input
                  id="lec-title"
                  type="text"
                  value={lecture.title}
                  onChange={(e) => onFieldChange('title', e.target.value)}
                  placeholder="e.g. Introduction to React hooks"
                  autoFocus
                />
              </div>
              <div className="vh-field">
                <label htmlFor="lec-desc">Short description</label>
                <input
                  id="lec-desc"
                  type="text"
                  value={lecture.description || ''}
                  onChange={(e) => onFieldChange('description', e.target.value)}
                  placeholder="What will students learn?"
                />
              </div>
            </div>
            <footer className="sa-lecture-editor-card-foot">
              <button type="button" className="vh-btn vh-btn--primary" onClick={onSave} disabled={saving || !lecture.title?.trim()}>
                <FiSave /> {saving ? 'Saving…' : 'Save & continue'}
              </button>
              <button type="button" className="vh-btn vh-btn--secondary" onClick={goNext}>
                Video <FiChevronRight />
              </button>
            </footer>
          </>
        )}

        {lectureStep === 'video' && (
          <>
            <header className="sa-lecture-editor-card-head">
              <h3>Upload video</h3>
              <p>MP4 recommended. Transcoded to HLS for streaming.</p>
            </header>

            <div className={`sa-video-card sa-video-card--${videoStatus}`}>
              <FiVideo size={20} />
              <div>
                <strong>{videoStatusLabel(videoStatus)}</strong>
                {lecture.video?.durationSec ? (
                  <span className="vh-cell-muted"> · {Math.round(lecture.video.durationSec / 60)} min</span>
                ) : null}
              </div>
              {(videoStatus === 'processing' || videoStatus === 'uploading') && (
                <FiLoader className="sa-spin sa-video-card-spin" size={18} />
              )}
            </div>

            <label className={`sa-upload-tile sa-upload-tile--wide ${uploadingVideo ? 'is-busy' : ''}`}>
              {uploadingVideo ? (
                <>
                  <FiLoader className="sa-spin" size={28} />
                  Uploading…
                </>
              ) : (
                <>
                  <FiUpload size={28} />
                  <strong>{videoStatus === 'ready' ? 'Replace video' : 'Choose video file'}</strong>
                  <span className="sa-upload-hint">MP4, MOV, WebM</span>
                </>
              )}
              <input
                type="file"
                accept="video/*"
                disabled={uploadingVideo}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadVideo(file);
                  e.target.value = '';
                }}
              />
            </label>

            <footer className="sa-lecture-editor-card-foot">
              <button type="button" className="vh-btn vh-btn--secondary" onClick={goPrev}>
                <FiChevronLeft /> Details
              </button>
              <button type="button" className="vh-btn vh-btn--primary" onClick={goNext}>
                Notes <FiChevronRight />
              </button>
            </footer>
          </>
        )}

        {lectureStep === 'notes' && (
          <>
            <header className="sa-lecture-editor-card-head">
              <h3>Lecture notes</h3>
              <p>Optional PDF download and rich text beside the player.</p>
            </header>

            <div className="sa-notes-stack">
              <div className={`sa-notes-card ${hasPdf ? 'is-filled' : ''}`}>
                <div className="sa-notes-card-head">
                  <h4>PDF notes</h4>
                  <span className={`sa-notes-badge ${hasPdf ? 'is-on' : ''}`}>
                    {hasPdf ? 'Uploaded' : 'Not added'}
                  </span>
                </div>
                {hasPdf && (
                  <p className="sa-notes-file-name" title={lecture.notesPdfFileName}>
                    {lecture.notesPdfFileName || 'PDF file'}
                  </p>
                )}
                <label className={`sa-upload-tile ${uploadingPdf ? 'is-busy' : ''}`}>
                  {uploadingPdf ? (
                    <>
                      <FiLoader className="sa-spin" size={22} /> Uploading…
                    </>
                  ) : (
                    <>
                      <FiUpload size={22} />
                      {lecture.notesPdfKey ? 'Replace PDF' : 'Upload PDF'}
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    disabled={uploadingPdf}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onUploadNotesPdf(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              <div className={`sa-notes-card sa-notes-card--wide ${hasHtml ? 'is-filled' : ''}`}>
                <div className="sa-notes-card-head">
                  <h4>Rich text notes</h4>
                  <span className={`sa-notes-badge ${hasHtml ? 'is-on' : ''}`}>
                    {hasHtml ? 'Added' : 'Not added'}
                  </span>
                </div>
                <RichTextEditor
                  variant="full"
                  minHeight={320}
                  placeholder="Write notes, or paste from Notion / Docs / the web…"
                  value={lecture.notesHtml || ''}
                  onChange={(html) => onFieldChange('notesHtml', html)}
                />
              </div>
            </div>

            <footer className="sa-lecture-editor-card-foot">
              <button type="button" className="vh-btn vh-btn--secondary" onClick={goPrev}>
                <FiChevronLeft /> Video
              </button>
              <button type="button" className="vh-btn vh-btn--primary" onClick={onSave} disabled={saving}>
                <FiSave /> {saving ? 'Saving…' : 'Save lecture'}
              </button>
              {hasNextLecture && (
                <button type="button" className="vh-btn vh-btn--secondary" onClick={onNextLecture}>
                  Next lecture <FiChevronRight />
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseLectureWorkspace;
