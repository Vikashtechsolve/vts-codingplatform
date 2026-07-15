import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import { useVendorPanel } from '../../context/VendorPanelContext';
import VendorLoadMore from '../../components/VendorAdmin/VendorLoadMore';
import VendorDataSection from '../../components/VendorAdmin/VendorDataSection';
import { normalizePaginatedResponse, mergePaginatedPages } from '../../utils/paginatedApi';
import { useListFetchLoading } from '../../hooks/useListFetchLoading';
import { VENDOR_TEST_SECTIONS, getVendorTestSectionByType } from '../../constants/vendorSections';
import CopyShareLinkButton from '../../components/CopyShareLinkButton';
import { formatTopicsCardPreview } from '../../utils/interviewCardText';
import {
  FiPlus,
  FiSearch,
  FiClock,
  FiHelpCircle,
  FiUsers,
  FiBarChart2,
  FiEdit2,
  FiTrash2,
  FiGrid,
  FiMoreVertical,
} from 'react-icons/fi';
import './TestList.css';

const VALID_TYPES = [
  'all',
  'coding',
  'mcq',
  'aptitude',
  'theory',
  'mixed',
  'sql',
  'english',
  'interview',
  'project',
  'system',
];

const FILTER_CHIPS = [
  { id: 'all', label: 'All', icon: FiGrid, accent: '#475569' },
  ...VENDOR_TEST_SECTIONS.filter((s) => !s.comingSoon).map((s) => ({
    id: s.testType || (s.hub === 'assignments' ? 'project' : s.hub === 'interviews' ? 'interview' : s.hub === 'system_design' ? 'system' : 'sql'),
    label: s.shortLabel,
    icon: s.icon,
    accent: s.accent,
  })),
];

const TYPE_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
  mixed: 'Mixed',
  sql: 'SQL',
  english: 'English',
  interview: 'Interview',
  project: 'Project (AI)',
  system: 'System Design',
};

const normalizeInterview = (i) => ({
  _id: i._id,
  title: i.title,
  type: 'interview',
  kind: 'interview',
  duration: i.duration,
  questions: i.questions || [],
  isActive: i.isActive !== false,
  interviewType: i.interviewType,
  topic: i.topic,
  createdAt: i.createdAt,
});

const normalizeAssignment = (a) => ({
  _id: a._id,
  title: a.title,
  type: 'project',
  kind: 'assignment',
  duration: a.duration,
  questions: [],
  isActive: a.status !== 'archived',
  category: a.category,
  difficulty: a.difficulty,
  totalMarks: a.totalMarks,
  totalAssigned: a.totalAssigned || 0,
  totalSubmitted: a.totalSubmitted || 0,
  totalEvaluated: a.totalEvaluated || 0,
  status: a.status,
  createdAt: a.createdAt,
});

const normalizeSystemDesign = (sd) => ({
  _id: sd._id,
  title: sd.title,
  type: 'system',
  kind: 'system_design',
  duration: sd.duration,
  questions: [],
  isActive: sd.isActive !== false,
  category: sd.category,
  difficulty: sd.difficulty,
  totalAssigned: sd.totalAssigned || 0,
  totalSubmitted: sd.totalSubmitted || 0,
  totalEvaluated: sd.totalEvaluated || 0,
  createdAt: sd.createdAt,
});

function getTypeAccent(type) {
  const chip = FILTER_CHIPS.find((c) => c.id === type);
  return chip?.accent || '#64748b';
}

function getCreateLabel(activeType) {
  if (activeType === 'interview') return 'New interview';
  if (activeType === 'project') return 'New assignment';
  if (activeType === 'system') return 'New problem';
  if (activeType === 'sql') return 'New SQL test';
  if (activeType === 'english') return 'New English test';
  return 'New test';
}

const TestList = () => {
  const [items, setItems] = useState([]);
  const {
    initialLoading,
    refreshing,
    loadingMore,
    beginFetch,
    endFetch,
  } = useListFetchLoading();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [openMenuId, setOpenMenuId] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshStats, getSectionCount, stats } = useVendorPanel();

  const typeParam = new URLSearchParams(location.search).get('type');
  const activeType = VALID_TYPES.includes(typeParam) ? typeParam : 'all';

  const activeChip = FILTER_CHIPS.find((c) => c.id === activeType) || FILTER_CHIPS[0];
  const dedicatedSection = getVendorTestSectionByType(activeType);
  const pageAccent = dedicatedSection?.accent || activeChip?.accent || '#e7210b';
  const currentListPath =
    activeType === 'all' ? '/vendor-admin/tests' : `/vendor-admin/tests?type=${activeType}`;
  const secondaryActions = (dedicatedSection?.actions || []).filter(
    (action) => !action.primary && action.to !== currentListPath
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(
    async ({ pageNum = 1, append = false } = {}) => {
      try {
        beginFetch(append);

        const searchParam = debouncedSearch.trim() || undefined;
        const limit = activeType === 'all' ? 15 : 30;
        const params = { page: pageNum, limit, search: searchParam };

        let nextItems = [];
        let nextHasMore = false;
        let nextTotal = 0;

        if (activeType === 'interview') {
          const res = await axiosInstance.get('/interviews', { params });
          const parsed = normalizePaginatedResponse(res.data);
          nextItems = parsed.items.map(normalizeInterview);
          nextHasMore = parsed.hasMore;
          nextTotal = parsed.total;
        } else if (activeType === 'project') {
          const res = await axiosInstance.get('/assignments', { params });
          const parsed = normalizePaginatedResponse(res.data);
          nextItems = parsed.items.map(normalizeAssignment);
          nextHasMore = parsed.hasMore;
          nextTotal = parsed.total;
        } else if (activeType === 'system') {
          const res = await axiosInstance.get('/system-design-problems', { params });
          const parsed = normalizePaginatedResponse(res.data);
          nextItems = parsed.items.map(normalizeSystemDesign);
          nextHasMore = parsed.hasMore;
          nextTotal = parsed.total;
        } else if (activeType === 'all') {
          const [testsRes, interviewsRes, assignmentsRes, systemRes] = await Promise.all([
            axiosInstance.get('/vendor-admin/tests', { params }),
            axiosInstance.get('/interviews', { params }).catch(() => ({ data: { items: [] } })),
            axiosInstance.get('/assignments', { params }).catch(() => ({ data: { items: [] } })),
            axiosInstance
              .get('/system-design-problems', { params })
              .catch(() => ({ data: { items: [] } })),
          ]);
          const parsedTests = normalizePaginatedResponse(testsRes.data);
          const parsedInterviews = normalizePaginatedResponse(interviewsRes.data);
          const parsedAssignments = normalizePaginatedResponse(assignmentsRes.data);
          const parsedSystem = normalizePaginatedResponse(systemRes.data);

          nextItems = [
            ...parsedTests.items.map((t) => ({ ...t, kind: 'test' })),
            ...parsedInterviews.items.map(normalizeInterview),
            ...parsedAssignments.items.map(normalizeAssignment),
            ...parsedSystem.items.map(normalizeSystemDesign),
          ].sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          nextHasMore =
            parsedTests.hasMore ||
            parsedInterviews.hasMore ||
            parsedAssignments.hasMore ||
            parsedSystem.hasMore;
          nextTotal =
            parsedTests.total +
            parsedInterviews.total +
            parsedAssignments.total +
            parsedSystem.total;
        } else {
          const res = await axiosInstance.get('/vendor-admin/tests', {
            params: { ...params, type: activeType },
          });
          const parsed = normalizePaginatedResponse(res.data);
          nextItems = parsed.items.map((t) => ({ ...t, kind: 'test' }));
          nextHasMore = parsed.hasMore;
          nextTotal = parsed.total;
        }

        setItems((prev) => (append ? mergePaginatedPages(prev, nextItems) : nextItems));
        setPage(pageNum);
        setHasMore(nextHasMore);
        setTotal(nextTotal);
        refreshStats({ silent: true });
      } catch (error) {
        console.error('Error fetching assessments:', error);
      } finally {
        endFetch();
      }
    },
    [activeType, debouncedSearch, refreshStats, beginFetch, endFetch]
  );

  useEffect(() => {
    fetchData({ pageNum: 1, append: false });
  }, [fetchData]);

  useEffect(() => {
    setOpenMenuId(null);
  }, [activeType, search]);


  const countsByType = useMemo(() => {
    const map = { all: stats.totalAssessments || 0 };
    for (const chip of FILTER_CHIPS) {
      if (chip.id === 'all') continue;
      const key = chip.id === 'sql' ? 'tools' : chip.id;
      map[chip.id] = getSectionCount(key);
    }
    return map;
  }, [getSectionCount, stats.totalAssessments]);

  const filteredItems = useMemo(() => {
    let list = [...items];
    list.sort((a, b) => {
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0);
      const da = new Date(a.createdAt || 0).getTime();
      const db = new Date(b.createdAt || 0).getTime();
      return db - da;
    });
    return list;
  }, [items, sortBy]);

  const handleDelete = async (item) => {
    const isInterview = item.kind === 'interview';
    const isAssignment = item.kind === 'assignment';
    const isSystemDesign = item.kind === 'system_design';
    const label = isInterview
      ? 'interview'
      : isAssignment
        ? 'assignment'
        : isSystemDesign
          ? 'system design problem'
          : 'test';
    const confirmMsg =
      isAssignment && (item.totalSubmitted || 0) > 0
        ? `Delete this assignment? ${item.totalSubmitted} submission(s) will be permanently removed.`
        : isSystemDesign
          ? 'Delete this system design problem and all submissions?'
          : `Delete this ${label}?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      if (isInterview) await axiosInstance.delete(`/interviews/${item._id}`);
      else if (isAssignment) await axiosInstance.delete(`/assignments/${item._id}`);
      else if (isSystemDesign) await axiosInstance.delete(`/system-design-problems/${item._id}`);
      else await axiosInstance.delete(`/tests/${item._id}`);
      await fetchData({ pageNum: 1, append: false });
    } catch (e) {
      alert(e.response?.data?.message || 'Error deleting');
    }
  };

  const setFilter = (type) => {
    navigate(type === 'all' ? '/vendor-admin/tests' : `/vendor-admin/tests?type=${type}`);
  };

  const getCreateLink = () => {
    if (activeType === 'interview') return '/vendor-admin/interviews/create';
    if (activeType === 'sql') return '/vendor-admin/sql-tests/create';
    if (activeType === 'english') return '/vendor-admin/english-tests/create';
    if (activeType === 'project') return '/vendor-admin/create-assignment';
    if (activeType === 'system') return '/vendor-admin/system-designs/create';
    return activeType !== 'all' ? `/vendor-admin/tests/create?type=${activeType}` : '/vendor-admin/tests/create';
  };

  const getAssignLink = (item) => {
    if (item.kind === 'interview') return `/vendor-admin/interviews/${item._id}/assign`;
    if (item.kind === 'assignment') return `/vendor-admin/assignments/${item._id}/assign`;
    if (item.kind === 'system_design') return `/vendor-admin/system-designs/${item._id}/assign`;
    return `/vendor-admin/tests/${item._id}/assign`;
  };

  const getResultsLink = (item) => {
    if (item.kind === 'interview') return `/vendor-admin/interviews/${item._id}/results`;
    if (item.kind === 'assignment') return `/vendor-admin/assignments/${item._id}/submissions`;
    if (item.kind === 'system_design') return `/vendor-admin/system-designs/${item._id}/submissions`;
    return `/vendor-admin/tests/${item._id}/results`;
  };

  const pageTitle =
    dedicatedSection?.label ||
    (activeType === 'all' ? 'All assessments' : `${TYPE_LABELS[activeType] || activeType} assessments`);

  const pageSubtitle =
    dedicatedSection?.description ||
    (activeType === 'all'
      ? 'Browse, assign, and review every test, interview, project, and system design in one place.'
      : activeChip?.label
        ? `Manage your ${activeChip.label.toLowerCase()} assessments.`
        : 'Manage assessments for your organization.');

  if (initialLoading) {
    return (
      <div className="vendor-tests-page" style={{ '--vt-accent': pageAccent }}>
        <div className="vendor-tests-loading">
          <div className="vendor-tests-spinner" />
          <p>Loading assessments…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-tests-page" style={{ '--vt-accent': pageAccent }}>
      <header className="vendor-tests-header">
        <div className="vendor-tests-header-text">
          <p className="vendor-tests-eyebrow">
            {dedicatedSection ? dedicatedSection.shortLabel : 'Test management'}
          </p>
          <h1>{pageTitle}</h1>
          <p className="vendor-tests-sub">{pageSubtitle}</p>
        </div>
        <div className="vendor-tests-header-actions">
          {secondaryActions.map((action) => (
            <Link key={action.to} to={action.to} className="vendor-tests-secondary-btn">
              {action.label}
            </Link>
          ))}
          <Link to={getCreateLink()} className="vendor-tests-create-btn">
            <FiPlus /> {getCreateLabel(activeType)}
          </Link>
        </div>
      </header>

      <div className="vendor-tests-toolbar">
        <div className="vendor-tests-search">
          <FiSearch aria-hidden />
          <input
            type="search"
            placeholder="Search by title, topic, or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search assessments"
          />
        </div>
        <div className="vendor-tests-toolbar-right">
          <label className="vendor-tests-sort">
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="title">Title A–Z</option>
              <option value="duration">Longest duration</option>
            </select>
          </label>
          <span className="vendor-tests-result-count">
            <strong>{filteredItems.length}</strong>
            {filteredItems.length === 1 ? ' item' : ' items'}
            {total > filteredItems.length ? ` · ${total} total` : ''}
            {search ? ' found' : ''}
          </span>
        </div>
      </div>

      <div className="vendor-tests-filters" role="tablist" aria-label="Filter by type">
        {FILTER_CHIPS.map((chip) => {
          const Icon = chip.icon;
          const count = countsByType[chip.id] ?? 0;
          const active = activeType === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`vendor-tests-filter-chip ${active ? 'active' : ''}`}
              style={{ '--chip-accent': chip.accent }}
              onClick={() => setFilter(chip.id)}
            >
              <span className="vendor-tests-filter-icon">
                <Icon />
              </span>
              <span className="vendor-tests-filter-label">{chip.label}</span>
              <span className="vendor-tests-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      <VendorDataSection refreshing={refreshing}>
      {filteredItems.length === 0 && !refreshing ? (
        <div className="vendor-tests-empty">
          <div
            className="vendor-tests-empty-icon"
            style={{ '--chip-accent': activeChip?.accent || '#64748b' }}
          >
            {(() => {
              const EmptyIcon = activeChip?.icon || FiGrid;
              return <EmptyIcon />;
            })()}
          </div>
          <h2>No assessments found</h2>
          <p>
            {search
              ? 'Try a different search term or clear the filter.'
              : `Create your first ${activeType === 'all' ? 'assessment' : TYPE_LABELS[activeType]?.toLowerCase() || 'item'} to get started.`}
          </p>
          {!search && (
            <Link to={getCreateLink()} className="vendor-tests-create-btn vendor-tests-create-btn--inline">
              <FiPlus /> {getCreateLabel(activeType)}
            </Link>
          )}
        </div>
      ) : (
        <>
        <ul className="vendor-tests-list">
          {filteredItems.map((item) => {
            const accent = getTypeAccent(item.type);
            const TypeIcon = FILTER_CHIPS.find((c) => c.id === item.type)?.icon || FiGrid;
            const resultsLabel =
              item.kind === 'assignment' || item.kind === 'system_design' ? 'Submissions' : 'Results';
            const menuOpen = openMenuId === item._id;

            return (
              <li
                key={`${item.kind}-${item._id}`}
                className="vendor-tests-card"
                style={{ '--card-accent': accent }}
              >
                <div className="vendor-tests-card-accent" aria-hidden />

                <div className="vendor-tests-card-icon">
                  <TypeIcon />
                </div>

                <div className="vendor-tests-card-body">
                  <div className="vendor-tests-card-top">
                    <h3 className="vendor-tests-card-title">{item.title}</h3>
                    <div className="vendor-tests-card-badges">
                      <span className="vendor-tests-type-pill">{TYPE_LABELS[item.type] || item.type}</span>
                      <span className={`vendor-tests-status ${item.isActive ? 'active' : 'inactive'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="vendor-tests-meta">
                    <span>
                      <FiClock /> {item.duration ?? '—'} min
                    </span>
                    {item.kind !== 'assignment' && item.kind !== 'system_design' && item.kind !== 'interview' && (
                      <span>
                        <FiHelpCircle /> {item.questions?.length || 0} questions
                      </span>
                    )}
                    {item.kind === 'interview' && (
                      <>
                        {item.interviewType && <span>{item.interviewType}</span>}
                        {item.topic && (
                          <span title={item.topic}>
                            Topic: {formatTopicsCardPreview(item.topic)}
                          </span>
                        )}
                        <span>
                          <FiHelpCircle /> {item.questions?.length || 0} questions
                        </span>
                      </>
                    )}
                    {item.kind === 'assignment' && (
                      <>
                        <span>{item.category}</span>
                        <span>{item.difficulty}</span>
                        <span>{item.totalMarks} marks</span>
                        <span>
                          <FiUsers /> {item.totalAssigned || 0} assigned
                        </span>
                        <span>
                          <FiBarChart2 /> {item.totalSubmitted || 0} submitted
                        </span>
                        {(item.totalEvaluated || 0) > 0 && (
                          <span>{item.totalEvaluated} evaluated</span>
                        )}
                      </>
                    )}
                    {item.kind === 'system_design' && (
                      <>
                        <span>{item.category}</span>
                        <span>{item.difficulty}</span>
                        <span>
                          <FiUsers /> {item.totalAssigned || 0} assigned
                        </span>
                        <span>
                          <FiBarChart2 /> {item.totalSubmitted || 0} submitted
                        </span>
                        {(item.totalEvaluated || 0) > 0 && (
                          <span>{item.totalEvaluated} evaluated</span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="vendor-tests-card-actions">
                  <CopyShareLinkButton item={item} className="vendor-tests-share" />
                  <Link to={getAssignLink(item)} className="vendor-tests-btn vendor-tests-btn--primary">
                    Assign
                  </Link>
                  <Link to={getResultsLink(item)} className="vendor-tests-btn vendor-tests-btn--ghost">
                    {resultsLabel}
                  </Link>

                  <div className="vendor-tests-more-wrap">
                    <button
                      type="button"
                      className="vendor-tests-more-btn"
                      aria-expanded={menuOpen}
                      aria-label="More actions"
                      onClick={() => setOpenMenuId(menuOpen ? null : item._id)}
                    >
                      <FiMoreVertical />
                    </button>
                    {menuOpen && (
                      <>
                        <button
                          type="button"
                          className="vendor-tests-menu-backdrop"
                          aria-label="Close menu"
                          onClick={() => setOpenMenuId(null)}
                        />
                        <div className="vendor-tests-menu">
                          {item.type === 'sql' && (
                            <Link
                              to={`/vendor-admin/sql-tests/${item._id}/questions`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              SQL questions
                            </Link>
                          )}
                          {item.type === 'english' && (
                            <Link
                              to={`/vendor-admin/english-tests/edit/${item._id}`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <FiEdit2 /> Edit test
                            </Link>
                          )}
                          {item.kind === 'test' && item.type === 'sql' && (
                            <Link
                              to={`/vendor-admin/sql-tests/${item._id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <FiEdit2 /> Edit SQL test
                            </Link>
                          )}
                          {item.kind === 'test' && ['coding', 'mcq', 'aptitude', 'theory', 'mixed'].includes(item.type) && (
                            <Link
                              to={`/vendor-admin/tests/${item._id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <FiEdit2 /> Edit test
                            </Link>
                          )}
                          {item.kind === 'assignment' && (
                            <>
                              <Link
                                to={`/vendor-admin/assignments/${item._id}`}
                                onClick={() => setOpenMenuId(null)}
                              >
                                View details
                              </Link>
                              <Link
                                to={`/vendor-admin/assignments/${item._id}/edit`}
                                onClick={() => setOpenMenuId(null)}
                              >
                                <FiEdit2 /> Edit
                              </Link>
                            </>
                          )}
                          {item.kind === 'system_design' && (
                            <Link
                              to={`/vendor-admin/system-designs/${item._id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <FiEdit2 /> Edit problem
                            </Link>
                          )}
                          {item.kind === 'interview' && (
                            <Link
                              to={`/vendor-admin/interviews/${item._id}/edit`}
                              onClick={() => setOpenMenuId(null)}
                            >
                              <FiEdit2 /> Edit interview
                            </Link>
                          )}
                          <button
                            type="button"
                            className="vendor-tests-menu-danger"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDelete(item);
                            }}
                          >
                            <FiTrash2 /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <VendorLoadMore
          hasMore={hasMore}
          loading={loadingMore || refreshing}
          loadedCount={filteredItems.length}
          total={total}
          onLoadMore={() => fetchData({ pageNum: page + 1, append: true })}
        />
        </>
      )}
      </VendorDataSection>
    </div>
  );
};

export default TestList;
