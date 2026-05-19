import React from 'react';
import { FiSearch, FiSliders } from 'react-icons/fi';
import { FILTER_OPTIONS, SORT_OPTIONS } from '../../../utils/studentSectionItems';

const SectionDetailFilters = ({
  filter,
  onFilterChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  counts,
}) => {
  const getCount = (id) => {
    if (id === 'all') return counts.total;
    return counts[id] ?? 0;
  };

  return (
    <div className="section-filters-bar">
      <div className="section-search-wrap">
        <FiSearch className="section-search-icon" aria-hidden />
        <input
          type="search"
          className="section-search-input"
          placeholder="Search assessments…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search assessments"
        />
      </div>

      <div className="section-filter-chips" role="tablist" aria-label="Filter by status">
        {FILTER_OPTIONS.map((opt) => {
          const count = getCount(opt.id);
          if (opt.id !== 'all' && count === 0) return null;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={filter === opt.id}
              className={`section-filter-chip ${filter === opt.id ? 'active' : ''}`}
              onClick={() => onFilterChange(opt.id)}
            >
              {opt.label}
              <span className="section-chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="section-sort-wrap">
        <FiSliders aria-hidden />
        <select
          className="section-sort-select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Sort assessments"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default SectionDetailFilters;
