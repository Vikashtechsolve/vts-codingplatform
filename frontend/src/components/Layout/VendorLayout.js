import React, { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVendorBranding } from '../../context/VendorBrandingContext';
import { useVendorPanel } from '../../context/VendorPanelContext';
import {
  VENDOR_MENU_SECTIONS,
  VENDOR_TEST_SECTIONS,
  isVendorTestSectionActive,
} from '../../constants/vendorSections';
import { FiMenu, FiX } from 'react-icons/fi';
import './VendorLayout.css';

const VendorLayout = () => {
  const { user } = useAuth();
  const { branding } = useVendorBranding();
  const { stats, loading, getSectionCount } = useVendorPanel();
  const assessmentTotal = stats.totalAssessments ?? 0;
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const search = new URLSearchParams(location.search);

  const menuSections = VENDOR_MENU_SECTIONS;

  const isMenuActive = (section) => {
    if (section.id === 'dashboard') {
      return location.pathname === '/vendor-admin/dashboard';
    }
    if (section.id === 'tests') {
      return location.pathname === '/vendor-admin/tests' && !search.get('type');
    }
    return location.pathname.startsWith(section.path);
  };

  const closeSidebar = () => setSidebarOpen(false);
  const firstName = user?.name?.split(' ')[0] || 'Admin';
  const company = branding?.companyName || 'Vendor';

  return (
    <div className="vendor-panel">
      <button
        type="button"
        className="vendor-sidebar-toggle"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? <FiX /> : <FiMenu />}
      </button>

      {sidebarOpen && (
        <button
          type="button"
          className="vendor-sidebar-backdrop"
          onClick={closeSidebar}
          aria-label="Close menu"
        />
      )}

      <aside className={`vendor-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="vendor-sidebar-inner">
          <div className="vendor-sidebar-profile">
            <div className="vendor-avatar" aria-hidden>
              {(user?.name || 'V').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="vendor-sidebar-greeting">{company}</p>
              <p className="vendor-sidebar-name">{firstName}</p>
            </div>
          </div>

          <div className="vendor-sidebar-nav-scroll">
            <nav className="vendor-sidebar-nav" aria-label="Vendor admin">
              <p className="vendor-nav-label">Menu</p>
              {menuSections.map((section) => {
                const Icon = section.icon;
                const active = isMenuActive(section);
                let menuBadge = null;
                if (section.id === 'tests' && !loading) {
                  menuBadge = assessmentTotal;
                } else if (section.id === 'students' && !loading) {
                  menuBadge = stats.totalStudents;
                } else if (section.id === 'classrooms' && !loading) {
                  menuBadge = stats.totalClassrooms;
                }
                return (
                  <Link
                    key={section.id}
                    to={section.path}
                    className={`vendor-nav-item ${active ? 'active' : ''}`}
                    onClick={closeSidebar}
                  >
                    <span className="vendor-nav-icon" style={{ '--section-accent': section.accent }}>
                      <Icon />
                    </span>
                    <span className="vendor-nav-text">{section.shortLabel}</span>
                    {menuBadge != null && (
                      <span className={`vendor-nav-badge ${menuBadge === 0 ? 'empty' : ''}`}>
                        {menuBadge > 99 ? '99+' : menuBadge}
                      </span>
                    )}
                  </Link>
                );
              })}

              <div className="vendor-nav-label-row">
                <p className="vendor-nav-label">Assessments</p>
                {!loading && (
                  <span className="vendor-nav-label-meta">{assessmentTotal} total</span>
                )}
              </div>
              {VENDOR_TEST_SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = isVendorTestSectionActive(section, location.pathname, search);
                const count = section.comingSoon ? null : getSectionCount(section.id);
                return (
                  <Link
                    key={section.id}
                    to={
                      section.comingSoon
                        ? '/vendor-admin/dashboard'
                        : section.testType
                          ? `/vendor-admin/tests?type=${section.testType}`
                          : section.path
                    }
                    className={`vendor-nav-item ${active ? 'active' : ''} ${section.comingSoon ? 'vendor-nav-item--disabled' : ''}`}
                    onClick={closeSidebar}
                    aria-disabled={section.comingSoon || undefined}
                  >
                    <span className="vendor-nav-icon" style={{ '--section-accent': section.accent }}>
                      <Icon />
                    </span>
                    <span className="vendor-nav-text">{section.shortLabel}</span>
                    {section.comingSoon ? (
                      <span className="vendor-nav-badge vendor-nav-badge--soon">Soon</span>
                    ) : (
                      <span
                        className={`vendor-nav-badge ${count === 0 ? 'empty' : ''}${
                          loading ? ' vendor-nav-badge--loading' : ''
                        }`}
                      >
                        {loading ? '—' : count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <main className="vendor-main">
        <Outlet />
      </main>
    </div>
  );
};

export default VendorLayout;
