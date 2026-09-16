import React from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight, FiClock } from 'react-icons/fi';
import { capitalize, formatStatus, statusClass } from './practiceUtils';

const STATUS_DOT = {
  solved: 'practice-dot--solved',
  attempted: 'practice-dot--attempted',
  unsolved: 'practice-dot--unsolved',
};

export const PracticeStatCard = ({ value, label, variant, icon: Icon, color }) => (
  <article
    className={`practice-stat-card ${variant || ''}`}
    style={color ? { '--practice-stat-color': color } : undefined}
  >
    {Icon && (
      <span className="practice-stat-icon" aria-hidden>
        <Icon />
      </span>
    )}
    <div className="practice-stat-body">
      <span className="practice-stat-value">{value}</span>
      <span className="practice-stat-label">{label}</span>
    </div>
  </article>
);

export const PracticeStatsGrid = ({ children, className = '', columns }) => (
  <div
    className={`practice-stats-grid ${className}`.trim()}
    style={columns ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : undefined}
  >
    {children}
  </div>
);

export const PracticeProblemCard = ({ question, to }) => {
  const q = question;
  const st = statusClass(q.userStatus || 'unsolved');
  return (
    <Link to={to || `/student/practice/solve/${q._id}`} className="practice-problem-card">
      <div className="practice-problem-card-head">
        <span className={`practice-dot ${STATUS_DOT[st]}`} aria-hidden />
        <h3>{q.title}</h3>
        <FiChevronRight className="practice-card-chevron" aria-hidden />
      </div>
      <div className="practice-problem-meta">
        <span className={`practice-diff practice-diff-${q.difficulty}`}>
          {capitalize(q.difficulty)}
        </span>
        {(q.practiceTopics || []).slice(0, 2).map((t) => (
          <span key={t._id || t.slug} className="practice-topic-chip">
            {t.label || t.slug}
          </span>
        ))}
        {q.estimatedMinutes && (
          <span className="practice-meta-muted">
            <FiClock aria-hidden /> {q.estimatedMinutes}m
          </span>
        )}
      </div>
    </Link>
  );
};

export const PracticeProblemTable = ({ items }) => (
  <div className="practice-table-wrap">
    <table className="practice-table">
      <thead>
        <tr>
          <th className="practice-th-status">Status</th>
          <th>Problem</th>
          <th>Difficulty</th>
          <th>Topics</th>
          <th className="practice-th-action" />
        </tr>
      </thead>
      <tbody>
        {items.map((q) => {
          const st = statusClass(q.userStatus);
          return (
            <tr key={q._id}>
              <td>
                <span className="practice-status-cell">
                  <span className={`practice-dot ${STATUS_DOT[st]}`} aria-hidden />
                  <span className="practice-status-text">{formatStatus(q.userStatus)}</span>
                </span>
              </td>
              <td>
                <Link to={`/student/practice/solve/${q._id}`} className="practice-table-title">
                  {q.title}
                </Link>
              </td>
              <td>
                <span className={`practice-diff practice-diff-${q.difficulty}`}>
                  {capitalize(q.difficulty)}
                </span>
              </td>
              <td className="practice-table-topics">
                {(q.practiceTopics || []).slice(0, 2).map((t) => (
                  <span key={t._id} className="practice-topic-chip">{t.label}</span>
                ))}
              </td>
              <td className="practice-th-action">
                <Link to={`/student/practice/solve/${q._id}`} className="practice-table-action">
                  Solve <FiChevronRight aria-hidden />
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export const PracticeSubmissionRow = ({ submission, to }) => {
  const s = submission;
  const st = statusClass(s.status);
  return (
    <Link to={to} className="practice-submission-row">
      <span className={`practice-dot ${STATUS_DOT[st]}`} aria-hidden />
      <div className="practice-submission-body">
        <strong>{s.title || s.questionId?.title || 'Question'}</strong>
        <span>{formatStatus(s.status)} · {new Date(s.submittedAt).toLocaleDateString()}</span>
      </div>
      <FiChevronRight className="practice-card-chevron" aria-hidden />
    </Link>
  );
};
