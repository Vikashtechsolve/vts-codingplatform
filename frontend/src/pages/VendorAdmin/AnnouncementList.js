import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiBell,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSend,
  FiArchive,
  FiUsers,
  FiGlobe,
  FiAlertCircle,
  FiSearch,
  FiRefreshCw,
  FiFileText,
  FiVolume2,
  FiEye,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { truncateForPreview } from '../../components/RichTextDisplay';
import { useToast } from '../../context/ToastContext';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';
import './AnnouncementList.css';

const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

const AnnouncementList = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const { data } = await axiosInstance.get(`/announcements${params}`);
      if (data.success) setAnnouncements(data.announcements || []);
    } catch {
      showToast('Failed to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, showToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const stats = useMemo(() => {
    const published = announcements.filter((a) => a.status === 'published').length;
    const draft = announcements.filter((a) => a.status === 'draft').length;
    const important = announcements.filter((a) => a.priority === 'important').length;
    return {
      total: announcements.length,
      published,
      draft,
      important,
    };
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return announcements;
    return announcements.filter(
      (a) =>
        a.title?.toLowerCase().includes(q) ||
        truncateForPreview(a.body, 500).toLowerCase().includes(q)
    );
  }, [announcements, search]);

  const handlePublish = async (id) => {
    try {
      const { data } = await axiosInstance.post(`/announcements/${id}/publish`);
      if (data.success) {
        showToast(data.message || 'Published', 'success');
        fetchList();
      } else showToast(data.message || 'Failed', 'error');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to publish', 'error');
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this announcement? Students will no longer see it.')) return;
    try {
      const { data } = await axiosInstance.post(`/announcements/${id}/archive`);
      if (data.success) {
        showToast('Archived', 'success');
        fetchList();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement permanently?')) return;
    try {
      const { data } = await axiosInstance.delete(`/announcements/${id}`);
      if (data.success) {
        showToast('Deleted', 'success');
        fetchList();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const filterTabs = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'published', label: 'Published', count: stats.published },
    { key: 'draft', label: 'Drafts', count: stats.draft },
    { key: 'archived', label: 'Archived', count: announcements.filter((a) => a.status === 'archived').length },
  ];

  return (
    <VendorHubPage
      className="van-page"
      loading={loading && announcements.length === 0}
      eyebrow="Broadcast"
      title="Announcements"
      subtitle="Publish updates to all students or target specific classrooms. Students see these in their inbox and notification bell."
      accent="#e7210b"
      actions={
        <>
          <button type="button" className="vh-btn vh-btn--ghost" onClick={fetchList}>
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            className="vh-btn vh-btn--primary"
            onClick={() => navigate('/vendor-admin/announcements/create')}
          >
            <FiPlus /> New announcement
          </button>
        </>
      }
    >
      <div className="vh-stats van-stats">
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
          <span className="vh-stat-label">Important</span>
          <span className="vh-stat-value">{stats.important}</span>
        </div>
      </div>

      <div className="van-toolbar">
        <div className="van-filters">
          {filterTabs.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              className={`van-filter ${filter === key ? 'is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="van-filter-count">{count}</span>
            </button>
          ))}
        </div>
        <div className="vh-search van-search">
          <FiSearch />
          <input
            type="search"
            placeholder="Search by title or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading && announcements.length > 0 ? (
        <div className="van-loading-inline">Refreshing…</div>
      ) : null}

      {!loading && filteredAnnouncements.length === 0 ? (
        <div className="van-empty">
          <div className="vh-empty-icon">
            <FiBell />
          </div>
          <h2>{search ? 'No matches' : filter === 'all' ? 'No announcements yet' : `No ${STATUS_LABELS[filter]?.toLowerCase() || filter} announcements`}</h2>
          <p>
            {search
              ? 'Try a different search term or clear the filter.'
              : 'Create your first announcement to reach students instantly in their inbox.'}
          </p>
          {!search && (
            <button
              type="button"
              className="vh-btn vh-btn--primary"
              onClick={() => navigate('/vendor-admin/announcements/create')}
            >
              <FiPlus /> Create announcement
            </button>
          )}
        </div>
      ) : (
        <div className="van-list">
          {filteredAnnouncements.map((a) => (
            <article
              key={a._id}
              className={`van-card van-card--${a.status} ${a.priority === 'important' ? 'van-card--important' : ''}`}
            >
              <div className={`van-card-icon ${a.priority === 'important' ? 'van-card-icon--warn' : ''}`}>
                {a.priority === 'important' ? <FiVolume2 /> : <FiFileText />}
              </div>

              <div className="van-card-main">
                <div className="van-card-head">
                  <h3>{a.title}</h3>
                  <div className="van-card-badges">
                    <span className={`van-status van-status--${a.status}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                    {a.priority === 'important' && (
                      <span className="van-priority">
                        <FiAlertCircle /> Important
                      </span>
                    )}
                  </div>
                </div>

                <p className="van-card-preview">{truncateForPreview(a.body, 160)}</p>

                <div className="van-card-meta">
                  <span className="van-meta-item">
                    {a.targetType === 'all' ? (
                      <>
                        <FiGlobe /> All students
                      </>
                    ) : (
                      <>
                        <FiUsers />{' '}
                        {(a.targetClassroomIds || []).map((c) => c.name).filter(Boolean).join(', ') ||
                          `${a.targetClassroomIds?.length || 0} classroom(s)`}
                      </>
                    )}
                  </span>
                  <span className="van-meta-item">
                    {a.status === 'published'
                      ? `Published ${formatDate(a.publishedAt)}`
                      : `Updated ${formatDate(a.updatedAt)}`}
                  </span>
                  {a.status === 'published' && (
                    <span className="van-meta-item van-meta-item--accent">
                      <FiEye /> {a.readCount ?? 0} read · {a.audienceSize ?? '—'} reached
                    </span>
                  )}
                </div>
              </div>

              <div className="van-card-actions">
                {a.status === 'draft' && (
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm van-act-publish"
                    onClick={() => handlePublish(a._id)}
                  >
                    <FiSend /> Publish
                  </button>
                )}
                <button
                  type="button"
                  className="vh-btn vh-btn--ghost vh-btn--sm"
                  onClick={() => navigate(`/vendor-admin/announcements/${a._id}/edit`)}
                >
                  <FiEdit2 /> Edit
                </button>
                {a.status === 'published' && (
                  <button
                    type="button"
                    className="vh-btn vh-btn--ghost vh-btn--sm"
                    onClick={() => handleArchive(a._id)}
                  >
                    <FiArchive /> Archive
                  </button>
                )}
                <button
                  type="button"
                  className="vh-btn vh-btn--icon vh-btn--danger"
                  title="Delete"
                  onClick={() => handleDelete(a._id)}
                >
                  <FiTrash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </VendorHubPage>
  );
};

export default AnnouncementList;
