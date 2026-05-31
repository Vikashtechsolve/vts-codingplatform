import React from 'react';

const QuestionTagFilters = ({ tags = [], selectedSlug = '', onSelect, className = '' }) => {
  if (!tags.length) return null;

  return (
    <div className={`vh-tags-filter ${className}`.trim()}>
      <button
        type="button"
        className={`vh-tag-chip ${selectedSlug === '' ? 'is-active' : ''}`}
        onClick={() => onSelect('')}
      >
        All tags
      </button>
      {tags.map((tag) => (
        <button
          key={tag.slug}
          type="button"
          className={`vh-tag-chip ${selectedSlug === tag.slug ? 'is-active' : ''}`}
          onClick={() => onSelect(selectedSlug === tag.slug ? '' : tag.slug)}
        >
          #{tag.label}
        </button>
      ))}
    </div>
  );
};

export default QuestionTagFilters;
