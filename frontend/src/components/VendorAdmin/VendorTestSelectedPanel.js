import React from 'react';
import { FiChevronUp, FiChevronDown, FiTrash2, FiList } from 'react-icons/fi';

const TYPE_LABELS = {
  coding: 'Coding',
  mcq: 'MCQ',
  aptitude: 'Aptitude',
  theory: 'Theory',
};

/**
 * Selected-questions sidebar for test builders
 */
const VendorTestSelectedPanel = ({
  items = [],
  emptyTitle = 'No questions yet',
  emptyHint = 'Add questions from the bank on the left.',
  getTitle,
  getType,
  showPoints = true,
  onPointsChange,
  onMove,
  onRemove,
  totalPoints,
}) => {
  return (
    <div className="vtf-selected-panel">
      <header className="vtf-selected-panel-header">
        <div className="vtf-selected-panel-title-row">
          <FiList className="vtf-selected-panel-icon" aria-hidden />
          <h3>Test lineup</h3>
        </div>
        <div className="vtf-selected-panel-badges">
          <span className="vtf-selected-count-pill">{items.length} questions</span>
          {showPoints && items.length > 0 && (
            <span className="vtf-selected-points-pill">{totalPoints} pts</span>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <div className="vtf-selected-empty">
          <p className="vtf-selected-empty-title">{emptyTitle}</p>
          <p className="vtf-selected-empty-hint">{emptyHint}</p>
        </div>
      ) : (
        <ol className="vtf-selected-stack">
          {items.map((item, index) => {
            const type = getType ? getType(item, index) : null;
            return (
              <li key={item.key || `${item.id}-${index}`} className="vtf-selected-card">
                <div className="vtf-selected-card-order" aria-hidden>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="vtf-selected-card-body">
                  <p className="vtf-selected-card-title" title={getTitle(item, index)}>
                    {getTitle(item, index)}
                  </p>
                  <div className="vtf-selected-card-meta">
                    {type && (
                      <span className={`vtf-type-pill vtf-type-pill--${type}`}>
                        {TYPE_LABELS[type] || type}
                      </span>
                    )}
                    {showPoints && (
                      <label className="vtf-points-wrap">
                        <span className="vtf-points-label">Points</span>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={item.points ?? 10}
                          onChange={(e) => onPointsChange(index, e.target.value)}
                          aria-label={`Points for question ${index + 1}`}
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="vtf-selected-card-tools">
                  {onMove && (
                    <>
                      <button
                        type="button"
                        className="vtf-tool-btn"
                        disabled={index === 0}
                        onClick={() => onMove(index, 'up')}
                        aria-label="Move up"
                      >
                        <FiChevronUp />
                      </button>
                      <button
                        type="button"
                        className="vtf-tool-btn"
                        disabled={index === items.length - 1}
                        onClick={() => onMove(index, 'down')}
                        aria-label="Move down"
                      >
                        <FiChevronDown />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="vtf-tool-btn vtf-tool-btn--danger"
                    onClick={() => onRemove(index)}
                    aria-label="Remove question"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};

export default VendorTestSelectedPanel;
