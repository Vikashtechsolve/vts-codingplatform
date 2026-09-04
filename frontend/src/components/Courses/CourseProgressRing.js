import React from 'react';

const CourseProgressRing = ({
  percent = 0,
  size = 96,
  stroke,
  label,
  tone = 'accent',
}) => {
  const sw = stroke ?? Math.max(6, Math.round(size * 0.085));
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.min(100, Math.max(0, Number(percent) || 0));
  const offset = c - (value / 100) * c;
  const numSize = Math.max(18, Math.round(size * 0.24));

  return (
    <div
      className={`courses-progress-metric tone-${tone}`}
      style={{ '--ring-size': `${size}px`, '--ring-num': `${numSize}px` }}
    >
      <div className="courses-progress-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            className="courses-progress-ring-bg"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={sw}
          />
          <circle
            className="courses-progress-ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={sw}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="courses-progress-ring-label">
          <strong>{Math.round(value)}%</strong>
        </div>
      </div>
      {label ? <span className="courses-progress-caption">{label}</span> : null}
    </div>
  );
};

export default CourseProgressRing;
