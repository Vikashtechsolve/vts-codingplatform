import React from 'react';
import { Link } from 'react-router-dom';
import { FiCode } from 'react-icons/fi';
import PracticeNav from './PracticeNav';
import PracticeLoading from './PracticeLoading';
import PracticeProgressRing from './PracticeProgressRing';

const PracticeHero = ({
  title,
  subtitle,
  eyebrow = 'Coding practice',
  score,
  scoreLabel = 'Coding score',
  compact = false,
  extra,
}) => (
  <header className={`practice-hero ${compact ? 'practice-hero--compact' : ''}`}>
    <div className="practice-hero-orb practice-hero-orb-1" aria-hidden />
    <div className="practice-hero-orb practice-hero-orb-2" aria-hidden />
    <div className="practice-hero-main">
      <p className="practice-hero-eyebrow">
        <FiCode aria-hidden /> {eyebrow}
      </p>
      <h1>{title}</h1>
      {subtitle && <p className="practice-hero-sub">{subtitle}</p>}
      {extra}
    </div>
    {score != null && (
      <div className="practice-hero-visual">
        <PracticeProgressRing
          value={score}
          max={10000}
          size={compact ? 100 : 120}
          sublabel={scoreLabel}
        />
      </div>
    )}
  </header>
);

const PracticePageLayout = ({
  active,
  title,
  subtitle,
  eyebrow,
  score,
  scoreLabel,
  compactHero = false,
  heroExtra,
  loading = false,
  loadingMessage,
  error,
  onRetry,
  children,
}) => {
  if (loading) {
    return (
      <div className="student-page practice-page">
        <PracticeLoading message={loadingMessage} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-page practice-page">
        <div className="practice-error">
          <div className="practice-error-icon" aria-hidden>!</div>
          <h2>Something went wrong</h2>
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="practice-btn practice-btn-primary" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="student-page practice-page">
      {(title || score != null) && (
        <PracticeHero
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          score={score}
          scoreLabel={scoreLabel}
          compact={compactHero}
          extra={heroExtra}
        />
      )}
      {active && <PracticeNav active={active} />}
      <div className="practice-content">{children}</div>
    </div>
  );
};

export const PracticeSection = ({ title, linkLabel, linkTo, children }) => (
  <section className="practice-section">
    <div className="practice-section-header">
      <h2>{title}</h2>
      {linkLabel && linkTo && (
        <Link to={linkTo} className="practice-section-link">{linkLabel}</Link>
      )}
    </div>
    {children}
  </section>
);

export default PracticePageLayout;
