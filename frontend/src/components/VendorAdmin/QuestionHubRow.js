import React from 'react';
import { htmlToListPreview } from '../RichTextDisplay';
import QuestionTagList from './QuestionTagList';

const looksLikeHtml = (text) =>
  typeof text === 'string' && /<[a-z][\s\S]*>/i.test(text);

const getRowTitlePreview = (title) => {
  if (typeof title !== 'string') return title;
  return looksLikeHtml(title) ? htmlToListPreview(title) : title;
};

/** Horizontal question row for vendor question bank lists. */
const QuestionHubRow = ({
  accent = '#475569',
  icon: Icon,
  title,
  tags = [],
  meta = [],
  badges = [],
  actions,
  selectedTag = '',
  onTagClick,
  tagMax = 4,
}) => {
  const metaItems = (meta || []).filter(Boolean);
  const titleText = typeof title === 'string' ? title : '';
  const titlePreview = getRowTitlePreview(titleText);
  const titleTooltip = titleText ? htmlToListPreview(titleText) : undefined;

  return (
    <li className="vh-question-row" style={{ '--row-accent': accent }}>
      <div className="vh-question-row-accent" aria-hidden />

      {Icon && (
        <div className="vh-question-row-icon">
          <Icon />
        </div>
      )}

      <div className="vh-question-row-main">
        <div className="vh-question-row-title-line">
          <h3 className="vh-question-row-title" title={titleTooltip}>
            {titlePreview}
          </h3>
          {badges?.length > 0 && (
            <div className="vh-question-row-badges">
              {badges.map((badge) => (
                <span key={badge.key || badge.label} className={badge.className || 'vh-badge'}>
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="vh-question-row-meta-line">
          {(tags?.length > 0 || onTagClick) && (
            <QuestionTagList
              tags={tags}
              max={tagMax}
              empty=""
              activeSlug={selectedTag}
              onTagClick={onTagClick}
              compact
            />
          )}
          {metaItems.length > 0 && (
            <div className="vh-question-row-meta">
              {metaItems.map((item, index) => (
                <React.Fragment key={item.key || item.label || index}>
                  {index > 0 && <span className="vh-question-row-sep" aria-hidden>·</span>}
                  <span className="vh-question-row-meta-item">
                    {item.icon && <item.icon aria-hidden />}
                    {item.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      {actions && <div className="vh-question-row-actions">{actions}</div>}
    </li>
  );
};

export default QuestionHubRow;
