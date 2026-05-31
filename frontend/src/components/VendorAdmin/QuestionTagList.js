import React from 'react';
import { tagSlug } from '../../utils/tagUtils';

const QuestionTagList = ({ tags = [], max = 3, empty = '—', onTagClick, activeSlug = '', compact = false }) => {
  const list = (tags || []).filter(Boolean);
  if (!list.length) {
    return empty ? <span className="vh-cell-muted">{empty}</span> : null;
  }

  const visible = list.slice(0, max);
  const extra = list.length - visible.length;

  return (
    <div className={`vh-tag-list${compact ? ' vh-tag-list--compact' : ''}`}>
      {visible.map((tag) => {
        const slug = tagSlug(tag);
        const clickable = typeof onTagClick === 'function';
        const className = `vh-tag${activeSlug === slug ? ' is-active' : ''}${clickable ? ' is-clickable' : ''}`;
        if (clickable) {
          return (
            <button
              key={slug}
              type="button"
              className={className}
              onClick={() => onTagClick(activeSlug === slug ? '' : slug)}
            >
              {tag}
            </button>
          );
        }
        return (
          <span key={slug} className={className}>
            {tag}
          </span>
        );
      })}
      {extra > 0 && <span className="vh-tag vh-tag--more">+{extra}</span>}
    </div>
  );
};

export default QuestionTagList;
