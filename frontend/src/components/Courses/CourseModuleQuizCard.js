import React from 'react';
import { FiCheck, FiClipboard, FiLock } from 'react-icons/fi';
import { ASSESSMENT_TYPE_LABELS } from '../../utils/courseAssessment';

const CourseModuleQuizCard = ({ mod, locked, onStart, onViewOfficial }) => {
  const submitted = mod.quizStatus === 'submitted';
  const quizLocked = locked || mod.quizStatus === 'locked';
  const score = mod.quizScore;
  const attempts = Number(mod.quizAttemptCount) || (submitted ? 1 : 0);
  const state = submitted ? 'is-done' : quizLocked ? 'is-locked' : 'is-ready';
  const assessmentLabel =
    mod.assessment?.label ||
    ASSESSMENT_TYPE_LABELS[mod.assessment?.type] ||
    mod.quiz?.label ||
    'Module assessment';

  let hint = 'First attempt is graded. You can practice again after you submit.';
  if (quizLocked && !submitted) {
    hint = 'Finish every lecture in this module to unlock the quiz.';
  } else if (submitted && score) {
    hint =
      attempts > 1
        ? `Official score from your first attempt · ${attempts} attempts total`
        : 'Official score from your first attempt. Practice anytime.';
  } else if (submitted) {
    hint = 'Submitted. Practice does not change your official score.';
  }

  return (
    <div className={`sco-qcard ${state}`}>
      <div className="sco-qcard-top">
        <span className="sco-qcard-ico" aria-hidden>
          {submitted ? <FiCheck size={18} /> : quizLocked ? <FiLock size={16} /> : <FiClipboard size={18} />}
        </span>
        <div className="sco-qcard-copy">
          <strong>{assessmentLabel}</strong>
          {mod.assessment?.title ? <span className="sco-qcard-title">{mod.assessment.title}</span> : null}
          <em>{hint}</em>
        </div>
        {submitted && score ? (
          <div className="sco-qcard-mark">
            <b>{score.percentage}%</b>
            <span>
              {score.totalScore}/{score.maxScore} pts
            </span>
          </div>
        ) : null}
      </div>

      <div className="sco-qcard-foot">
        {quizLocked && !submitted ? (
          <span className="sco-qcard-locked">Locked until lectures are complete</span>
        ) : !submitted ? (
          <button type="button" className="sco-qcard-btn sco-qcard-btn--primary" onClick={onStart}>
            Start assessment
          </button>
        ) : (
          <>
            <button
              type="button"
              className="sco-qcard-btn"
              onClick={onViewOfficial}
              disabled={!score?.resultId}
            >
              View official score
            </button>
            <button type="button" className="sco-qcard-btn sco-qcard-btn--primary" onClick={onStart}>
              Practice again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CourseModuleQuizCard;
