import React from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import './Toast.css';

const ICONS = {
  success: FiCheckCircle,
  error: FiAlertCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type] || FiInfo;
        return (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role="status"
          >
            <span className="toast-icon" aria-hidden>
              <Icon />
            </span>
            <div className="toast-body">
              {toast.title && <p className="toast-title">{toast.title}</p>}
              <p className="toast-message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="toast-dismiss"
              onClick={() => onDismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <FiX />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
