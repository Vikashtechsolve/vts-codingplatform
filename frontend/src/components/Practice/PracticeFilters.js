import React, { useEffect, useState } from 'react';
import { FiSearch } from 'react-icons/fi';

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
    <div className="practice-filters">
      <div className="practice-filter-search">
        <FiSearch aria-hidden />
        <input
          type="search"
          placeholder="Search by title or tag…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search problems"
        />
      </div>
      <select
        value={filters.difficulty || ''}
        onChange={(e) => setField('difficulty', e.target.value)}
        aria-label="Filter by difficulty"
      >
        <option value="">All difficulties</option>
        <option value="easy">Easy</option>
        <option value="medium">Medium</option>
        <option value="hard">Hard</option>
      </select>
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
      <select
        value={filters.status || ''}
        onChange={(e) => setField('status', e.target.value)}
        aria-label="Filter by status"
      >
        <option value="">All status</option>
        <option value="solved">Solved</option>
        <option value="attempted">Attempted</option>
        <option value="unsolved">Not started</option>
      </select>
    </div>
  );
};

export default PracticeFilters;
