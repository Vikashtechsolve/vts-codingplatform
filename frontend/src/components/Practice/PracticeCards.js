import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiChevronRight, FiClock } from 'react-icons/fi';
import { capitalize, formatScore, formatStatus, statusClass } from './practiceUtils';
import PracticeStatusIcon from './PracticeStatusIcon';

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
  const href = to || `/student/practice/solve/${q._id}`;
  return (
    <Link to={href} className={`practice-problem-card is-${statusClass(q.userStatus)}`}>
      <div className="practice-problem-card-head">
        <PracticeStatusIcon status={q.userStatus} size={18} />
        <h3>{q.title}</h3>
        <FiChevronRight className="practice-card-chevron" aria-hidden />
      </div>
      <div className="practice-problem-meta">
        <span className={`practice-diff practice-diff-${q.difficulty}`}>
          {capitalize(q.difficulty)}
        </span>
        <span className={`practice-status practice-status-${statusClass(q.userStatus)}`}>
          {formatStatus(q.userStatus)}
        </span>
        {q.bestScore != null && q.attempts > 0 && (
          <span className="practice-meta-muted">{formatScore(q.bestScore)}</span>
        )}
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

export const PracticeProblemTable = ({ items }) => {
  const navigate = useNavigate();

  return (
    <div className="practice-table-wrap">
      <table className="practice-table ps-problem-table">
        <thead>
          <tr>
            <th className="ps-th-status">Status</th>
            <th>Title</th>
            <th>Score</th>
            <th>Attempts</th>
            <th>Difficulty</th>
            <th>Topics</th>
          </tr>
        </thead>
        <tbody>
          {items.map((q) => {
            const href = `/student/practice/solve/${q._id}`;
            const st = statusClass(q.userStatus);
            return (
              <tr
                key={q._id}
                className={`ps-problem-row is-${st}`}
                tabIndex={0}
                onClick={() => navigate(href)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(href);
                  }
                }}
              >
                <td>
                  <PracticeStatusIcon status={q.userStatus} size={18} showLabel />
                </td>
                <td>
                  <Link
                    to={href}
                    className={`practice-table-title ${st === 'solved' ? 'is-solved' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {q.title}
                  </Link>
                </td>
                <td className="ps-score-cell">
                  {q.attempts > 0 ? formatScore(q.bestScore) : '—'}
                </td>
                <td className="ps-attempts-cell">
                  {q.attempts > 0 ? q.attempts : '—'}
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const PracticeSubmissionRow = ({ submission, to }) => {
  const s = submission;
  return (
    <Link to={to} className="practice-submission-row">
      <PracticeStatusIcon status={s.status} size={18} />
      <div className="practice-submission-body">
        <strong>{s.title || s.questionId?.title || 'Question'}</strong>
        <span>{formatStatus(s.status)} · {new Date(s.submittedAt).toLocaleDateString()}</span>
      </div>
      <FiChevronRight className="practice-card-chevron" aria-hidden />
    </Link>
  );
};
