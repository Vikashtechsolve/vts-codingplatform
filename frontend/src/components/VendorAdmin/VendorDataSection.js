import React from 'react';
import './VendorDataSection.css';

/** Inline loading overlay for list/table areas — keeps headers and search visible. */
const VendorDataSection = ({ refreshing = false, children, className = '' }) => (
  <div className={`vendor-data-section ${refreshing ? 'is-refreshing' : ''} ${className}`.trim()}>
    {refreshing && (
      <div className="vendor-data-section-overlay" aria-live="polite" aria-busy="true">
        <div className="vendor-data-section-spinner" />
        <span className="vendor-data-section-label">Updating…</span>
      </div>
    )}
    <div className="vendor-data-section-content">{children}</div>
  </div>
);

export default VendorDataSection;
