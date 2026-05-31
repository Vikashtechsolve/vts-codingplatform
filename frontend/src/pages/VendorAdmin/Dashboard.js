import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useVendorBranding } from '../../context/VendorBrandingContext';
import { useVendorPanel } from '../../context/VendorPanelContext';
import { VENDOR_TEST_SECTIONS } from '../../constants/vendorSections';
import {
  FiArrowRight,
  FiUsers,
  FiFileText,
  FiCheckCircle,
  FiGrid,
  FiPlus,
  FiBarChart2,
  FiSettings,
} from 'react-icons/fi';
import './Dashboard.css';

const VendorAdminDashboard = () => {
  const { user } = useAuth();
  const { branding } = useVendorBranding();
  const { stats, loading, getSectionCount } = useVendorPanel();

  const firstName = user?.name?.split(' ')[0] || 'Admin';
  const company = branding?.companyName || 'your organization';

  const statCards = [
    {
      key: 'tests',
      label: 'Total tests',
      value: stats.totalTests,
      icon: FiFileText,
      accent: '#2563eb',
      to: '/vendor-admin/tests',
    },
    {
      key: 'students',
      label: 'Students',
      value: stats.totalStudents,
      icon: FiUsers,
      accent: '#059669',
      to: '/vendor-admin/students',
    },
    {
      key: 'classrooms',
      label: 'Classrooms',
      value: stats.totalClassrooms,
      icon: FiGrid,
      accent: '#0891b2',
      to: '/vendor-admin/classrooms',
    },
    {
      key: 'results',
      label: 'Submissions',
      value: stats.totalResults,
      icon: FiBarChart2,
      accent: '#6366f1',
      to: '/vendor-admin/analytics',
    },
    {
      key: 'completed',
      label: 'Completed',
      value: stats.completedResults,
      icon: FiCheckCircle,
      accent: '#7c3aed',
      to: '/vendor-admin/analytics',
    },
  ];

  const quickLinks = [
    { label: 'Create test', to: '/vendor-admin/tests/create', icon: FiPlus, primary: true },
    { label: 'New classroom', to: '/vendor-admin/classrooms/create', icon: FiGrid },
    { label: 'Question bank', to: '/vendor-admin/questions', icon: FiFileText },
    { label: 'Announcements', to: '/vendor-admin/announcements', icon: FiUsers },
  ];

  if (loading) {
    return (
      <div className="vendor-dashboard-page">
        <div className="vendor-dashboard-loading">
          <div className="vendor-loading-spinner" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-dashboard-page">
      <section className="vendor-hero">
        <div className="vendor-hero-content">
          <p className="vendor-hero-eyebrow">Vendor admin · {stats.totalAssessments ?? 0} assessments</p>
          <h1>Hello, {firstName}</h1>
          <p className="vendor-hero-sub">
            Manage assessments, students, and classrooms for <strong>{company}</strong>. Use the
            left panel to jump to any test type or open a section below.
          </p>
          <div className="vendor-hero-actions">
            <Link to="/vendor-admin/tests/create" className="vendor-hero-cta">
              Create test <FiArrowRight />
            </Link>
            <Link to="/vendor-admin/analytics" className="vendor-hero-cta-secondary">
              View analytics
            </Link>
          </div>
        </div>
        <div className="vendor-hero-visual" aria-hidden>
          <div className="vendor-hero-card-stack">
            <div className="vendor-hero-mini-card" style={{ '--c': '#2563eb' }}>
              <span>Coding</span>
              <strong>{getSectionCount('coding')}</strong>
            </div>
            <div className="vendor-hero-mini-card" style={{ '--c': '#6366f1' }}>
              <span>Projects</span>
              <strong>{stats.totalAssignments}</strong>
            </div>
            <div className="vendor-hero-mini-card" style={{ '--c': '#c026d3' }}>
              <span>Interviews</span>
              <strong>{stats.totalInterviews}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="vendor-stats-row" aria-label="Overview statistics">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.key} to={card.to} className="vendor-stat-card">
              <span className="vendor-stat-icon" style={{ '--stat-accent': card.accent }}>
                <Icon />
              </span>
              <div className="vendor-stat-body">
                <span className="vendor-stat-label">{card.label}</span>
                <span className="vendor-stat-value">{card.value ?? 0}</span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="vendor-quick-section">
        <h2 className="vendor-section-title">Quick actions</h2>
        <div className="vendor-quick-grid">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`vendor-quick-card ${item.primary ? 'vendor-quick-card--primary' : ''}`}
              >
                <Icon className="vendor-quick-icon" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="vendor-sections-overview">
        <div className="vendor-sections-header">
          <h2 className="vendor-section-title">Assessment types</h2>
          <p className="vendor-section-sub">
            Every test category from the sidebar — counts, description, and shortcuts.
          </p>
        </div>
        <div className="vendor-section-cards">
          {VENDOR_TEST_SECTIONS.map((section) => {
            const Icon = section.icon;
            const count = section.comingSoon ? null : getSectionCount(section.id);
            const questionCount =
              section.id === 'coding'
                ? stats.questions?.coding
                : section.id === 'mcq'
                  ? stats.questions?.mcq
                  : section.id === 'aptitude'
                    ? stats.questions?.aptitude
                    : section.id === 'theory'
                      ? stats.questions?.theory
                      : null;

            const hubLink = section.comingSoon
              ? null
              : section.testType
                ? `/vendor-admin/tests?type=${section.testType}`
                : section.path;

            return (
              <article
                key={section.id}
                className={`vendor-type-card ${section.comingSoon ? 'vendor-type-card--soon' : ''}`}
                style={{ '--type-accent': section.accent }}
              >
                <div className="vendor-type-card-top">
                  <span className="vendor-type-icon">
                    <Icon />
                  </span>
                  <div>
                    <h3>{section.label}</h3>
                    {section.comingSoon ? (
                      <span className="vendor-soon-badge">Coming soon</span>
                    ) : (
                      <span className="vendor-type-count">
                        <strong>{count ?? 0}</strong>
                        {section.hub === 'assignments'
                          ? ' assignments'
                          : section.hub === 'interviews'
                            ? ' interviews'
                            : section.hub === 'system_design'
                              ? ' problems'
                              : section.hub === 'sql'
                                ? ' SQL tests'
                                : ' tests'}
                        {questionCount != null && questionCount > 0 && (
                          <> · {questionCount} in question bank</>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <p className="vendor-type-desc">{section.description}</p>
                {!section.comingSoon && section.actions?.length > 0 && (
                  <div className="vendor-type-actions">
                    {section.actions.map((action) => (
                      <Link
                        key={action.label}
                        to={action.to}
                        className={action.primary ? 'vendor-btn vendor-btn--primary' : 'vendor-btn'}
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
                {hubLink && !section.comingSoon && (
                  <Link to={hubLink} className="vendor-type-open">
                    Open section <FiArrowRight />
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="vendor-manage-panel">
        <h2 className="vendor-section-title">Platform management</h2>
        <div className="vendor-manage-grid">
          <Link to="/vendor-admin/students" className="vendor-manage-card">
            <FiUsers />
            <div>
              <strong>Students</strong>
              <span>{stats.totalStudents} enrolled</span>
            </div>
          </Link>
          <Link to="/vendor-admin/classrooms" className="vendor-manage-card">
            <FiGrid />
            <div>
              <strong>Classrooms</strong>
              <span>{stats.totalClassrooms} active</span>
            </div>
          </Link>
          <Link to="/vendor-admin/questions" className="vendor-manage-card">
            <FiFileText />
            <div>
              <strong>Question bank</strong>
              <span>MCQ, coding, aptitude, theory</span>
            </div>
          </Link>
          <Link to="/vendor-admin/settings" className="vendor-manage-card">
            <FiSettings />
            <div>
              <strong>Settings & branding</strong>
              <span>Logo, colors, profile</span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default VendorAdminDashboard;
