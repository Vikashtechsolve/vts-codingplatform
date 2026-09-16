import React from 'react';
import { Link } from 'react-router-dom';
import { FiInbox } from 'react-icons/fi';

const PracticeEmptyState = ({
  title = 'Nothing here yet',
  description,
  actionLabel,
  actionTo,
  onAction,
}) => (
  <div className="practice-empty">
    <div className="practice-empty-icon-wrap" aria-hidden>
      <FiInbox />
    </div>
    <h3>{title}</h3>
    {description && <p>{description}</p>}
    {actionLabel && actionTo && (
      <Link to={actionTo} className="practice-btn practice-btn-primary">
        {actionLabel}
      </Link>
    )}
    {actionLabel && onAction && !actionTo && (
      <button type="button" className="practice-btn practice-btn-primary" onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default PracticeEmptyState;
