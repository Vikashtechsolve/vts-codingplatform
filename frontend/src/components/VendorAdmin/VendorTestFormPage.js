import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

/**
 * Shell for vendor test create/edit (coding, MCQ, SQL, English, interview, etc.)
 */
const VendorTestFormPage = ({
  loading = false,
  backTo = '/vendor-admin/tests',
  backLabel = 'All assessments',
  eyebrow,
  title,
  subtitle,
  accent = '#2563eb',
  error,
  notice,
  stats,
  footer,
  children,
  className = '',
  wide = true,
}) => {
  if (loading) {
    return (
      <div
        className={`vtf-page ${wide ? 'vtf-page--wide' : ''} ${className}`}
        style={{ '--vtf-accent': accent }}
      >
        <div className="vtf-loading">
          <div className="vtf-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`vtf-page ${wide ? 'vtf-page--wide' : ''} ${className}`}
      style={{ '--vtf-accent': accent }}
    >
      <header className="vtf-header">
        <div className="vtf-header-main">
          {backTo && (
            <Link to={backTo} className="vtf-back">
              <FiArrowLeft /> {backLabel}
            </Link>
          )}
          {eyebrow && <p className="vtf-eyebrow">{eyebrow}</p>}
          {title && <h1 className="vtf-title">{title}</h1>}
          {subtitle && <p className="vtf-subtitle">{subtitle}</p>}
        </div>
      </header>

      {stats?.length > 0 && (
        <div className="vtf-stats" role="status">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`vtf-stat ${s.highlight ? 'vtf-stat--accent' : ''}`}
            >
              <span className="vtf-stat-label">{s.label}</span>
              <span className="vtf-stat-value">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {notice && <div className="vtf-notice">{notice}</div>}

      {error && (
        <div className="vtf-error" role="alert">
          {error}
        </div>
      )}

      <div className="vtf-body">{children}</div>

      {footer && <div className="vtf-footer-sticky">{footer}</div>}
    </div>
  );
};

export default VendorTestFormPage;
