import React, { useEffect, useState } from 'react';
import { FiSearch } from 'react-icons/fi';

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'solved', label: 'Solved' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'unsolved', label: 'Todo' },
];

const DIFF_CHIPS = [
  { value: '', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

const PracticeFilters = ({ filters, onChange, topics = [] }) => {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        onChange({ ...filters, search: searchInput });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="practice-filters ps-filters">
      <div className="practice-filter-search">
        <FiSearch aria-hidden />
        <input
          type="search"
          placeholder="Search problems…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search problems"
        />
      </div>

      <div className="ps-chip-group" role="group" aria-label="Status">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value || 'all-status'}
            type="button"
            className={`ps-chip ${filters.status === chip.value ? 'is-active' : ''} ${chip.value ? `ps-chip--${chip.value}` : ''}`}
            onClick={() => setField('status', chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="ps-chip-group" role="group" aria-label="Difficulty">
        {DIFF_CHIPS.map((chip) => (
          <button
            key={chip.value || 'all-diff'}
            type="button"
            className={`ps-chip ${filters.difficulty === chip.value ? 'is-active' : ''} ${chip.value ? `ps-chip-diff--${chip.value}` : ''}`}
            onClick={() => setField('difficulty', chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <select
        value={filters.topic || ''}
        onChange={(e) => setField('topic', e.target.value)}
        aria-label="Filter by topic"
      >
        <option value="">All topics</option>
        {topics.map((t) => (
          <option key={t._id} value={t._id}>{t.label}</option>
        ))}
      </select>
    </div>
  );
};

export default PracticeFilters;
