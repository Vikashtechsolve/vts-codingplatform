import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SUPER_ADMIN_ACCENT, SUPER_ADMIN_SECTIONS } from '../../constants/superAdminSections';
import { FiMenu, FiX } from 'react-icons/fi';
import './SuperAdminLayout.css';

const SuperAdminLayout = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (section) => {
    if (section.id === 'dashboard') {
      return location.pathname === '/super-admin/dashboard';
    }
    return location.pathname.startsWith(section.path);
  };

  const closeSidebar = () => setSidebarOpen(false);
  const firstName = user?.name?.split(' ')[0] || 'Admin';

  return (
    <div className="sa-panel">
      <button
        type="button"
        className="sa-sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <FiX /> : <FiMenu />}
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="sa-sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Close menu"
        />
      )}

      <aside className={`sa-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sa-sidebar-inner">
          <div className="sa-sidebar-profile">
            <div className="sa-avatar" aria-hidden>
              {(user?.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="sa-sidebar-greeting">Platform admin</p>
              <p className="sa-sidebar-name">{firstName}</p>
            </div>
          </div>

          <div className="sa-sidebar-nav-scroll">
            <nav className="sa-sidebar-nav" aria-label="Super admin">
              <p className="sa-nav-label">Menu</p>
              {SUPER_ADMIN_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = isActive(section);
                return (
                  <Link
                    key={section.id}
                    to={section.path}
                    className={`sa-nav-item ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                  >
                    <span className="sa-nav-icon" style={{ '--section-accent': section.accent }}>
                      <Icon />
                    </span>
                    <span className="sa-nav-text">{section.shortLabel}</span>
                    {section.comingSoon && (
                      <span className="sa-nav-badge sa-nav-badge--soon">Soon</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <main className="sa-main" style={{ '--sa-accent': SUPER_ADMIN_ACCENT }}>
        <Outlet />
      </main>
    </div>
  );
};

export default SuperAdminLayout;
