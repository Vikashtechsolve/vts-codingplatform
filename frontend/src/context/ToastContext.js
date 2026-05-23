import React, { createContext, useCallback, useContext, useState } from 'react';
import ToastContainer from '../components/Toast/ToastContainer';

const ToastContext = createContext(null);

const DEFAULT_DURATION = {
  success: 2800,
  info: 3200,
  warning: 4000,
  error: 5000,
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'success', options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const duration = options.duration ?? DEFAULT_DURATION[type] ?? DEFAULT_DURATION.info;

    setToasts((prev) => [...prev.slice(-4), { id, message, type, title: options.title }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};

export default ToastContext;
