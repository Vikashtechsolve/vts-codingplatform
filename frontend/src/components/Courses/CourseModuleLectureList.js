import React, { useEffect, useRef, useState } from 'react';
import {
  FiArrowRight,
  FiCheck,
  FiClipboard,
  FiMenu,
  FiPlus,
  FiSave,
  FiTrash2,
  FiVideo,
  FiX,
} from 'react-icons/fi';
import { getLectureStepStatus, getStepMeta } from './CourseLectureWorkspace';
import CourseModuleQuizPanel from './CourseModuleQuizPanel';

const videoLabel = (lecture) => getStepMeta(lecture, 'video').hint;
const notesLabel = (lecture) => {
  const hint = getStepMeta(lecture, 'notes').hint;
  return hint === 'Optional' ? 'No notes' : hint;
};

/**
 * Main panel — module header, lectures list, quiz section.
 */
const CourseModuleLectureList = ({
  module,
  activeLectureId,
  addingLecture,
  savingModule,
  quizSectionId,
  onAddLecture,
  onSelectLecture,
  onDeleteLecture,
  onSaveModule,
  moduleAssessment,
  moduleTest,
  loadingModuleTest,
  onLoadModuleTest,
  savingQuiz,
  onAttachPlatformAssessment,
  onCreateModuleQuiz,
  onClearAssessment,
  onUpdateQuiz,
  onRemoveQuizQuestion,
  onAddQuizQuestions,
  quizCatalog,
  quizDescription,
}) => {
  const lectures = module.lectures || [];
  const menuRef = useRef(null);
  const lectureTitleRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addLectureOpen, setAddLectureOpen] = useState(false);
  const [lectureTitle, setLectureTitle] = useState('');
  const [moduleTitle, setModuleTitle] = useState(module.title || '');
  const [moduleDescription, setModuleDescription] = useState(module.description || '');

  useEffect(() => {
    setModuleTitle(module.title || '');
    setModuleDescription(module.description || '');
    setEditOpen(false);
    setMenuOpen(false);
    setAddLectureOpen(false);
    setLectureTitle('');
  }, [module._id, module.title, module.description]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!addLectureOpen) return undefined;
    const t = window.setTimeout(() => lectureTitleRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [addLectureOpen]);

  const moduleDirty =
    moduleTitle.trim() !== (module.title || '').trim() ||
    moduleDescription.trim() !== (module.description || '').trim();

  const openEdit = () => {
    setMenuOpen(false);
    setEditOpen(true);
  };

  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;
    await onSaveModule({
      title: moduleTitle.trim(),
      description: moduleDescription.trim(),
    });
    setEditOpen(false);
  };

  const handleAddLecture = async (e) => {
    e.preventDefault();
    if (!lectureTitle.trim()) return;
    await onAddLecture(lectureTitle.trim());
    setLectureTitle('');
    setAddLectureOpen(false);
  };

  return (
    <div className="sa-module-view">
      <header className="sa-module-view-header">
        <div className="sa-module-view-head-main">
          <h2 className="sa-module-view-title" title={module.title}>
            {module.title}
          </h2>
          {module.description ? (
            <p className="sa-module-view-desc">{module.description}</p>
          ) : (
            <p className="sa-module-view-desc sa-module-view-desc--muted">
              No description yet
            </p>
          )}
          <p className="sa-module-view-meta">
            {lectures.length} lecture{lectures.length !== 1 ? 's' : ''}
            {module.testId ? ' · Quiz configured' : ''}
          </p>
        </div>

        <div className="sa-module-view-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="sa-module-menu-btn"
            aria-label="Module options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <FiMenu size={18} />
          </button>
          {menuOpen && (
            <div className="sa-module-menu" role="menu">
              <button type="button" role="menuitem" onClick={openEdit}>
                Edit module details
              </button>
            </div>
          )}
        </div>
      </header>

      {editOpen && (
        <form className="sa-module-edit-sheet" onSubmit={handleSaveModule}>
          <div className="vh-form-grid vh-form-grid--2">
            <div className="vh-field">
              <label htmlFor="module-title">Module title</label>
              <input
                id="module-title"
                type="text"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                placeholder="e.g. Introduction to HTML"
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <div className="vh-field">
              <label htmlFor="module-desc">Short description</label>
              <input
                id="module-desc"
                type="text"
                value={moduleDescription}
                onChange={(e) => setModuleDescription(e.target.value)}
                placeholder="Optional summary for this module"
                maxLength={200}
              />
            </div>
          </div>
          <div className="sa-module-edit-foot">
            <button
              type="submit"
              className="vh-btn vh-btn--primary vh-btn--sm"
              disabled={savingModule || !moduleTitle.trim() || !moduleDirty}
            >
              <FiSave size={14} />
              {savingModule ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="vh-btn vh-btn--ghost vh-btn--sm"
              onClick={() => {
                setModuleTitle(module.title || '');
                setModuleDescription(module.description || '');
                setEditOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className="sa-module-section">
        <div className="sa-module-section-head sa-module-section-head--row">
          <div>
            <h3 className="sa-module-section-title">Lectures</h3>
            <p className="sa-module-section-desc">
              Open a lecture to add video, notes, and details.
            </p>
          </div>
          <button
            type="button"
            className="vh-btn vh-btn--primary vh-btn--sm"
            onClick={() => setAddLectureOpen(true)}
          >
            <FiPlus size={15} /> Add lecture
          </button>
        </div>

        {!lectures.length ? (
          <div className="sa-module-empty">
            <FiVideo size={36} />
            <h3>No lectures yet</h3>
            <p>Click Add lecture to create your first one.</p>
            <button
              type="button"
              className="vh-btn vh-btn--secondary vh-btn--sm"
              onClick={() => setAddLectureOpen(true)}
            >
              <FiPlus size={15} /> Add lecture
            </button>
          </div>
        ) : (
          <ul className="sa-lecture-list-rows">
            {lectures.map((lec, idx) => {
              const status = getLectureStepStatus(lec);
              const stepsDone = [status.details, status.video, status.notes].filter(Boolean).length;
              const complete = stepsDone === 3;
              const videoMeta = getStepMeta(lec, 'video');

              return (
                <li key={lec._id} className="sa-lecture-list-item">
                  <button
                    type="button"
                    className={`sa-lecture-list-row ${activeLectureId === lec._id ? 'is-active' : ''}`}
                    onClick={() => onSelectLecture(lec._id)}
                    title={lec.title}
                  >
                    <span className="sa-lecture-list-num">{idx + 1}</span>
                    <span className="sa-lecture-list-main">
                      <strong>{lec.title}</strong>
                      {lec.description && (
                        <span className="sa-lecture-list-sub">{lec.description}</span>
                      )}
                    </span>
                    <span className="sa-lecture-list-badges">
                      <span className={`sa-lecture-pill ${status.details ? 'is-done' : ''}`}>
                        Details
                      </span>
                      <span className={`sa-lecture-pill ${status.video ? 'is-done' : ''} ${videoMeta.state === 'pending' ? 'is-pending' : ''}`}>
                        {videoLabel(lec)}
                      </span>
                      <span className={`sa-lecture-pill ${status.notes ? 'is-done' : ''}`}>
                        {notesLabel(lec)}
                      </span>
                    </span>
                    {complete ? (
                      <FiCheck className="sa-lecture-list-check" />
                    ) : (
                      <FiArrowRight className="sa-lecture-list-arrow" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="sa-lecture-list-delete"
                    title="Delete lecture"
                    onClick={() => onDeleteLecture(lec._id)}
                  >
                    <FiTrash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section id={quizSectionId} className="sa-module-section sa-module-quiz-section">
        <div className="sa-module-section-head">
          <h3 className="sa-module-section-title">
            <FiClipboard size={16} />
            Module quiz
          </h3>
          <p className="sa-module-section-desc">
            {quizDescription ||
              'Optional — attach a test or build a quiz from the question bank. Skip this if the module is lecture-only.'}
          </p>
        </div>
        <CourseModuleQuizPanel
          module={module}
          moduleAssessment={moduleAssessment}
          moduleTest={moduleTest}
          loadingTest={loadingModuleTest}
          onLoadTest={onLoadModuleTest}
          savingQuiz={savingQuiz}
          onAttachPlatformAssessment={onAttachPlatformAssessment}
          onCreateModuleQuiz={onCreateModuleQuiz}
          onClearAssessment={onClearAssessment}
          onUpdateQuiz={onUpdateQuiz}
          onRemoveQuestion={onRemoveQuizQuestion}
          onAddQuestions={onAddQuizQuestions}
          quizCatalog={quizCatalog}
        />
      </section>

      {addLectureOpen && (
        <div className="sa-course-modal-backdrop" onClick={() => !addingLecture && setAddLectureOpen(false)}>
          <div
            className="sa-course-modal"
            role="dialog"
            aria-labelledby="add-lecture-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sa-course-modal-head">
              <h3 id="add-lecture-title">Add lecture</h3>
              <button
                type="button"
                className="sa-course-modal-close"
                aria-label="Close"
                disabled={addingLecture}
                onClick={() => setAddLectureOpen(false)}
              >
                <FiX size={18} />
              </button>
            </div>
            <form onSubmit={handleAddLecture}>
              <div className="sa-course-modal-body">
                <div className="vh-field">
                  <label htmlFor="new-lecture-title">Lecture title</label>
                  <input
                    ref={lectureTitleRef}
                    id="new-lecture-title"
                    type="text"
                    placeholder="e.g. What is HTML?"
                    value={lectureTitle}
                    onChange={(e) => setLectureTitle(e.target.value)}
                    maxLength={120}
                    required
                  />
                  <span className="vh-field-hint">
                    You can add video and notes after creating the lecture.
                  </span>
                </div>
              </div>
              <div className="sa-course-modal-foot">
                <button
                  type="button"
                  className="vh-btn vh-btn--ghost"
                  disabled={addingLecture}
                  onClick={() => setAddLectureOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="vh-btn vh-btn--primary"
                  disabled={addingLecture || !lectureTitle.trim()}
                >
                  <FiPlus size={15} />
                  {addingLecture ? 'Creating…' : 'Create lecture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseModuleLectureList;
