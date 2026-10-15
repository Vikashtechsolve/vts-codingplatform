import React from 'react';

const Shimmer = ({ className = '' }) => (
  <span className={`practice-skel ${className}`.trim()} aria-hidden />
);

const StatSkeleton = () => (
  <article className="practice-stat-card practice-stat-card--skel">
    <div className="practice-stat-top">
      <Shimmer className="practice-skel-icon" />
      <Shimmer className="practice-skel-line practice-skel-line--sm" />
    </div>
    <Shimmer className="practice-skel-line practice-skel-line--value" />
    <Shimmer className="practice-skel-line practice-skel-line--hint" />
    <Shimmer className="practice-skel-meter" />
  </article>
);

const PracticeLoading = ({ message = 'Loading…', variant = 'page' }) => {
  if (variant === 'spinner') {
    return (
      <div className="practice-loading" role="status" aria-live="polite">
        <div className="practice-loading-mark" aria-hidden>
          <span className="practice-loading-ring" />
          <span className="practice-loading-dot" />
        </div>
        <p className="practice-loading-text">{message}</p>
      </div>
    );
  }

  if (variant === 'list' || variant === 'rankings') {
    return (
      <div
        className={`practice-skel-list ${variant === 'rankings' ? 'practice-skel-rankings' : ''}`.trim()}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="practice-skel-sr">{message}</span>
        {variant === 'rankings' && (
          <div className="ps-rank-summary practice-stat-card--skel">
            <Shimmer className="practice-skel-line practice-skel-line--value" />
            <Shimmer className="practice-skel-line practice-skel-line--wide" />
          </div>
        )}
        {Array.from({ length: variant === 'rankings' ? 6 : 8 }, (_, i) => (
          <div key={i} className="practice-skel-row">
            <Shimmer className="practice-skel-dot" />
            <Shimmer className="practice-skel-line practice-skel-line--wide" />
            <Shimmer className="practice-skel-chip" />
            <Shimmer className="practice-skel-chip" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="practice-skel-page" role="status" aria-live="polite" aria-busy="true">
      <span className="practice-skel-sr">{message}</span>
      <div className="practice-stats-grid">
        {Array.from({ length: 5 }, (_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <section className="ps-progress ps-progress--skel">
        <div className="ps-progress-summary">
          <Shimmer className="practice-skel-ring" />
          <div className="ps-progress-copy">
            <Shimmer className="practice-skel-line practice-skel-line--title" />
            <Shimmer className="practice-skel-line practice-skel-line--wide" />
            <div className="ps-progress-pills">
              <Shimmer className="practice-skel-chip" />
              <Shimmer className="practice-skel-chip" />
            </div>
          </div>
        </div>
        <div className="ps-progress-diffs">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="ps-progress-diff-card">
              <Shimmer className="practice-skel-line practice-skel-line--sm" />
              <Shimmer className="practice-skel-line practice-skel-line--value" />
              <Shimmer className="practice-skel-meter" />
            </div>
          ))}
        </div>
      </section>
      <div className="practice-bento-row">
        <div className="practice-goal-card practice-stat-card--skel">
          <Shimmer className="practice-skel-ring practice-skel-ring--sm" />
          <div className="practice-goal-card-body">
            <Shimmer className="practice-skel-line practice-skel-line--title" />
            <Shimmer className="practice-skel-meter" />
            <Shimmer className="practice-skel-line practice-skel-line--hint" />
          </div>
        </div>
        <div className="practice-daily-card practice-stat-card--skel">
          <Shimmer className="practice-skel-line practice-skel-line--sm" />
          <Shimmer className="practice-skel-line practice-skel-line--title" />
          <Shimmer className="practice-skel-chip" />
        </div>
      </div>
    </div>
  );
};

export default PracticeLoading;
