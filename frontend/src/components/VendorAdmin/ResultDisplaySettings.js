import React from 'react';

const OPTIONS = [
  {
    value: 'detailed',
    title: 'Detailed breakdown',
    description: 'Students see score, section stats, and per-question review with answers and feedback.',
    icon: '📊',
  },
  {
    value: 'score_only',
    title: 'Score summary only',
    description: 'Students see their overall score and percentage — no question-level analysis or solutions.',
    icon: '🎯',
  },
];

const ResultDisplaySettings = ({ value = 'detailed', onChange, testType }) => {
  if (!['coding', 'mixed'].includes(testType)) {
    return null;
  }

  return (
    <section className="vtf-section vtf-section--compact">
      <h2 className="vtf-section-title">Student result visibility</h2>
      <p className="vtf-section-hint">
        Choose what students see after submitting this {testType === 'mixed' ? 'mixed' : 'coding'} test.
      </p>
      <div className="vtf-result-display-grid" role="radiogroup" aria-label="Student result visibility">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`vtf-result-display-card ${selected ? 'selected' : ''}`}
              onClick={() => onChange(option.value)}
            >
              <span className="vtf-result-display-icon" aria-hidden="true">
                {option.icon}
              </span>
              <span className="vtf-result-display-body">
                <span className="vtf-result-display-title">{option.title}</span>
                <span className="vtf-result-display-desc">{option.description}</span>
              </span>
              <span className="vtf-result-display-check" aria-hidden="true">
                {selected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ResultDisplaySettings;
