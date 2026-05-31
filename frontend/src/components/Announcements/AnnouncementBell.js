import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckCircle,
  FiUsers,
  FiGlobe,
  FiX,
  FiExternalLink,
  FiInbox,
  FiFileText,
  FiVolume2
} from 'react-icons/fi';
import { useAnnouncements } from '../../context/AnnouncementContext';
import { useExamLock } from '../../context/ExamLockContext';
import { truncateForPreview } from '../RichTextDisplay';
import './AnnouncementBell.css';

const formatWhen = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const AnnouncementBell = () => {
  const navigate = useNavigate();
  const { isExamLocked, reportNavigationAttempt } = useExamLock();
  const { unreadCount, announcements, loading, refreshInbox, markRead, markAllRead } = useAnnouncements();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (open) refreshInbox();
  }, [open, refreshInbox]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleOpenItem = async (item) => {
    if (isExamLocked) {
      reportNavigationAttempt();
      return;
    }
    if (!item.isRead) await markRead(item._id);
    setOpen(false);
    navigate(`/student/announcements/${item._id}`);
  };

  const goToAllAnnouncements = () => {
    if (isExamLocked) {
      reportNavigationAttempt();
      return;
    }
    setOpen(false);
    navigate('/student/announcements');
  };

  return (
    <div className="ann-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`ann-bell-trigger ${open ? 'open' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Announcements${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        title="Announcements"
      >
        <FiInbox className="ann-bell-icon" aria-hidden />
        {unreadCount > 0 && (
          <span className="ann-bell-count" aria-hidden>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="ann-bell-dropdown" role="dialog" aria-label="Recent announcements">
          <div className="ann-bell-dropdown-head">
            <div className="ann-bell-dropdown-title">
              <span className="ann-bell-dropdown-icon-wrap">
                <FiInbox />
              </span>
              <div>
                <h3>Notifications</h3>
                {unreadCount > 0 ? (
                  <span className="ann-bell-dropdown-sub">{unreadCount} unread</span>
                ) : (
                  <span className="ann-bell-dropdown-sub">You&apos;re all caught up</span>
                )}
              </div>
            </div>
            <button type="button" className="ann-bell-dropdown-close" onClick={() => setOpen(false)} aria-label="Close">
              <FiX />
            </button>
          </div>

          {unreadCount > 0 && (
            <div className="ann-bell-dropdown-toolbar">
              <button type="button" className="ann-bell-mark-all" onClick={markAllRead}>
                <FiCheckCircle /> Mark all read
              </button>
            </div>
          )}

          <div className="ann-bell-dropdown-list">
            {loading && announcements.length === 0 ? (
              <div className="ann-bell-dropdown-empty">
                <div className="ann-bell-spinner" />
                <p>Loading…</p>
              </div>
            ) : announcements.length === 0 ? (
              <div className="ann-bell-dropdown-empty">
                <FiInbox />
                <p>No announcements yet</p>
              </div>
            ) : (
              announcements.slice(0, 6).map((item) => (
                <button
                  key={item._id}
                  type="button"
                  className={`ann-bell-row ${item.isRead ? 'read' : 'unread'} ${item.priority === 'important' ? 'important' : ''}`}
                  onClick={() => handleOpenItem(item)}
                >
                  <span className={`ann-bell-row-icon ${item.priority === 'important' ? 'warn' : ''}`}>
                    {item.priority === 'important' ? <FiVolume2 /> : <FiFileText />}
                  </span>
                  <span className="ann-bell-row-body">
                    <span className="ann-bell-row-title">{item.title}</span>
                    <span className="ann-bell-row-preview">{truncateForPreview(item.body, 72)}</span>
                    <span className="ann-bell-row-meta">
                      {item.targetType === 'all' ? <><FiGlobe /> All</> : <><FiUsers /> Class</>}
                      <span>·</span>
                      {formatWhen(item.publishedAt || item.createdAt)}
                    </span>
                  </span>
                  {!item.isRead && <span className="ann-bell-row-dot" />}
                </button>
              ))
            )}
          </div>

          <div className="ann-bell-dropdown-foot">
            <button type="button" className="ann-bell-view-all-btn" onClick={goToAllAnnouncements}>
              <FiExternalLink />
              View all announcements
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementBell;
