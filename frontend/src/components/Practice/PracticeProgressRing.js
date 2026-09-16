import React from 'react';

const PracticeProgressRing = ({
  value = 0,
  max = 100,
  size = 120,
  stroke = 8,
  label,
  sublabel,
  accent = 'var(--practice-accent)',
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="practice-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="practice-ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="practice-ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={accent}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="practice-ring-center">
        <span className="practice-ring-value">{value}</span>
        {label && <span className="practice-ring-label">{label}</span>}
        {sublabel && <span className="practice-ring-sublabel">{sublabel}</span>}
      </div>
    </div>
  );
};

export default PracticeProgressRing;
