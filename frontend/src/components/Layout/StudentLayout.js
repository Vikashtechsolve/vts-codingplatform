import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentPanel } from '../../context/StudentPanelContext';
import { useAnnouncements } from '../../context/AnnouncementContext';
import { MENU_SECTIONS, COURSE_SECTIONS, TEST_SECTIONS } from '../../constants/studentSections';
import { FiBookOpen, FiMenu, FiX } from 'react-icons/fi';
import './StudentLayout.css';

const COURSES_ACCENT = COURSE_SECTIONS[0]?.accent || '#0f766e';

const StudentLayout = () => {
  const { user } = useAuth();
  const { counts, courses, initialLoading } = useStudentPanel();
  const { unreadCount: announcementUnread } = useAnnouncements();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path, { exact = false } = {}) => {
    if (exact) return location.pathname === path;
    if (path === '/student/dashboard') {
      return location.pathname === '/student/dashboard';
    }
    if (path === '/student/announcements') {
      return location.pathname.startsWith('/student/announcements');
    }
    return location.pathname.startsWith(path);
  };

  const closeSidebar = () => setSidebarOpen(false);
  const firstName = user?.name?.split(' ')[0] || 'Student';
  const courseCount = counts.courses ?? courses.length ?? 0;
  const assignedCourses = (courses || []).slice(0, 8);

  return (
    <div className="student-panel">
      <button
        type="button"
        className="student-sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <FiX /> : <FiMenu />}
      </button>

      {sidebarOpen && (
        <button
          className="student-sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Close menu"
          type="button"
        />
      )}

      <aside className={`student-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="student-sidebar-inner">
          <div className="student-sidebar-profile">
            <div className="student-avatar" aria-hidden>
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="student-sidebar-greeting">Welcome back</p>
              <p className="student-sidebar-name">{firstName}</p>
            </div>
          </div>

          <div className="student-sidebar-nav-scroll">
            <nav className="student-sidebar-nav" aria-label="Student navigation">
              <p className="student-nav-label">Menu</p>
              {MENU_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = isActive(section.path);
                const unread = section.isAnnouncement ? announcementUnread : 0;
                return (
                  <Link
                    key={section.id}
                    to={section.path}
                    className={`student-nav-item ${active ? 'active' : ''} ${section.isAnnouncement ? 'student-nav-item--announcement' : ''}`}
                    onClick={closeSidebar}
                  >
                    <span className="student-nav-icon" style={{ '--section-accent': section.accent }}>
                      <Icon />
                    </span>
                    <span className="student-nav-text">{section.label}</span>
                    {section.isAnnouncement && unread > 0 && (
                      <span className="student-nav-badge student-nav-badge--alert">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </Link>
                );
              })}

              <div className="student-nav-label-row">
                <p className="student-nav-label">Courses</p>
                {!initialLoading && (
                  <span className="student-nav-label-meta">
                    {courseCount} assigned
                  </span>
                )}
              </div>
              <Link
                to="/student/courses"
                className={`student-nav-item ${isActive('/student/courses', { exact: true }) ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <span className="student-nav-icon" style={{ '--section-accent': COURSES_ACCENT }}>
                  <FiBookOpen />
                </span>
                <span className="student-nav-text">All courses</span>
                <span
                  className={`student-nav-badge ${courseCount === 0 ? 'empty' : ''}${
                    initialLoading ? ' student-nav-badge--loading' : ''
                  }`}
                >
                  {initialLoading ? '—' : courseCount}
                </span>
              </Link>
              {assignedCourses.map((item) => {
                const id = item.course?._id;
                if (!id) return null;
                const href = `/student/courses/${id}`;
                const active = location.pathname === href || location.pathname.startsWith(`${href}/`);
                const pct = Math.round(item.progress?.percentComplete || 0);
                return (
                  <Link
                    key={item.enrollmentId || id}
                    to={href}
                    className={`student-nav-item student-nav-item--course ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                    title={item.course.title}
                  >
                    <span className="student-nav-icon" style={{ '--section-accent': COURSES_ACCENT }}>
                      <FiBookOpen />
                    </span>
                    <span className="student-nav-text">{item.course.title}</span>
                    <span className={`student-nav-badge ${pct === 0 ? 'empty' : ''}`}>
                      {pct > 0 ? `${pct}%` : 'New'}
                    </span>
                  </Link>
                );
              })}

              <div className="student-nav-label-row">
                <p className="student-nav-label">Assessments</p>
              </div>
              {TEST_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = isActive(section.path);
                const count = counts[section.id] ?? 0;
                return (
                  <Link
                    key={section.id}
                    to={section.path}
                    className={`student-nav-item ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                  >
                    <span className="student-nav-icon" style={{ '--section-accent': section.accent }}>
                      <Icon />
                    </span>
                    <span className="student-nav-text">{section.shortLabel}</span>
                    <span
                      className={`student-nav-badge ${count === 0 ? 'empty' : ''}${
                        initialLoading ? ' student-nav-badge--loading' : ''
                      }`}
                    >
                      {initialLoading ? '—' : count}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <main className="student-main">
        <Outlet />
      </main>
    </div>
  );
};

export default StudentLayout;
