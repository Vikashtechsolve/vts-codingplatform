import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiAlertTriangle, FiClock, FiX } from 'react-icons/fi';
import './ExamNoticeModal.css';

const ICONS = {
  warning: FiAlertTriangle,
  error: FiAlertCircle,
  info: FiClock,
};

const KICKERS = {
  warning: 'Exam notice',
  error: 'Auto-submit',
  info: 'Time',
};

const ExamNoticeModal = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'warning',
  actionLabel,
  blocking = false,
  current,
  max,
}) => {
  const titleId = useId();
  const dialogRef = useRef(null);
  const Icon = ICONS[type] || FiAlertTriangle;
  const dismissible = !blocking;
  const buttonLabel = actionLabel || (blocking ? 'Please wait…' : 'I understand');
  const showStats = Number.isFinite(current) && Number.isFinite(max) && max > 0;
  const remaining = showStats ? Math.max(0, max - current) : 0;
  const fillPct = showStats ? Math.min(100, Math.round((current / max) * 100)) : 0;
  const lastChance = showStats && remaining === 1;

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && dismissible) {
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
  }, [isOpen, onClose, dismissible]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleOverlayClick = (event) => {
    if (!dismissible) return;
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className="enm-overlay" onMouseDown={handleOverlayClick}>
      <div
        ref={dialogRef}
        className={`enm-dialog enm-dialog--${type}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {dismissible && (
          <button type="button" className="enm-close" onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        )}

        <div className="enm-head">
          <div className={`enm-icon enm-icon--${type}`} aria-hidden>
            <Icon />
          </div>
          <div className="enm-head-copy">
            <p className={`enm-kicker enm-kicker--${type}`}>{KICKERS[type] || KICKERS.warning}</p>
            <h2 id={titleId} className="enm-title">{title}</h2>
          </div>
        </div>
        <p className="enm-message">{message}</p>

        {showStats && (
          <>
            <div
              className="enm-meter"
              role="meter"
              aria-label="Violation count"
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={current}
            >
              <span className="enm-meter-fill" style={{ width: `${fillPct}%` }} />
            </div>
            <div className="enm-stats">
              <div className="enm-stat enm-stat--warn">
                <span className="enm-stat-value">{current}</span>
                <span className="enm-stat-label">Now</span>
              </div>
              <div className="enm-stat">
                <span className="enm-stat-value">{max}</span>
                <span className="enm-stat-label">Limit</span>
              </div>
              <div className={`enm-stat${lastChance ? ' enm-stat--warn' : ''}`}>
                <span className="enm-stat-value">{remaining}</span>
                <span className="enm-stat-label">Left</span>
              </div>
            </div>
            {lastChance ? (
              <div className="enm-warning" role="status">
                <FiAlertTriangle />
                <span>Last chance — one more violation submits this test automatically.</span>
              </div>
            ) : null}
          </>
        )}

        <div className="enm-actions">
          <button
            type="button"
            className={`enm-btn ${type === 'error' ? 'enm-btn--danger' : 'enm-btn--primary'}`}
            onClick={onClose}
            disabled={blocking}
          >
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExamNoticeModal;
