import React, { useEffect, useState } from 'react';
import { isDocumentFullscreen, requestDocumentFullscreen } from '../utils/fullscreen';
import { MAX_EXAM_VIOLATIONS } from '../constants/examSecurity';
import './ExamFullscreenPrompt.css';

/**
 * Blocks the exam UI until the student enters fullscreen (browser requires user gesture).
 */
const ExamFullscreenPrompt = ({ title, subtitle, onEntered }) => {
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    if (isDocumentFullscreen()) {
      onEntered?.();
    }
  }, [onEntered]);

  const handleEnter = async () => {
    setEntering(true);
    const ok = await requestDocumentFullscreen();
    setEntering(false);
    if (ok || isDocumentFullscreen()) {
      onEntered?.();
    }
  };

  if (isDocumentFullscreen()) {
    return null;
  }

  return (
    <div className="exam-fullscreen-prompt" role="dialog" aria-modal="true" aria-labelledby="exam-fs-title">
      <div className="exam-fullscreen-prompt-card">
        <div className="exam-fullscreen-prompt-icon" aria-hidden="true">
          ⛶
        </div>
        <h2 id="exam-fs-title">{title || 'Enter fullscreen to continue'}</h2>
        <p>{subtitle || 'For a secure exam experience, your screen must be maximized. Click the button below — this is the same step as starting from the portal.'}</p>
        <ul className="exam-fullscreen-rules">
          <li>Stay in fullscreen — do not switch tabs, apps, or desktops (macOS three-finger swipe counts)</li>
          <li>Do not use Cmd/Ctrl+Tab, Mission Control, or a second monitor for help</li>
          <li>Copy, cut, and paste work inside the code editor only — external paste is blocked</li>
          <li>Maximum {MAX_EXAM_VIOLATIONS} violations — your test auto-submits after that</li>
        </ul>
        <button
          type="button"
          className="btn btn-primary exam-fullscreen-prompt-btn"
          onClick={handleEnter}
          disabled={entering}
        >
          {entering ? 'Opening…' : 'Enter fullscreen & continue'}
        </button>
      </div>
    </div>
  );
};

export default ExamFullscreenPrompt;
