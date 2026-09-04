import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiChevronDown,
  FiChevronRight,
  FiClipboard,
  FiClock,
  FiFileText,
  FiLayers,
  FiPlay,
  FiVideo,
} from 'react-icons/fi';

const TYPE_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  mixed: 'Mixed',
  sql: 'SQL',
  english: 'English',
};

const videoHint = (lecture) => {
  if (lecture.videoStatus === 'ready') {
    const mins = lecture.videoDurationSec
      ? `${Math.max(1, Math.round(lecture.videoDurationSec / 60))} min`
      : 'Ready';
    return mins;
  }
  if (lecture.videoStatus === 'processing' || lecture.videoStatus === 'uploading') {
    return 'Processing';
  }
  return 'No video';
};

const quizHint = (quiz, assessment) => {
  const label = assessment?.label || quiz?.label;
  if (!quiz && !assessment) return 'First attempt is graded · students can practise again';
  const bits = [];
  if (label) bits.push(label);
  if (quiz?.questionCount) bits.push(`${quiz.questionCount} question${quiz.questionCount === 1 ? '' : 's'}`);
  if (quiz?.durationMin) bits.push(`${quiz.durationMin} min`);
  if (quiz?.type && TYPE_LABELS[quiz.type]) bits.push(TYPE_LABELS[quiz.type]);
  bits.push('First attempt counts');
  return bits.join(' · ');
};

const VendorCourseCurriculum = ({ courseId, modules = [] }) => {
  const navigate = useNavigate();
  const [openModuleId, setOpenModuleId] = useState(modules[0]?._id || null);

  if (!modules.length) {
    return <p className="courses-muted">No modules in this course yet.</p>;
  }

  return (
    <div className="vc-curriculum">
      {modules.map((mod, idx) => {
        const open = String(openModuleId) === String(mod._id);
        const lectures = mod.lectures || [];
        const showQuiz = !!(mod.hasQuiz || mod.quiz);
        return (
          <section key={mod._id} className={`vc-mod ${open ? 'is-open' : ''}`}>
            <button
              type="button"
              className="vc-mod-head"
              onClick={() => setOpenModuleId(open ? null : mod._id)}
              aria-expanded={open}
            >
              <span className="vc-mod-num">{idx + 1}</span>
              <span className="vc-mod-text">
                <strong title={mod.title}>{mod.title}</strong>
                <span>
                  Module {idx + 1}
                  {` · ${lectures.length} lecture${lectures.length !== 1 ? 's' : ''}`}
                  {showQuiz ? ' · Quiz' : ''}
                </span>
                {mod.description ? <span className="vc-mod-desc">{mod.description}</span> : null}
              </span>
              {showQuiz && (
                <span className="vc-pill vc-pill--quiz">
                  <FiClipboard size={12} /> Quiz
                </span>
              )}
              {open ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
            </button>

            {open && (
              <div className="vc-mod-body">
                <div className="vc-mod-section">
                  <p className="vc-sec-label">Lectures</p>
                  <ul className="vc-lec-list">
                    {!lectures.length && (
                      <li className="courses-muted" style={{ padding: '8px 4px' }}>
                        No lectures in this module.
                      </li>
                    )}
                    {lectures.map((lec, li) => (
                      <li key={lec._id} className="vc-lec">
                        <button
                          type="button"
                          className="vc-lec-row"
                          onClick={() =>
                            navigate(`/vendor-admin/courses/${courseId}/lectures/${lec._id}`, {
                              preventScrollReset: true,
                            })
                          }
                          title={`Open ${lec.title}`}
                        >
                          <span className="vc-lec-num">{li + 1}</span>
                          <span className="vc-lec-main">
                            <strong>{lec.title}</strong>
                            {lec.description ? <span>{lec.description}</span> : null}
                          </span>
                          <span className={`vc-pill ${lec.videoStatus === 'ready' ? 'is-on' : ''}`}>
                            <FiVideo size={11} /> {videoHint(lec)}
                          </span>
                          <span className={`vc-pill ${lec.hasNotesPdf || lec.hasNotesHtml ? 'is-on' : ''}`}>
                            <FiFileText size={11} />
                            {lec.hasNotesPdf && lec.hasNotesHtml
                              ? 'PDF + notes'
                              : lec.hasNotesPdf
                                ? 'PDF'
                                : lec.hasNotesHtml
                                  ? 'Notes'
                                  : 'No notes'}
                          </span>
                          <FiPlay size={16} className="vc-lec-play" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {showQuiz && (
                  <div className="vc-mod-section vc-mod-section--quiz">
                    <p className="vc-sec-label">Quiz part</p>
                    <div className="vc-quiz">
                      <span className="vc-quiz-ico" aria-hidden>
                        <FiClipboard size={16} />
                      </span>
                      <span className="vc-quiz-copy">
                        <strong>{mod.quiz?.title || 'Module quiz'}</strong>
                        <em>{quizHint(mod.quiz, mod.assessment)}</em>
                      </span>
                      <span className="vc-quiz-meta">
                        {mod.quiz?.questionCount ? (
                          <span className="vc-pill">
                            <FiLayers size={11} /> {mod.quiz.questionCount} Q
                          </span>
                        ) : null}
                        {mod.quiz?.durationMin ? (
                          <span className="vc-pill">
                            <FiClock size={11} /> {mod.quiz.durationMin}m
                          </span>
                        ) : null}
                        <span className="vc-quiz-cta">Students only</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

export default VendorCourseCurriculum;
