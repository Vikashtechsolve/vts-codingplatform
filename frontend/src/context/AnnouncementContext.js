import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import axiosInstance from '../utils/axios';

const AnnouncementContext = createContext(null);

const POLL_MS = 60000;

export function useAnnouncements() {
  const ctx = useContext(AnnouncementContext);
  if (!ctx) {
    return {
      unreadCount: 0,
      announcements: [],
      loading: false,
      refresh: async () => {},
      markRead: async () => {},
      markAllRead: async () => {}
    };
  }
  return ctx;
}

export function AnnouncementProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef(null);

  const refreshUnread = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'student') return;
    try {
      const { data } = await axiosInstance.get('/announcements/student/unread-count');
      if (data.success) setUnreadCount(data.count || 0);
    } catch {
      /* ignore */
    }
  }, [isAuthenticated, user?.role]);

  const refreshInbox = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'student') return;
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/announcements/student/inbox');
      if (data.success) {
        setAnnouncements(data.announcements || []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshUnread(), refreshInbox()]);
  }, [refreshUnread, refreshInbox]);

  const markRead = useCallback(async (announcementId) => {
    try {
      await axiosInstance.post(`/announcements/student/${announcementId}/read`);
      setAnnouncements((prev) =>
        prev.map((a) =>
          a._id === announcementId ? { ...a, isRead: true, readAt: new Date().toISOString() } : a
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await axiosInstance.post('/announcements/student/read-all');
      setAnnouncements((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'student') {
      setUnreadCount(0);
      setAnnouncements([]);
      return undefined;
    }

    refreshUnread();
    pollRef.current = setInterval(refreshUnread, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isAuthenticated, user?.role, refreshUnread]);

  const value = {
    unreadCount,
    announcements,
    loading,
    refresh,
    refreshInbox,
    refreshUnread,
    markRead,
    markAllRead
  };

  return (
    <AnnouncementContext.Provider value={value}>
      {children}
    </AnnouncementContext.Provider>
  );
}
