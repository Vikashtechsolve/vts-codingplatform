import React from 'react';

const PracticeLoading = ({ message = 'Loading…' }) => (
  <div className="practice-loading" role="status" aria-live="polite">
    <div className="practice-loading-spinner" aria-hidden />
    <span>{message}</span>
  </div>
);

export default PracticeLoading;
