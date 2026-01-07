import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, type = 'info', showFooter = true }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-content modal-${type}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {typeof children === 'string' ? <p>{children}</p> : children}
        </div>
        {showFooter && (
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>OK</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;

