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
  const [remoteLoading, setRemoteLoading] = useState(false);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const remoteSeqRef = useRef(0);
  const selectedSlugsRef = useRef(new Set());

  const { searchTags, filterLocal, registerTag } = useTagSuggestions();
  const selectedSlugs = useMemo(() => new Set(tags.map(tagSlug)), [tags]);
  selectedSlugsRef.current = selectedSlugs;

  const trimmedInput = input.trim();
  const showSuggestions = trimmedInput.length > 0 && !disabled;

  const mergeSuggestions = useCallback((local, remote, exclude) => {
    const merged = new Map();
    [...local, ...(remote || [])].forEach((item) => {
      if (!item?.slug || exclude.has(item.slug)) return;
      merged.set(item.slug, item);
    });
    return [...merged.values()].slice(0, 8);
  }, []);

  const refreshSuggestions = useCallback(
    async (query, { refreshLocal = true } = {}) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setSuggestions([]);
        setRemoteLoading(false);
        return;
      }

      const exclude = selectedSlugsRef.current;
      const local = filterLocal(trimmed, exclude);
      if (refreshLocal) {
        setSuggestions(local);
      }

      const seq = ++remoteSeqRef.current;
      setRemoteLoading(true);
      try {
        const remote = await searchTags(trimmed);
        if (seq !== remoteSeqRef.current) return;
        if (remote === null) return;

        setSuggestions((prev) => {
          const merged = mergeSuggestions(local, remote, exclude);
          return merged.length ? merged : prev;
        });
      } finally {
        if (seq === remoteSeqRef.current) {
          setRemoteLoading(false);
        }
      }
    },
    [filterLocal, mergeSuggestions, searchTags]
  );

  useEffect(() => {
    if (!showSuggestions) {
      clearTimeout(debounceRef.current);
      setSuggestions([]);
      setActiveIndex(-1);
      setRemoteLoading(false);
      return undefined;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refreshSuggestions(input, { refreshLocal: false });
    }, 150);

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

  const onInputChange = (e) => {
    const next = e.target.value;
    setInput(next);
    setActiveIndex(-1);

    if (!next.trim()) {
      remoteSeqRef.current += 1;
      setSuggestions([]);
      setRemoteLoading(false);
      return;
    }

    remoteSeqRef.current += 1;
    const local = filterLocal(next, selectedSlugsRef.current);
    setSuggestions(local);
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
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && options.length > 0}
            aria-controls="tag-input-suggestions"
          />
        </div>

        {showSuggestions && (remoteLoading || options.length > 0) && (
          <div id="tag-input-suggestions" className="tag-input-suggest-strip" role="listbox">
            {remoteLoading && options.length === 0 && (
              <span className="tag-input-suggest-hint">Finding tags…</span>
            )}
            {options.map((opt, index) => (
              <button
                key={opt.slug}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`tag-input-suggest-pill ${opt.isCreate ? 'is-create' : ''} ${activeIndex === index ? 'is-active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickOption(index);
                }}
                onMouseEnter={() => setActiveIndex(index)}
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
