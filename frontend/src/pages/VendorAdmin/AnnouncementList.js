import React, { useState, useEffect, useCallback } from 'react';
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
  FiAlertCircle
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { truncateForPreview } from '../../components/RichTextDisplay';
import { useToast } from '../../context/ToastContext';
import './AnnouncementList.css';

const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived'
};

const AnnouncementList = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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

  const formatDate = (d) =>
    d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <div className="van-container">
      <header className="van-header">
        <div className="van-header-text">
          <h1>
            <FiBell className="van-header-icon" />
            Announcements
          </h1>
          <p>Broadcast updates to all students or specific classrooms.</p>
        </div>
        <button
          type="button"
          className="van-create-btn"
          onClick={() => navigate('/vendor-admin/announcements/create')}
        >
          <FiPlus /> New announcement
        </button>
      </header>

      <div className="van-filters">
        {['all', 'published', 'draft', 'archived'].map((s) => (
          <button
            key={s}
            type="button"
            className={`van-filter-tab ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="van-loading">Loading announcements…</div>
      ) : announcements.length === 0 ? (
        <div className="van-empty">
          <FiBell />
          <h2>No announcements yet</h2>
          <p>Create your first announcement to reach students instantly.</p>
          <button type="button" className="van-create-btn" onClick={() => navigate('/vendor-admin/announcements/create')}>
            <FiPlus /> Create announcement
          </button>
        </div>
      ) : (
        <div className="van-grid">
          {announcements.map((a) => (
            <article key={a._id} className={`van-card status-${a.status}`}>
              <div className="van-card-top">
                <span className={`van-status ${a.status}`}>{STATUS_LABELS[a.status]}</span>
                {a.priority === 'important' && (
                  <span className="van-priority">
                    <FiAlertCircle /> Important
                  </span>
                )}
              </div>
              <h3>{a.title}</h3>
              <p className="van-card-preview">{truncateForPreview(a.body, 140)}</p>
              <div className="van-card-audience">
                {a.targetType === 'all' ? (
                  <span><FiGlobe /> All students</span>
                ) : (
                  <span>
                    <FiUsers />{' '}
                    {(a.targetClassroomIds || []).map((c) => c.name).filter(Boolean).join(', ') ||
                      `${a.targetClassroomIds?.length || 0} classroom(s)`}
                  </span>
                )}
              </div>
              {a.status === 'published' && (
                <div className="van-card-stats">
                  <span>{a.readCount ?? 0} read</span>
                  <span>{a.audienceSize ?? '—'} reached</span>
                </div>
              )}
              <p className="van-card-date">
                {a.status === 'published' ? `Published ${formatDate(a.publishedAt)}` : `Updated ${formatDate(a.updatedAt)}`}
              </p>
              <div className="van-card-actions">
                {a.status === 'draft' && (
                  <button type="button" className="van-act publish" onClick={() => handlePublish(a._id)}>
                    <FiSend /> Publish
                  </button>
                )}
                <button type="button" className="van-act" onClick={() => navigate(`/vendor-admin/announcements/${a._id}/edit`)}>
                  <FiEdit2 /> Edit
                </button>
                {a.status === 'published' && (
                  <button type="button" className="van-act" onClick={() => handleArchive(a._id)}>
                    <FiArchive /> Archive
                  </button>
                )}
                <button type="button" className="van-act danger" onClick={() => handleDelete(a._id)}>
                  <FiTrash2 />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnouncementList;
