import React, { useEffect } from 'react';
import { FiCheck, FiX } from 'react-icons/fi';

const CourseEditorToast = ({ message, error, onDismiss }) => {
  useEffect(() => {
    if (!message && !error) return undefined;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, error, onDismiss]);

  if (!message && !error) return null;

  return (
    <div className="sa-editor-toast-stack" role="status" aria-live="polite">
      <div className={`sa-editor-toast ${error ? 'sa-editor-toast--error' : 'sa-editor-toast--success'}`}>
        <span className="sa-editor-toast-icon">{error ? <FiX /> : <FiCheck />}</span>
        <span className="sa-editor-toast-text">{error || message}</span>
        <button type="button" className="sa-editor-toast-close" onClick={onDismiss} aria-label="Dismiss">
          <FiX size={16} />
        </button>
      </div>
    </div>
  );
};

export default CourseEditorToast;
