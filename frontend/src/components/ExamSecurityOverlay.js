import React from 'react';
import { isDocumentFullscreen } from '../utils/fullscreen';
import './ExamSecurityOverlay.css';

/**
 * Blocks interaction when the student leaves the exam surface (tab/app switch or fullscreen exit).
 */
const ExamSecurityOverlay = ({ mode, onReenterFullscreen }) => {
  if (!mode) return null;

  if (mode === 'fullscreen') {
    return (
      <div className="exam-security-overlay" role="alertdialog" aria-modal="true">
        <div className="exam-security-overlay-card">
          <h2>Fullscreen required</h2>
          <p>
            You left fullscreen mode. Return to fullscreen to continue your test. Minimizing or
            resizing the exam window is not allowed.
          </p>
          <button
            type="button"
            className="btn btn-primary exam-security-overlay-btn"
            onClick={onReenterFullscreen}
          >
            Return to fullscreen
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'focus') {
    return (
      <div className="exam-security-overlay exam-security-overlay--focus" role="alertdialog" aria-modal="true">
        <div className="exam-security-overlay-card">
          <h2>Return to your test tab</h2>
          <p>
            This tab is in the background. Switch back here to continue. A violation was recorded
            for leaving the exam.
          </p>
          {!isDocumentFullscreen() && onReenterFullscreen && (
            <button
              type="button"
              className="btn btn-primary exam-security-overlay-btn"
              onClick={onReenterFullscreen}
            >
              Return to fullscreen
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default ExamSecurityOverlay;
