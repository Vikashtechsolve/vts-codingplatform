import React from 'react';
import { formatStatus, statusClass } from './practiceUtils';

const PracticeStatusIcon = ({ status, size = 18, showLabel = false, className = '' }) => {
  const st = statusClass(status);
  const label = formatStatus(status === 'unsolved' ? 'todo' : status);

  return (
    <span
      className={`ps-status ps-status--${st} ${className}`.trim()}
      title={label}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        aria-hidden
        className="ps-status-svg"
      >
        {st === 'solved' && (
          <>
            <circle cx="12" cy="12" r="10" fill="currentColor" />
            <path
              d="M7.2 12.4l3.2 3.2 6.4-6.6"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        {st === 'attempted' && (
          <>
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M8 12h8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        )}
        {st === 'unsolved' && (
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        )}
      </svg>
      {showLabel && <span className="ps-status-label">{label}</span>}
      {!showLabel && <span className="sr-only">{label}</span>}
    </span>
  );
};

export default PracticeStatusIcon;
