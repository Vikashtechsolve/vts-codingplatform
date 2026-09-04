import React, { useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiZap } from 'react-icons/fi';

const STEPS = [
  { key: 'modules', label: 'Modules', check: (p) => p.moduleCount > 0 },
  { key: 'lectures', label: 'Lectures', check: (p) => p.lectureCount > 0 },
  {
    key: 'videos',
    label: 'Videos',
    check: (p) => p.lectureCount > 0 && p.videosReady >= p.lectureCount,
  },
  { key: 'quiz', label: 'Quizzes', check: (p) => p.quizzesSet > 0, optional: true },
  { key: 'publish', label: 'Publish', check: (p) => p.published },
];

function getNextAction(p, audience = 'vendors') {
  if (p.moduleCount === 0) {
    return { label: 'Add your first module', action: 'focus-module' };
  }
  if (p.lectureCount === 0) {
    return { label: 'Add a lecture', action: 'focus-lecture' };
  }
  if (p.lectureCount > 0 && p.videosReady < p.lectureCount) {
    return { label: 'Upload missing videos', action: 'focus-incomplete' };
  }
  if (!p.published) {
    return { label: 'Publish course', action: 'go-settings' };
  }
  return audience === 'students'
    ? { label: 'Assign students', action: 'go-vendors' }
    : { label: 'Allocate vendors', action: 'go-vendors' };
}

const CourseBuildProgress = ({ progress, refreshing, onAction, audience = 'vendors' }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { moduleCount, lectureCount, videosReady, quizzesSet, published } = progress;
  const p = useMemo(
    () => ({ moduleCount, lectureCount, videosReady, quizzesSet, published }),
    [moduleCount, lectureCount, videosReady, quizzesSet, published]
  );

  const requiredSteps = STEPS.filter((s) => !s.optional);
  const doneRequired = requiredSteps.filter((s) => s.check(p)).length;
  const pct = Math.round((doneRequired / requiredSteps.length) * 100);
  const nextAction = useMemo(() => getNextAction(p, audience), [p, audience]);

  return (
    <div className={`sa-build-card ${refreshing ? 'is-refreshing' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sa-build-card-top">
        <div className="sa-build-card-top-text">
          <h3 className="sa-build-card-title">Course readiness</h3>
          {!collapsed && (
            <p className="sa-build-card-desc">
              {pct >= 100
                ? audience === 'students'
                  ? 'All required steps complete — publish and assign students.'
                  : 'All required steps complete — publish and share with vendors.'
                : `${doneRequired} of ${requiredSteps.length} required steps done.`}
            </p>
          )}
        </div>
        <div className="sa-build-card-top-actions">
          <div className="sa-build-pct-ring" style={{ '--sa-pct': pct }} aria-hidden>
            <span>{pct}%</span>
          </div>
          <button
            type="button"
            className="sa-build-collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand progress' : 'Collapse progress'}
          >
            {collapsed ? <FiChevronDown size={18} /> : <FiChevronUp size={18} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="sa-build-track">
            <span className="sa-build-track-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="sa-build-steps">
            {STEPS.map((step) => {
              const done = step.check(p);
              return (
                <div
                  key={step.key}
                  className={`sa-build-step ${done ? 'is-done' : ''} ${step.optional ? 'is-optional' : ''}`}
                >
                  <span className="sa-build-step-dot" />
                  <span className="sa-build-step-label">{step.label}</span>
                  {step.optional && <span className="sa-build-step-tag">Optional</span>}
                </div>
              );
            })}
          </div>

          <div className="sa-build-footer">
            <div className="sa-build-stats">
              <span><strong>{moduleCount}</strong> modules</span>
              <span><strong>{lectureCount}</strong> lectures</span>
              <span><strong>{videosReady}</strong>/{lectureCount || '—'} videos</span>
            </div>
            {pct >= 100 && onAction && p.published && (
              <button
                type="button"
                className="vh-btn vh-btn--primary vh-btn--sm sa-build-next-btn"
                onClick={() => onAction(nextAction.action)}
              >
                <FiZap size={14} /> {nextAction.label}
              </button>
            )}
            {pct < 100 && onAction && (
              <button
                type="button"
                className="vh-btn vh-btn--primary vh-btn--sm sa-build-next-btn"
                onClick={() => onAction(nextAction.action)}
              >
                <FiZap size={14} /> {nextAction.label}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CourseBuildProgress;
