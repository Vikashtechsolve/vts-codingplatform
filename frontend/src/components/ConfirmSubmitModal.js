import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertTriangle, FiSend, FiX } from 'react-icons/fi';
import './ConfirmSubmitModal.css';

const ConfirmSubmitModal = ({
  isOpen,
  onClose,
  onConfirm,
  submitting = false,
  title = 'Submit this test?',
  message = 'Once submitted, you cannot change your answers.',
  confirmLabel = 'Submit test',
  cancelLabel = 'Stay in test',
  stats = [],
  warning,
  notes = [],
}) => {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [isOpen, onClose, submitting]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleOverlayClick = (event) => {
    if (submitting) return;
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className="csm-overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className="csm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <button
          type="button"
          className="csm-close"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
        >
          <FiX />
        </button>

        <div className="csm-icon" aria-hidden>
          <FiSend />
        </div>

        <h2 id={titleId} className="csm-title">{title}</h2>
        <p className="csm-message">{message}</p>

        {stats.length > 0 && (
          <div className="csm-stats">
            {stats.map((stat) => (
              <div key={stat.label} className={`csm-stat${stat.tone ? ` csm-stat--${stat.tone}` : ''}`}>
                <span className="csm-stat-value">{stat.value}</span>
                <span className="csm-stat-label">{stat.label}</span>
              </div>
            ))}
          </div>
        )}

        {warning ? (
          <div className="csm-warning" role="status">
            <FiAlertTriangle />
            <span>{warning}</span>
          </div>
        ) : null}

        {notes.length > 0 && (
          <ul className="csm-notes">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        <div className="csm-actions">
          <button
            type="button"
            className="csm-btn csm-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="csm-btn csm-btn--danger"
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmSubmitModal;
