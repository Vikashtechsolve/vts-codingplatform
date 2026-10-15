import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiSearch, FiX } from 'react-icons/fi';

const COLLAPSED_MAX_PX = 72;

const QuestionTagFilters = ({ tags = [], selectedSlug = '', onSelect, className = '' }) => {
  const chipsRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    setQuery('');
    setExpanded(false);
  }, [tags]);

  const filteredTags = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? tags.filter((tag) =>
          String(tag.label || tag.slug || '').toLowerCase().includes(q)
        )
      : tags;

    if (!selectedSlug) return list;
    return [...list].sort((a, b) => {
      if (a.slug === selectedSlug) return -1;
      if (b.slug === selectedSlug) return 1;
      return 0;
    });
  }, [tags, query, selectedSlug]);

  useLayoutEffect(() => {
    const el = chipsRef.current;
    if (!el) return undefined;

    const measure = () => {
      setOverflows(el.scrollHeight > COLLAPSED_MAX_PX + 8);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filteredTags, expanded, query]);

  if (!tags.length) return null;

  const searching = query.trim().length > 0;
  const showAllChips = expanded || searching;
  const showToggle = overflows && !searching;

  return (
    <div className={`vh-tags-filter ${showAllChips ? 'is-expanded' : ''} ${className}`.trim()}>
      <div className="vh-tags-filter-toolbar">
        <p className="vh-tags-filter-label">Topics</p>
        <label className="vh-tags-filter-search">
          <FiSearch aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim()) setExpanded(true);
            }}
            placeholder="Search topics"
            aria-label="Search topics"
          />
          {query ? (
            <button
              type="button"
              className="vh-tags-filter-clear"
              onClick={() => setQuery('')}
              aria-label="Clear topic search"
            >
              <FiX />
            </button>
          ) : null}
        </label>
        {showToggle && (
          <button
            type="button"
            className="vh-tags-filter-toggle"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                Collapse <FiChevronUp aria-hidden />
              </>
            ) : (
              <>
                Expand <FiChevronDown aria-hidden />
              </>
            )}
          </button>
        )}
      </div>

      <div className="vh-tags-filter-body">
        <div
          ref={chipsRef}
          className={`vh-tags-filter-chips ${showAllChips ? 'is-expanded' : ''}`}
          style={showAllChips ? undefined : { maxHeight: COLLAPSED_MAX_PX }}
        >
          <button
            type="button"
            className={`vh-tag-chip ${selectedSlug === '' ? 'is-active' : ''}`}
            onClick={() => onSelect('')}
          >
            All topics
          </button>
          {filteredTags.map((tag) => (
            <button
              key={tag.slug}
              type="button"
              className={`vh-tag-chip ${selectedSlug === tag.slug ? 'is-active' : ''}`}
              onClick={() => onSelect(selectedSlug === tag.slug ? '' : tag.slug)}
            >
              {tag.label}
              {tag.count != null ? <span className="vh-tag-chip-count">{tag.count}</span> : null}
            </button>
          ))}
          {searching && !filteredTags.length && (
            <span className="vh-tags-filter-empty">No topics match “{query.trim()}”</span>
          )}
        </div>
        {!showAllChips && overflows && <div className="vh-tags-filter-fade" aria-hidden />}
      </div>
    </div>
  );
};

export default QuestionTagFilters;
