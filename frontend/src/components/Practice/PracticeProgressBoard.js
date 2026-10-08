import React from 'react';
import PracticeProgressRing from './PracticeProgressRing';

const DIFF_ROWS = [
  { key: 'easy', label: 'Easy', color: '#16a34a' },
  { key: 'medium', label: 'Medium', color: '#d97706' },
  { key: 'hard', label: 'Hard', color: '#dc2626' },
];

const PracticeProgressBoard = ({ progress, compact = false }) => {
  const total = progress?.total || 0;
  const solved = progress?.solved || 0;
  const attempted = progress?.attempted || 0;
  const pct = total ? Math.round((solved / total) * 100) : 0;

  return (
    <section className={`ps-progress ${compact ? 'ps-progress--compact' : ''}`} aria-label="Practice progress">
      <div className="ps-progress-ring">
        <PracticeProgressRing
          value={solved}
          max={Math.max(total, 1)}
          size={compact ? 88 : 108}
          stroke={8}
          accent="#16a34a"
          sublabel={`${pct}%`}
        />
        <p className="ps-progress-ring-meta">
          <strong>{solved}</strong>
          <span> / {total} solved</span>
        </p>
      </div>

      <div className="ps-progress-bars">
        {DIFF_ROWS.map((row) => {
          const item = progress?.difficulty?.[row.key] || { solved: 0, total: 0 };
          const width = item.total ? Math.min(100, Math.round((item.solved / item.total) * 100)) : 0;
          return (
            <div key={row.key} className="ps-progress-row">
              <div className="ps-progress-row-head">
                <span className={`ps-progress-diff ps-progress-diff--${row.key}`}>{row.label}</span>
                <span>
                  {item.solved}
                  <span className="ps-progress-muted">/{item.total}</span>
                </span>
              </div>
              <div className="ps-progress-track" aria-hidden>
                <div
                  className="ps-progress-fill"
                  style={{ width: `${width}%`, background: row.color }}
                />
              </div>
            </div>
          );
        })}
        <p className="ps-progress-attempted">
          {attempted} attempted · {Math.max(0, total - solved)} remaining
        </p>
      </div>
    </section>
  );
};

export default PracticeProgressBoard;
