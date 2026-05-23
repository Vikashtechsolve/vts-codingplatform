import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheck,
  FiCheckCircle,
  FiGlobe,
  FiUsers,
  FiAlertCircle,
  FiCalendar,
  FiUser,
  FiInbox,
  FiFilter,
  FiChevronRight,
  FiMail,
  FiMessageSquare,
  FiFileText,
  FiVolume2
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import RichTextDisplay, { truncateForPreview } from '../../components/RichTextDisplay';
import { useAnnouncements } from '../../context/AnnouncementContext';
import './StudentAnnouncements.css';

const formatDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

const formatShort = (d) => {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const AnnouncementHeroArt = () => (
  <div className="san-hero-art" aria-hidden>
    <svg className="san-hero-svg" viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect className="san-illus-panel" x="48" y="36" width="104" height="88" rx="16" strokeWidth="1.5" />
      <path
        className="san-illus-line"
        d="M68 56h64M68 72h48M68 88h56"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle className="san-illus-badge" cx="148" cy="52" r="22" strokeWidth="1.5" />
      <path
        className="san-illus-check"
        d="M140 52l6 6 12-12"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="san-illus-stand"
        d="M88 124c0 8-12 14-28 14s-28-6-28-14"
        strokeWidth="2"
      />
      <rect className="san-illus-bar" x="60" y="108" width="56" height="10" rx="5" />
      <ellipse className="san-illus-shadow" cx="100" cy="138" rx="40" ry="5" />
    </svg>
  </div>
);

const StudentAnnouncements = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refresh, markAllRead, refreshInbox } = useAnnouncements();
  const [list, setList] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get('/announcements/student/inbox');
      if (data.success) setList(data.announcements || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (announcementId) => {
    try {
      setLoading(true);
      const { data } = await axiosInstance.get(`/announcements/student/${announcementId}`);
      if (data.success) {
        setDetail(data.announcement);
        if (!data.announcement.isRead) {
          await axiosInstance.post(`/announcements/student/${announcementId}/read`);
          refresh();
        }
      }
    } catch {
      navigate('/student/announcements');
    } finally {
      setLoading(false);
    }
  }, [navigate, refresh]);

  useEffect(() => {
    if (id) {
      fetchDetail(id);
    } else {
      setDetail(null);
      fetchList();
      refreshInbox();
    }
  }, [id, fetchDetail, fetchList, refreshInbox]);

  const stats = useMemo(() => {
    const unread = list.filter((a) => !a.isRead).length;
    const important = list.filter((a) => a.priority === 'important').length;
    return { total: list.length, unread, important };
  }, [list]);

  const filteredList = useMemo(() => {
    if (filter === 'unread') return list.filter((a) => !a.isRead);
    if (filter === 'important') return list.filter((a) => a.priority === 'important');
    return list;
  }, [list, filter]);

  if (id && detail) {
    return (
      <div className="san-page san-page--detail">
        <button type="button" className="san-back-btn" onClick={() => navigate('/student/announcements')}>
          <FiArrowLeft /> Back to all announcements
        </button>

        <div className={`san-detail-hero ${detail.priority === 'important' ? 'san-detail-hero--important' : ''}`}>
          <div className="san-detail-hero-content">
            <div className="san-detail-badges">
              {detail.priority === 'important' && (
                <span className="san-pill san-pill--warn"><FiAlertCircle /> Important</span>
              )}
              {!detail.isRead && <span className="san-pill san-pill--new"><FiMail /> New</span>}
            </div>
            <h1>{detail.title}</h1>
            <div className="san-detail-meta-row">
              <span><FiUser /> {detail.createdBy?.name || 'Admin'}</span>
              <span><FiCalendar /> {formatDate(detail.publishedAt)}</span>
              {detail.targetType === 'all' ? (
                <span><FiGlobe /> All students</span>
              ) : (
                <span>
                  <FiUsers /> {(detail.targetClassroomIds || []).map((c) => c.name).join(', ')}
                </span>
              )}
            </div>
          </div>
          <AnnouncementHeroArt />
        </div>

        <article className="san-detail-card">
          <RichTextDisplay content={detail.body} className="san-detail-body" />
        </article>
      </div>
    );
  }

  return (
    <div className="san-page">
      <section className="san-hero">
        <div className="san-hero-content">
          <span className="san-hero-kicker"><FiInbox /> Announcements</span>
          <h1>Stay in the loop</h1>
          <p>Important updates, schedules, and news from your organization — all in one place.</p>
          <div className="san-hero-stats">
            <div className="san-stat-card">
              <span className="san-stat-icon-wrap"><FiInbox /></span>
              <div>
                <strong>{stats.total}</strong>
                <span>Total</span>
              </div>
            </div>
            <div className="san-stat-card">
              <span className="san-stat-icon-wrap san-stat-icon-wrap--highlight"><FiMail /></span>
              <div>
                <strong>{stats.unread}</strong>
                <span>Unread</span>
              </div>
            </div>
            <div className="san-stat-card">
              <span className="san-stat-icon-wrap san-stat-icon-wrap--warn"><FiAlertCircle /></span>
              <div>
                <strong>{stats.important}</strong>
                <span>Important</span>
              </div>
            </div>
          </div>
          {stats.unread > 0 && (
            <button
              type="button"
              className="san-mark-all-btn"
              onClick={async () => {
                await markAllRead();
                fetchList();
              }}
            >
              <FiCheckCircle /> Mark all as read
            </button>
          )}
        </div>
        <AnnouncementHeroArt />
      </section>

      <div className="san-toolbar">
        <div className="san-filters">
          <FiFilter className="san-filter-icon" />
          {[
            { key: 'all', label: 'All', count: stats.total },
            { key: 'unread', label: 'Unread', count: stats.unread },
            { key: 'important', label: 'Important', count: stats.important },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              className={`san-filter-chip ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
              <span className="san-filter-count">{count}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="san-skeleton-grid">
          {[1, 2, 3].map((n) => (
            <div key={n} className="san-skeleton-card" />
          ))}
        </div>
      ) : filteredList.length === 0 ? (
        <div className="san-empty-modern">
          <div className="san-empty-visual" aria-hidden>
            <FiMessageSquare />
          </div>
          <h2>{filter === 'all' ? 'No announcements yet' : `No ${filter} announcements`}</h2>
          <p>
            {filter === 'all'
              ? 'When your instructors publish updates, they will show up here and in your notification menu.'
              : 'Try another filter or check back later.'}
          </p>
          {filter !== 'all' && (
            <button type="button" className="san-empty-reset" onClick={() => setFilter('all')}>
              Show all
            </button>
          )}
          <Link to="/student/dashboard" className="san-dash-link">
            <FiChevronRight /> Go to dashboard
          </Link>
        </div>
      ) : (
        <div className="san-card-grid">
          {filteredList.map((item) => (
            <button
              key={item._id}
              type="button"
              className={`san-card ${item.isRead ? 'read' : 'unread'} ${item.priority === 'important' ? 'important' : ''}`}
              onClick={() => navigate(`/student/announcements/${item._id}`)}
            >
              <div className={`san-card-icon-wrap ${item.priority === 'important' ? 'warn' : 'default'}`}>
                {item.priority === 'important' ? <FiVolume2 /> : <FiFileText />}
              </div>
              <div className="san-card-body">
                <div className="san-card-top">
                  <h3>{item.title}</h3>
                  {!item.isRead && <span className="san-card-new">New</span>}
                </div>
                <p className="san-card-preview">{truncateForPreview(item.body, 120)}</p>
                <div className="san-card-footer">
                  <span className="san-card-meta">
                    {item.targetType === 'all' ? <><FiGlobe /> Everyone</> : <><FiUsers /> Class</>}
                  </span>
                  <span className="san-card-time">{formatShort(item.publishedAt)}</span>
                  <FiChevronRight className="san-card-arrow" />
                </div>
              </div>
              {item.isRead && (
                <span className="san-card-read" title="Read">
                  <FiCheck />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentAnnouncements;
