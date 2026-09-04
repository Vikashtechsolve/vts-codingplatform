import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiBriefcase,
  FiDatabase,
  FiMic,
  FiCreditCard,
  FiCpu,
  FiUsers,
  FiFileText,
  FiBarChart2,
  FiShield,
  FiClipboard,
  FiBookOpen,
  FiLayers,
} from 'react-icons/fi';
import axiosInstance from '../../utils/axios';
import { useAuth } from '../../context/AuthContext';
import { SUPER_ADMIN_ACCENT } from '../../constants/superAdminSections';
import '../../styles/super-admin-pages.css';

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get('/super-admin/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Admin';

  const statCards = [
    { label: 'Total vendors', value: stats?.totalVendors ?? 0, accent: '#2563eb' },
    { label: 'Active vendors', value: stats?.activeVendors ?? 0, accent: '#059669' },
    { label: 'Total users', value: stats?.totalUsers ?? 0, accent: '#6366f1' },
    { label: 'Total tests', value: stats?.totalTests ?? 0, accent: '#0891b2' },
    { label: 'Submissions', value: stats?.totalResults ?? 0, accent: '#7c3aed' },
    { label: 'Interview sessions', value: stats?.totalInterviewSessions ?? 0, accent: '#c026d3' },
    { label: 'Completed interviews', value: stats?.completedInterviewSessions ?? 0, accent: '#db2777' },
  ];

  const quickLinks = [
    { label: 'Manage vendors', to: '/super-admin/vendors', icon: FiBriefcase, accent: '#2563eb' },
    { label: 'Platform tests', to: '/super-admin/tests', icon: FiClipboard, accent: '#ea580c' },
    { label: 'Interviews & projects', to: '/super-admin/assessments', icon: FiLayers, accent: '#c026d3' },
    { label: 'Question bank', to: '/super-admin/global-questions', icon: FiDatabase, accent: '#0891b2' },
    { label: 'Courses', to: '/super-admin/courses', icon: FiBookOpen, accent: '#0f766e' },
    { label: 'Interview Qs', to: '/super-admin/interview-questions', icon: FiMic, accent: '#c026d3' },
    { label: 'Assign credits', to: '/super-admin/interview-credits', icon: FiCreditCard, accent: '#059669' },
    { label: 'AI settings', to: '/super-admin/interview-ai-settings', icon: FiCpu, accent: '#7c3aed' },
  ];

  if (loading) {
    return (
      <div className="vh-page sa-dashboard-page" style={{ '--vh-accent': SUPER_ADMIN_ACCENT }}>
        <div className="vh-loading">
          <div className="vh-spinner" />
          <p>Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-dashboard-page">
      <section className="sa-hero">
        <div>
          <p className="sa-hero-eyebrow">Platform overview</p>
          <h1>Hello, {firstName}</h1>
          <p className="sa-hero-sub">
            Manage vendors, global question banks, interview credits, and platform-wide settings
            from one place.
          </p>
        </div>
        <div className="sa-hero-visual" aria-hidden>
          <div className="sa-hero-badge">
            <FiShield />
          </div>
        </div>
      </section>

      <div className="vh-stats">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="vh-stat"
            style={{ '--vh-accent': card.accent, borderColor: `color-mix(in srgb, ${card.accent} 25%, var(--vh-border))` }}
          >
            <span className="vh-stat-label">{card.label}</span>
            <span className="vh-stat-value" style={{ color: card.accent }}>
              {card.value}
            </span>
          </div>
        ))}
      </div>

      <h2 className="sa-section-title">Quick actions</h2>
      <div className="vh-action-grid">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className="vh-action-card"
              style={{ '--action-accent': link.accent }}
            >
              <span className="vh-action-icon">
                <Icon />
              </span>
              <span className="vh-action-label">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="vh-panel" style={{ marginTop: '20px' }}>
        <div className="vh-panel-head">
          <div>
            <h2 className="vh-panel-title">Platform snapshot</h2>
            <p className="vh-panel-desc">Key metrics across all vendors and assessments.</p>
          </div>
        </div>
        <div className="vh-panel-body">
          <div className="vh-stats">
            <div className="vh-stat vh-stat--accent">
              <span className="vh-stat-label">
                <FiUsers style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Users
              </span>
              <span className="vh-stat-value">{stats?.totalUsers ?? 0}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">
                <FiFileText style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Tests
              </span>
              <span className="vh-stat-value">{stats?.totalTests ?? 0}</span>
            </div>
            <div className="vh-stat">
              <span className="vh-stat-label">
                <FiBarChart2 style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Results
              </span>
              <span className="vh-stat-value">{stats?.totalResults ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
