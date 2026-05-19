import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStudentPanel } from '../../context/StudentPanelContext';
import { STUDENT_SECTIONS, TEST_SECTIONS } from '../../constants/studentSections';
import { FiMenu, FiX } from 'react-icons/fi';
import './StudentLayout.css';

const StudentLayout = () => {
  const { user } = useAuth();
  const { counts, loading } = useStudentPanel();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path) => {
    if (path === '/student/dashboard') {
      return location.pathname === '/student/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const closeSidebar = () => setSidebarOpen(false);
  const firstName = user?.name?.split(' ')[0] || 'Student';

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
          type="button"
          className="student-sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Close menu"
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
            <nav className="student-sidebar-nav" aria-label="Assessment sections">
              <p className="student-nav-label">Menu</p>
              {STUDENT_SECTIONS.filter((s) => s.isOverview).map((section) => {
                const Icon = section.icon;
                const active = isActive(section.path);
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
                    <span className="student-nav-text">{section.label}</span>
                  </Link>
                );
              })}

              <p className="student-nav-label">Assessments</p>
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
                    {!loading && (
                      <span className={`student-nav-badge ${count === 0 ? 'empty' : ''}`}>{count}</span>
                    )}
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
