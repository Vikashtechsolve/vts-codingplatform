import React from 'react';

const ACTIVE_STATUSES = new Set([
  'completed',
  'evaluated',
  'active',
  'submitted',
]);

const PENDING_STATUSES = new Set([
  'in_progress',
  'evaluating',
  'follow_up',
  'pending',
  'assigned',
]);

const VendorStatusBadge = ({ status }) => {
  if (!status) return <span className="va-status va-status--inactive">—</span>;
  const norm = String(status).toLowerCase().replace(/\s+/g, '_');
  let tone = 'inactive';
  if (ACTIVE_STATUSES.has(norm)) tone = 'active';
  else if (PENDING_STATUSES.has(norm)) tone = 'pending';
  const label = String(status).replace(/_/g, ' ');
  return <span className={`va-status va-status--${tone}`}>{label}</span>;
};

export default VendorStatusBadge;
