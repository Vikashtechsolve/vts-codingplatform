import React from 'react';
import { Link } from 'react-router-dom';
import { FiBarChart2, FiAward, FiTarget } from 'react-icons/fi';
import VendorHubPage from '../VendorHubPage';
import '../../../styles/vendor-practice-pages.css';

const TABS = [
  { id: 'analytics', label: 'Overview', path: '/vendor-admin/practice', icon: FiBarChart2 },
  { id: 'leaderboard', label: 'Leaderboard', path: '/vendor-admin/practice/leaderboard', icon: FiAward },
];

const VendorPracticeLayout = ({
  active,
  title,
  subtitle,
  backTo = '/vendor-admin/dashboard',
  actions,
  loading = false,
  children,
}) => (
  <VendorHubPage
    loading={loading}
    backTo={backTo}
    backLabel="Dashboard"
    eyebrow="Coding practice"
    title={title}
    subtitle={subtitle}
    accent="#6366f1"
    className="vp-page"
    actions={actions}
  >
    <nav className="vp-nav" aria-label="Practice sections">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            to={tab.path}
            className={`vp-nav-tab ${active === tab.id ? 'is-active' : ''}`}
          >
            <Icon aria-hidden />
            {tab.label}
          </Link>
        );
      })}
    </nav>
    {children}
  </VendorHubPage>
);

export const VendorPracticeInsight = ({ icon: Icon, value, label, hint, accent }) => (
  <article className={`vp-insight-card ${accent ? 'vp-insight-card--accent' : ''}`}>
    {Icon && (
      <span className="vp-insight-icon" aria-hidden>
        <Icon />
      </span>
    )}
    <div className="vp-insight-body">
      <span className="vp-insight-value">{value}</span>
      <span className="vp-insight-label">{label}</span>
      {hint && <span className="vp-insight-hint">{hint}</span>}
    </div>
  </article>
);

export const VendorPracticeEmpty = ({ icon: Icon = FiTarget, title, description }) => (
  <div className="vp-empty">
    <div className="vp-empty-icon" aria-hidden>
      <Icon />
    </div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
  </div>
);

export const getInitials = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

export const scoreTone = (score) => {
  if (score >= 500) return 'high';
  if (score >= 200) return 'mid';
  return 'low';
};

export default VendorPracticeLayout;
