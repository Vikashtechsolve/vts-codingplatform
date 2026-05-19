import React from 'react';

const SectionProgressAnalysis = ({ stats, sectionAccent }) => {
  if (stats.total === 0) return null;

  const segments = [
    { key: 'completed', label: 'Completed', count: stats.completed, color: '#059669' },
    { key: 'in_progress', label: 'In progress', count: stats.inProgress, color: '#d97706' },
    { key: 'pending', label: 'Under review', count: stats.pending, color: '#7c3aed' },
    { key: 'todo', label: 'To do', count: stats.todo, color: '#2563eb' },
    { key: 'overdue', label: 'Overdue', count: stats.overdue, color: '#dc2626' },
  ].filter((s) => s.count > 0);

  return (
    <section className="section-analysis" aria-label="Progress breakdown">
      <h2 className="section-analysis-title">Progress overview</h2>
      <div className="section-analysis-body">
        <div className="section-donut-wrap">
          <svg className="section-donut" viewBox="0 0 120 120" role="img" aria-label={`${stats.completionRate}% complete`}>
            <circle cx="60" cy="60" r="48" fill="none" stroke="var(--border-color)" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={sectionAccent}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(stats.completionRate / 100) * 301.59} 301.59`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="section-donut-center">
            <span className="section-donut-value">{stats.completionRate}%</span>
            <span className="section-donut-label">complete</span>
          </div>
        </div>

        <ul className="section-breakdown-list">
          {segments.map((seg) => (
            <li key={seg.key}>
              <span className="section-breakdown-dot" style={{ background: seg.color }} />
              <span className="section-breakdown-label">{seg.label}</span>
              <span className="section-breakdown-count">{seg.count}</span>
              <span className="section-breakdown-pct">
                {Math.round((seg.count / stats.total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default SectionProgressAnalysis;
