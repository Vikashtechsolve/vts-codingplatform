import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

/**
 * Shell for vendor assign / submissions / results pages
 */
const VendorAssessPage = ({
  loading = false,
  backTo,
  backLabel = 'Back',
  eyebrow,
  title,
  subtitle,
  accent = '#2563eb',
  actions,
  children,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`va-page ${className}`} style={{ '--card-accent': accent, '--va-accent': accent }}>
        <div className="va-loading">
          <div className="va-spinner" />
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`va-page ${className}`} style={{ '--card-accent': accent, '--va-accent': accent }}>
      <header className="va-header">
        <div>
          {backTo && (
            <Link to={backTo} className="va-back">
              <FiArrowLeft /> {backLabel}
            </Link>
          )}
          {eyebrow && <p className="va-eyebrow">{eyebrow}</p>}
          {title && <h1 className="va-title">{title}</h1>}
          {subtitle && <p className="va-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="va-header-actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
};

export default VendorAssessPage;
