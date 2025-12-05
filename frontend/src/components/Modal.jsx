import React from 'react';

const Modal = ({ open, onClose, title, children }) => {
  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()} className="card">
        {title && <div style={{ marginBottom: '12px', fontWeight: 600 }}>{title}</div>}
        <div>{children}</div>
        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

const overlayStyle = {
  position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(15,23,42,0.45)', zIndex: 60, padding: '1rem'
};

const dialogStyle = {
  width: '100%', maxWidth: 720, background: 'var(--surface)', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow-md)'
};

export default Modal;
