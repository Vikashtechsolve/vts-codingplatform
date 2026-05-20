import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiSearch,
  FiSliders,
  FiCheckCircle,
  FiClock,
  FiList,
  FiTarget,
} from 'react-icons/fi';
import { useStudentPanel } from '../../../context/StudentPanelContext';
import {
  filterItemsBySection,
  normalizeSectionItems,
  computeSectionStats,
  applyFiltersAndSort,
  getFilterCounts,
  FILTER_OPTIONS,
  SORT_OPTIONS,
} from '../../../utils/studentSectionItems';
import SectionAssessmentCard from './SectionAssessmentCard';
import './SectionDetail.css';

const SectionDetailView = ({ section }) => {
  const { tests, interviews, assignments, systemDesigns, loading, englishTrends, refresh } =
    useStudentPanel();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');

  useEffect(() => {
    refresh();
  }, [section.id, refresh]);

  const rawItems = useMemo(
    () =>
      filterItemsBySection(section.id, {
        tests,
        interviews,
        assignments,
        systemDesigns,
      }),
    [section.id, tests, interviews, assignments, systemDesigns]
  );

  const allItems = useMemo(() => normalizeSectionItems(section.id, rawItems), [section.id, rawItems]);
  const stats = useMemo(() => computeSectionStats(allItems), [allItems]);
  const filterCounts = useMemo(() => getFilterCounts(allItems), [allItems]);
  const displayedItems = useMemo(
    () => applyFiltersAndSort(allItems, { filter, search, sort }),
    [allItems, filter, search, sort]
  );

  const SectionIcon = section.icon;

  if (loading) {
    return (
      <div className="section-detail-page">
        <div className="section-loading">
          <div className="student-loading-spinner" />
          <p>Loading {section.shortLabel} tests…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-detail-page" style={{ '--section-accent': section.accent }}>
      <header className="section-top">
        <Link to="/student/dashboard" className="section-back">
          <FiArrowLeft /> Dashboard
        </Link>

        <div className="section-top-row">
          <div className="section-top-brand">
            <span className="section-top-icon">
              <SectionIcon />
            </span>
            <div>
              <h1>{section.label}</h1>
              <p>{section.description}</p>
            </div>
          </div>

          <div className="section-top-stats">
            <div className="section-pill">
              <FiList />
              <span>
                <strong>{stats.total}</strong> total
              </span>
            </div>
            <div className="section-pill section-pill--green">
              <FiCheckCircle />
              <span>
                <strong>{stats.completed}</strong> completed
              </span>
            </div>
            <div className="section-pill section-pill--amber">
              <FiClock />
              <span>
                <strong>{stats.notDone}</strong> pending
              </span>
            </div>
            {stats.avgScore != null && (
              <div className="section-pill section-pill--accent">
                <FiTarget />
                <span>
                  <strong>{stats.avgScore}%</strong> avg score
                </span>
              </div>
            )}
          </div>
        </div>

        {stats.total > 0 && (
          <div className="section-completion-wrap">
            <div className="section-completion-label">
              <span>Overall progress</span>
              <span>{stats.completionRate}% complete</span>
            </div>
            <div className="section-completion-bar">
              <div className="section-completion-fill" style={{ width: `${stats.completionRate}%` }} />
            </div>
          </div>
        )}
      </header>

      {section.id === 'english' && englishTrends && (
        <div className="section-insight">
          <strong>{englishTrends.totalTests}</strong> English tests taken
          {englishTrends.latestPercentage != null && (
            <> · Latest <strong>{englishTrends.latestPercentage}%</strong></>
          )}
        </div>
      )}

      <div className="section-toolbar">
        <div className="section-search">
          <FiSearch aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${section.shortLabel.toLowerCase()} tests…`}
            aria-label="Search tests"
          />
        </div>

        <div className="section-sort">
          <FiSliders aria-hidden />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-filter-tabs" role="tablist" aria-label="Filter by status">
        {FILTER_OPTIONS.map((opt) => {
          const count = filterCounts[opt.id] ?? 0;
          if (opt.id !== 'all' && count === 0) return null;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={filter === opt.id}
              className={`section-tab ${filter === opt.id ? 'active' : ''}`}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
              <em>{count}</em>
            </button>
          );
        })}
      </div>

      <div className="section-results-meta">
        Showing <strong>{displayedItems.length}</strong> of <strong>{stats.total}</strong> tests
      </div>

      {stats.total === 0 ? (
        <div className="section-empty">
          <span className="section-empty-icon">
            <SectionIcon />
          </span>
          <h2>No {section.shortLabel} tests assigned</h2>
          <p>
            When your instructor assigns {section.label.toLowerCase()}, they will show up here with
            search, filters, and progress tracking.
          </p>
          {section.id === 'company' && (
            <p className="section-empty-hint">
              Company-specific tests appear when your organization creates tests with the company type.
            </p>
          )}
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="section-empty">
          <h2>No tests match your filters</h2>
          <p>Try a different status or clear your search.</p>
          <button
            type="button"
            className="assessment-btn assessment-btn--ghost"
            onClick={() => {
              setFilter('all');
              setSearch('');
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="section-cards-grid">
          {displayedItems.map((item) => (
            <SectionAssessmentCard
              key={item.id}
              item={item}
              sectionId={section.id}
              sectionIcon={SectionIcon}
              sectionAccent={section.accent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SectionDetailView;
