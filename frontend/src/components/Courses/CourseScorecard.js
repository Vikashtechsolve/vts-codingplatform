import React from 'react';
import { FiAward, FiCheck, FiMinus } from 'react-icons/fi';
import CourseProgressRing from './CourseProgressRing';

const bandFor = (pct, submitted) => {
  if (!submitted) return { label: 'Awaiting quizzes', tone: 'wait' };
  if (pct >= 90) return { label: 'Excellent', tone: 'high' };
  if (pct >= 75) return { label: 'Strong', tone: 'good' };
  if (pct >= 50) return { label: 'Fair', tone: 'mid' };
  return { label: 'Needs work', tone: 'low' };
};

const CourseScorecard = ({ scorecard, onOpenQuiz }) => {
  if (!scorecard || !scorecard.quizzesTotal) return null;

  const submitted = scorecard.quizzesSubmitted > 0;
  const pct = submitted ? scorecard.percentage : 0;
  const band = bandFor(pct, submitted);
  const ringTone = band.tone === 'high' ? 'high' : 'accent';

  return (
    <section className="sco-scorecard" aria-label="Course score">
      <div className="sco-scorecard-head">
        <span className="sco-scorecard-icon" aria-hidden>
          <FiAward />
        </span>
        <div className="sco-scorecard-head-text">
          <p>Course score</p>
          <span className={`sco-score-band is-${band.tone}`}>{band.label}</span>
        </div>
      </div>

      <div className="sco-scorecard-hero">
        <CourseProgressRing percent={pct} size={92} label="Overall" tone={ringTone} />
        <div className="sco-scorecard-points">
          {submitted ? (
            <>
              <b>
                {Math.round(scorecard.totalScore)}
                <em> / {Math.round(scorecard.maxScore)}</em>
              </b>
              <span>points earned</span>
              <small>
                {scorecard.quizzesSubmitted} of {scorecard.quizzesTotal}{' '}
                {scorecard.quizzesTotal === 1 ? 'quiz' : 'quizzes'} graded · first attempt
              </small>
            </>
          ) : (
            <span>Finish a module quiz to build your score.</span>
          )}
        </div>
      </div>

      <ul className="sco-score-list">
        {scorecard.quizzes.map((q, idx) => {
          const done = q.status === 'submitted' && q.score;
          return (
            <li key={q.moduleId}>
              <button
                type="button"
                className={`sco-score-row ${done ? 'is-done' : ''}`}
                onClick={() => onOpenQuiz?.(q)}
              >
                <span className="sco-score-idx">{idx + 1}</span>
                <span className="sco-score-copy">
                  <strong>{q.title}</strong>
                  <em>
                    {done
                      ? `${q.score.totalScore}/${q.score.maxScore} pts · official`
                      : q.status === 'submitted'
                        ? 'Submitted'
                        : 'Not attempted'}
                  </em>
                </span>
                <span className={`sco-score-pct ${done ? 'is-on' : ''}`}>
                  {done ? `${q.score.percentage}%` : <FiMinus size={14} />}
                </span>
                {done && <FiCheck className="sco-score-check" size={14} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default CourseScorecard;
