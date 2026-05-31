import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

/**
 * Shell for vendor question create/edit forms (coding, MCQ, aptitude, theory, English)
 */
const VendorQuestionFormPage = ({
  loading = false,
  backTo,
  backLabel = 'Back',
  eyebrow,
  title,
  subtitle,
  accent = '#475569',
  isGlobal = false,
  error,
  modal,
  children,
  footer,
  className = '',
}) => {
  if (loading) {
    return (
      <div className={`vqf-page ${className}`} style={{ '--vqf-accent': accent }}>
        <div className="vqf-loading">
          <div className="vqf-spinner" />
          <p>Loading question…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`vqf-page ${className}`} style={{ '--vqf-accent': accent }}>
      {modal}
      <header className="vqf-header">
        <div className="vqf-header-main">
          {backTo && (
            <Link to={backTo} className="vqf-back">
              <FiArrowLeft /> {backLabel}
            </Link>
          )}
          {eyebrow && (
            <p className="vqf-eyebrow">
              {eyebrow}
              {isGlobal && <span className="vqf-global-badge">Global</span>}
            </p>
          )}
          {title && <h1 className="vqf-title">{title}</h1>}
          {subtitle && <p className="vqf-subtitle">{subtitle}</p>}
        </div>
      </header>

      {error && (
        <div className="vqf-error" role="alert">
          {error}
        </div>
      )}

      <div className="vqf-body">{children}</div>
      {footer && <div className="vqf-footer-sticky">{footer}</div>}
    </div>
  );
};

export default VendorQuestionFormPage;
