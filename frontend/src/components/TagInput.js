import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useTagSuggestions from '../hooks/useTagSuggestions';
import { normalizeTags, tagSlug } from '../utils/tagUtils';
import '../styles/tag-input.css';

/**
 * Inline tag combobox — suggestions appear as you type (not a browse dropdown).
 */
const TagInput = ({
  value = [],
  onChange,
  label = 'Tags',
  hint = 'Type a tag name — matching tags appear as you type. Press Enter to add.',
  disabled = false,
  className = '',
}) => {
  const tags = normalizeTags(value);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const { loading, searchTags, filterLocal, registerTag } = useTagSuggestions();
  const selectedSlugs = useMemo(() => new Set(tags.map(tagSlug)), [tags]);

  const trimmedInput = input.trim();
  const showSuggestions = trimmedInput.length > 0 && !disabled;

  const refreshSuggestions = useCallback(
    async (query) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSuggestions([]);
        return;
      }

      const local = filterLocal(trimmed, selectedSlugs);
      setSuggestions(local);

      const remote = await searchTags(trimmed);
      const merged = new Map();
      [...local, ...(remote || [])].forEach((item) => {
        if (!selectedSlugs.has(item.slug)) merged.set(item.slug, item);
      });
      setSuggestions([...merged.values()].slice(0, 8));
    },
    [filterLocal, searchTags, selectedSlugs]
  );

  useEffect(() => {
    if (!showSuggestions) {
      setSuggestions([]);
      setActiveIndex(-1);
      return undefined;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refreshSuggestions(input), 150);
    return () => clearTimeout(debounceRef.current);
  }, [input, showSuggestions, refreshSuggestions]);

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const canCreate =
    trimmedInput &&
    !selectedSlugs.has(tagSlug(trimmedInput)) &&
    !suggestions.some((s) => s.slug === tagSlug(trimmedInput));

  const options = useMemo(() => {
    const list = [...suggestions];
    if (canCreate) {
      list.push({ slug: `__create__${tagSlug(trimmedInput)}`, label: trimmedInput, isCreate: true });
    }
    return list;
  }, [suggestions, canCreate, trimmedInput]);

  const addTag = async (rawLabel) => {
    const trimmed = String(rawLabel || '').trim().replace(/\s+/g, ' ');
    if (!trimmed || disabled) return;
    if (selectedSlugs.has(tagSlug(trimmed))) {
      setInput('');
      setActiveIndex(-1);
      return;
    }

    const canonical = await registerTag(trimmed);
    onChange(normalizeTags([...tags, canonical]));
    setInput('');
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const removeTag = (index) => {
    if (disabled) return;
    const next = [...tags];
    next.splice(index, 1);
    onChange(next);
    inputRef.current?.focus();
  };

  const pickOption = (index) => {
    const opt = options[index];
    if (!opt) return;
    addTag(opt.label);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (!options.length) return;
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (!options.length) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (activeIndex >= 0) pickOption(activeIndex);
      else if (trimmedInput) addTag(trimmedInput);
      return;
    }
    if (e.key === 'Backspace' && !input && tags.length) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div className={`tag-input-inline ${className}`.trim()} ref={rootRef}>
      {label ? <label className="tag-input-label">{label}</label> : null}
      {hint ? <p className="tag-input-hint">{hint}</p> : null}

      <div className={`tag-input-shell ${disabled ? 'is-disabled' : ''}`}>
        <div className="tag-input-row">
          {tags.map((tag, index) => (
            <span key={`${tagSlug(tag)}-${index}`} className="tag-input-chip">
              {tag}
              {!disabled && (
                <button
                  type="button"
                  className="tag-input-chip-remove"
                  onClick={() => removeTag(index)}
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="tag-input-control"
            value={input}
            disabled={disabled}
            placeholder={tags.length ? 'Add tag…' : 'Type to search tags…'}
            onChange={(e) => {
              setInput(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onKeyDown}
            aria-autocomplete="list"
            aria-expanded={showSuggestions && options.length > 0}
          />
        </div>

        {showSuggestions && (loading || options.length > 0) && (
          <div className="tag-input-suggest-strip" role="listbox">
            {loading && options.length === 0 && (
              <span className="tag-input-suggest-hint">Finding tags…</span>
            )}
            {options.map((opt, index) => (
              <button
                key={opt.slug}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`tag-input-suggest-pill ${opt.isCreate ? 'is-create' : ''} ${activeIndex === index ? 'is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pickOption(index)}
              >
                {opt.isCreate ? `+ Create "${opt.label}"` : opt.label}
                {!opt.isCreate && opt.usageCount > 0 && (
                  <span className="tag-input-suggest-count">{opt.usageCount}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TagInput;
