import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiAward,
  FiPlus,
  FiUsers,
  FiLink,
  FiEdit2,
  FiSend,
  FiStopCircle,
  FiSearch,
  FiRefreshCw,
  FiClock,
  FiBarChart2,
  FiMic,
  FiBox,
  FiCpu,
  FiFileText,
  FiCalendar,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useToast } from '../../context/ToastContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import { VENDOR_ACCENT } from '../../constants/vendorSections';
import './ContestList.css';

const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  ended: 'Ended',
};

const ASSESSMENT_LABELS = {
  test: 'Test',
  interview: 'Interview',
  assignment: 'Assignment',
  system_design: 'System Design',
};

const ASSESSMENT_ACCENTS = {
  test: '#334155',
  interview: '#c026d3',
  assignment: '#6366f1',
  system_design: '#ea580c',
};

const ASSESSMENT_ICONS = {
  test: FiFileText,
  interview: FiMic,
  assignment: FiCpu,
  system_design: FiBox,
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const getContestPhase = (contest) => {
  if (contest.status === 'draft') return null;
  if (contest.status === 'ended') return { key: 'closed', label: 'Ended' };
  const now = Date.now();
  const start = new Date(contest.attemptWindowStart).getTime();
  const end = new Date(contest.attemptWindowEnd).getTime();
  if (Number.isFinite(start) && now < start) return { key: 'upcoming', label: 'Upcoming' };
  if (Number.isFinite(end) && now > end) return { key: 'closed', label: 'Window closed' };
  if (contest.status === 'published') return { key: 'live', label: 'Live now' };
  return null;
};

const ContestList = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/contests/vendor');
      setContests(Array.isArray(data) ? data : []);
    } catch {
      showToast('Failed to load contests', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const stats = useMemo(
    () => ({
      total: contests.length,
      published: contests.filter((c) => c.status === 'published').length,
      draft: contests.filter((c) => c.status === 'draft').length,
      ended: contests.filter((c) => c.status === 'ended').length,
    }),
    [contests]
  );

  const filterTabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'published', label: 'Published', count: stats.published },
    { key: 'draft', label: 'Drafts', count: stats.draft },
    { key: 'ended', label: 'Ended', count: stats.ended },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contests.filter((c) => {
      if (filter !== 'all' && c.status !== filter) return false;
      if (!q) return true;
      return (
        c.title?.toLowerCase().includes(q) ||
        c.assessmentTitle?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q)
      );
    });
  }, [contests, search, filter]);

  const copyLink = (slug) => {
    const url = `${window.location.origin}/contest/${slug}`;
    navigator.clipboard.writeText(url);
    showToast('Contest link copied', 'success');
  };

  const handlePublish = async (id) => {
    try {
      const { data } = await axiosInstance.post(`/contests/vendor/${id}/publish`);
      showToast(data.message || 'Published', 'success');
      fetchList();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to publish', 'error');
    }
  };

  const handleEnd = async (id) => {
    if (!window.confirm('End this contest? Students will no longer be able to attempt.')) return;
    try {
      const { data } = await axiosInstance.post(`/contests/vendor/${id}/end`);
      showToast(data.message || 'Contest ended', 'success');
      fetchList();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to end contest', 'error');
    }
  };

  return (
    <VendorHubPage
      className="vco-page"
      loading={loading && contests.length === 0}
      eyebrow="Events"
      title="Contests"
      subtitle="Run open-registration events with a shared attempt window. Students sign up via a public link — separate from your main student roster."
      accent={VENDOR_ACCENT}
      actions={
        <>
          <button type="button" className="vh-btn vh-btn--ghost" onClick={fetchList}>
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--primary"
            onClick={() => navigate('/vendor-admin/contests/create')}
          >
            <FiPlus /> Create contest
          </button>
        </>
      }
    >
      <div className="vh-stats vco-stats">
        <div className="vh-stat vh-stat--accent">
          <span className="vh-stat-label">Total</span>
          <span className="vh-stat-value">{stats.total}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Published</span>
          <span className="vh-stat-value">{stats.published}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Drafts</span>
          <span className="vh-stat-value">{stats.draft}</span>
        </div>
        <div className="vh-stat">
          <span className="vh-stat-label">Ended</span>
          <span className="vh-stat-value">{stats.ended}</span>
        </div>
      </div>

      <div className="vco-toolbar">
        <div className="vco-filters">
          {filterTabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              className={`vco-filter ${filter === key ? 'is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="vco-filter-count">{count}</span>
            </button>
          ))}
        </div>
        <div className="vh-search vco-search">
          <FiSearch />
          <input
            type="search"
            placeholder="Search by title, assessment, or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && contests.length > 0 ? (
        <div className="vco-loading-inline">Refreshing…</div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="vco-empty">
          <div className="vh-empty-icon">
            <FiAward />
          </div>
          <h2>
            {search
              ? 'No matches'
              : filter === 'all'
                ? 'No contests yet'
                : `No ${STATUS_LABELS[filter]?.toLowerCase() || filter} contests`}
          </h2>
          <p>
            {search
              ? 'Try a different search term or clear the filter.'
              : 'Create a contest, publish it, and share the link so students can register and attempt during your scheduled window.'}
          </p>
          {!search && filter === 'all' && (
            <button
              type="button"
              className="vh-btn vh-btn--primary"
              onClick={() => navigate('/vendor-admin/contests/create')}
            >
              <FiPlus /> Create contest
            </button>
          )}
        </div>
      ) : (
        <ul className="vco-list">
          {filtered.map((contest) => {
            const accent = ASSESSMENT_ACCENTS[contest.assessmentType] || VENDOR_ACCENT;
            const TypeIcon = ASSESSMENT_ICONS[contest.assessmentType] || FiAward;
            const phase = getContestPhase(contest);

            return (
              <li
                key={contest._id}
                className={`vco-card vco-card--${contest.status}`}
                style={{ '--vco-accent': accent }}
              >
                <div className="vco-card-accent" aria-hidden />

                <div className="vco-card-icon">
                  <TypeIcon />
                </div>

                <div className="vco-card-body">
                  <div className="vco-card-top">
                    <h3 className="vco-card-title">{contest.title}</h3>
                    <div className="vco-card-badges">
                      <span className="vco-type-pill">
                        {ASSESSMENT_LABELS[contest.assessmentType] || contest.assessmentType}
                      </span>
                      <span className={`vco-status vco-status--${contest.status}`}>
                        {STATUS_LABELS[contest.status] || contest.status}
                      </span>
                      {phase && (
                        <span className={`vco-phase vco-phase--${phase.key}`}>{phase.label}</span>
                      )}
                    </div>
                  </div>

                  <p className="vco-card-assessment">
                    Linked assessment: <strong>{contest.assessmentTitle || '—'}</strong>
                  </p>

                  <div className="vco-card-meta">
                    <span className="vco-meta-item">
                      <FiCalendar />
                      Starts {formatDate(contest.attemptWindowStart)}
                    </span>
                    <span className="vco-meta-item">
                      <FiClock />
                      Ends {formatDate(contest.attemptWindowEnd)}
                    </span>
                    <span className="vco-meta-item vco-meta-item--accent">
                      <FiUsers />
                      <strong>{contest.participantCount ?? 0}</strong> registered
                    </span>
                  </div>

                  {contest.status === 'published' && contest.slug && (
                    <span className="vco-card-slug">
                      <FiLink /> /contest/{contest.slug}
                    </span>
                  )}
                </div>

                <div className="vco-card-actions">
                  {contest.status === 'published' && (
                    <button
                      type="button"
                      className="vh-btn vh-btn--ghost vh-btn--sm"
                      onClick={() => copyLink(contest.slug)}
                    >
                      <FiLink /> Copy link
                    </button>
                  )}
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    onClick={() => navigate(`/vendor-admin/contests/${contest._id}/results`)}
                  >
                    <FiBarChart2 /> Results
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    onClick={() => navigate(`/vendor-admin/contests/${contest._id}/participants`)}
                  >
                    <FiUsers /> Participants
                  </button>
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    onClick={() => navigate(`/vendor-admin/contests/${contest._id}/edit`)}
                  >
                    <FiEdit2 /> Edit
                  </button>
                  {contest.status === 'draft' && (
                    <button
                      type="button"
                      className="vh-btn vh-btn--ghost vh-btn--sm vco-act-publish"
                      onClick={() => handlePublish(contest._id)}
                    >
                      <FiSend /> Publish
                    </button>
                  )}
                  {contest.status === 'published' && (
                    <button
                      type="button"
                      className="vh-btn vh-btn--danger vh-btn--sm"
                      onClick={() => handleEnd(contest._id)}
                    >
                      <FiStopCircle /> End
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </VendorHubPage>
  );
};

export default ContestList;
