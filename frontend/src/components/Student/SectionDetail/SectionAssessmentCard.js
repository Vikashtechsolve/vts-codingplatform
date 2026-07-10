import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiPlay, FiAward, FiClock, FiLayers, FiTrendingUp } from 'react-icons/fi';
import { STATUS_GROUPS } from '../../../utils/studentSectionItems';
import { truncateCardPreview } from '../../../utils/interviewCardText';

const HIDDEN_META_LABELS = new Set(['Topic']);

const META_ICONS = {
  Duration: FiClock,
  Type: FiLayers,
  Difficulty: FiTrendingUp,
};

const formatInterviewMetaValue = (label, value) => {
  if (!value) return value;
  if (label === 'Type') return truncateCardPreview(String(value), 32);
  if (label === 'Difficulty') return truncateCardPreview(String(value), 24);
  return truncateCardPreview(String(value), 48);
};

const SectionAssessmentCard = ({ item, sectionId, sectionIcon: SectionIcon, sectionAccent }) => {
  const isInterview = sectionId === 'interview';
  const displayMeta = (item.meta || []).filter((m) => !HIDDEN_META_LABELS.has(m.label));

  return (
    <article
      className={`assessment-card assessment-card--${item.statusGroup}${
        isInterview ? ' assessment-card--interview' : ''
      }`}
      style={{ '--card-accent': sectionAccent }}
    >
      <div className="assessment-card-head">
        <span className="assessment-icon">
          <SectionIcon />
        </span>
        <div className="assessment-head-text">
          <h3 className="assessment-title">{item.title}</h3>
          <span className={`assessment-badge assessment-badge--${item.statusGroup}`}>
            {item.statusLabel}
          </span>
        </div>
        {item.score != null && (
          <span className="assessment-score">{item.score}%</span>
        )}
      </div>

      {displayMeta.length > 0 && isInterview && (
        <ul className="assessment-interview-meta">
          {displayMeta.map((m) => {
            const Icon = META_ICONS[m.label];
            const value = formatInterviewMetaValue(m.label, m.value);
            return (
              <li key={`${m.label}-${m.value}`} title={m.value}>
                {Icon && <Icon aria-hidden />}
                <span>{value}</span>
              </li>
            );
          })}
        </ul>
      )}

      {displayMeta.length > 0 && !isInterview && (
        <ul className="assessment-details">
          {displayMeta.map((m) => (
            <li key={`${m.label}-${m.value}`} className="assessment-detail-item">
              <span className="assessment-detail-label">{m.label}</span>
              <span className="assessment-detail-value">{m.value}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="assessment-card-foot">
        {item.primary?.disabled ? (
          <div className="assessment-disabled-action">
            <span
              className="assessment-btn assessment-btn--disabled"
              title={item.primary.hint || ''}
            >
              <FiClock />
              {item.primary.label}
            </span>
            {item.primary.hint && (
              <span className="assessment-disabled-hint">{item.primary.hint}</span>
            )}
          </div>
        ) : (
          item.primary && (
            <Link
              to={item.primary.link}
              className={`assessment-btn assessment-btn--${item.primary.variant || 'primary'}`}
            >
              {item.primary.variant === 'secondary' ? <FiAward /> : <FiPlay />}
              {item.primary.label}
              <FiArrowRight />
            </Link>
          )
        )}
        {item.secondary && (
          <Link to={item.secondary.link} className="assessment-btn assessment-btn--ghost">
            {item.secondary.label}
          </Link>
        )}
        {!item.primary && item.statusGroup === STATUS_GROUPS.PENDING && (
          <span className="assessment-muted">Awaiting review</span>
        )}
      </div>
    </article>
  );
};

export default SectionAssessmentCard;
