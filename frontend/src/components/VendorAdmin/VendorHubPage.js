import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

/**
 * Shell for vendor hub pages: questions, students, classrooms
 */
const VendorHubPage = ({
  loading = false,
  backTo,
  backLabel = 'Back',
  eyebrow,
  title,
  subtitle,
  accent = '#475569',
  actions,
  children,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`vh-page ${className}`} style={{ '--vh-accent': accent }}>
        <div className="vh-loading">
          <div className="vh-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`vh-page ${className}`} style={{ '--vh-accent': accent }}>
      <header className="vh-header">
        <div className="vh-header-main">
          {backTo && (
            <Link to={backTo} className="vh-back">
              <FiArrowLeft /> {backLabel}
            </Link>
          )}
          {eyebrow && <p className="vh-eyebrow">{eyebrow}</p>}
          {title && <h1 className="vh-title">{title}</h1>}
          {subtitle && <p className="vh-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="vh-header-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
};

export default VendorHubPage;
