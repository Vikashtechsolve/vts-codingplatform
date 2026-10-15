import React from 'react';
import PracticeProgressRing from './PracticeProgressRing';

const DIFF_ROWS = [
  { key: 'easy', label: 'Easy', color: '#10b981' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'hard', label: 'Hard', color: '#ef4444' },
];

const PracticeProgressBoard = ({ progress, compact = false }) => {
  const total = progress?.total || 0;
  const solved = progress?.solved || 0;
  const attempted = progress?.attempted || 0;
  const remaining = Math.max(0, total - solved);
  const pct = total ? Math.round((solved / total) * 100) : 0;

  return (
    <section className={`ps-progress ${compact ? 'ps-progress--compact' : ''}`} aria-label="Practice progress">
      <div className="ps-progress-summary">
        <div className="ps-progress-ring">
          <PracticeProgressRing
            value={solved}
            max={Math.max(total, 1)}
            size={compact ? 88 : 104}
            stroke={8}
            accent="#10b981"
            sublabel={`${pct}%`}
          />
        </div>
        <div className="ps-progress-copy">
          <p className="ps-progress-kicker">Bank progress</p>
          <h2 className="ps-progress-title">
            {solved} of {total} solved
          </h2>
          <p className="ps-progress-lead">
            {attempted
              ? `${pct}% of the problem set complete · ${attempted} attempted.`
              : `${pct}% of the problem set complete.`}
          </p>
          <div className="ps-progress-pills">
            <span className="ps-progress-pill">{attempted} attempted</span>
            <span className="ps-progress-pill">{remaining} remaining</span>
          </div>
        </div>
      </div>

      <div className="ps-progress-diffs">
        {DIFF_ROWS.map((row) => {
          const item = progress?.difficulty?.[row.key] || { solved: 0, total: 0 };
          const width = item.total ? Math.min(100, Math.round((item.solved / item.total) * 100)) : 0;
          return (
            <div key={row.key} className={`ps-progress-diff-card is-${row.key}`}>
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
              <p className="ps-progress-diff-pct">{width}%</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default PracticeProgressBoard;
