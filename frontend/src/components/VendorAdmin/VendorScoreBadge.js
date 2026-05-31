import React from 'react';
import { scoreTone } from '../../utils/vendorAssessmentUi';

const VendorScoreBadge = ({ value, suffix = '%' }) => {
  if (value == null || value === '' || value === '—') {
    return <span className="va-score va-score--neutral">—</span>;
  }
  const tone = scoreTone(Number(value));
  return (
    <span className={`va-score va-score--${tone}`}>
      {value}
      {suffix && suffix !== '' ? suffix : ''}
    </span>
  );
};

export default VendorScoreBadge;
