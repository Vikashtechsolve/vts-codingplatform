import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiClock, FiLayers } from 'react-icons/fi';

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/**
 * Shared course card for super-admin, vendor, and student list grids.
 */
const CourseListCard = ({
  to,
  title,
  description,
  badge,
  badgeVariant = 'default',
  level,
  estimatedHours,
  meta = [],
  progress,
  icon: Icon = FiBookOpen,
  accent,
  ctaLabel = 'Open course',
}) => {
  const body = (
    <>
      <div className="courses-card-cover" style={accent ? { '--courses-accent': accent } : undefined}>
        <span className="courses-card-cover-icon" aria-hidden>
          <Icon />
        </span>
        {badge && (
          <span className={`courses-badge courses-badge--${badgeVariant}`}>{badge}</span>
        )}
      </div>
      <div className="courses-card-body">
        <h3>{title}</h3>
        <p>{description || 'No description yet.'}</p>
        {typeof progress === 'number' && (
          <div className="courses-card-progress">
            <div className="courses-progress-bar">
              <span style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <span className="courses-card-progress-label">{progress}% complete</span>
          </div>
        )}
        <div className="courses-meta">
          {level && (
            <span className="courses-meta-pill">
              <FiLayers size={12} /> {LEVEL_LABELS[level] || level}
            </span>
          )}
          {estimatedHours != null && (
            <span className="courses-meta-pill">
              <FiClock size={12} /> {estimatedHours}h
            </span>
          )}
          {meta.map((m) => (
            <span key={m} className="courses-meta-pill">
              {m}
            </span>
          ))}
        </div>
        {to && (
          <span className="courses-card-cta">
            {ctaLabel} <FiArrowRight />
          </span>
        )}
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="courses-card" style={accent ? { '--courses-accent': accent } : undefined}>
        {body}
      </Link>
    );
  }

  return (
    <article className="courses-card courses-card--static" style={accent ? { '--courses-accent': accent } : undefined}>
      {body}
    </article>
  );
};

export default CourseListCard;
