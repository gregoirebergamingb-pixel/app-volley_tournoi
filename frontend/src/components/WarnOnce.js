import React, { useState } from 'react';

function WarnOnce({ storageKey, message }) {
  const [show, setShow] = useState(() => !localStorage.getItem(storageKey));
  const [doNotShow, setDoNotShow] = useState(false);

  if (!show) return null;

  const dismiss = () => {
    if (doNotShow) localStorage.setItem(storageKey, '1');
    setShow(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 800,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={dismiss}>
      <div style={{
        background: 'white', borderRadius: 20, padding: '22px 20px 18px',
        maxWidth: 400, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>ℹ️</div>
          <p style={{ fontSize: 13, color: '#334455', lineHeight: 1.65, margin: 0 }}>{message}</p>
        </div>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: '#90A0B0',
          marginBottom: 16, cursor: 'pointer',
          padding: '10px 0', borderTop: '1px solid #F0F4FF',
        }}>
          <input type="checkbox" checked={doNotShow} onChange={e => setDoNotShow(e.target.checked)}
            style={{ accentColor: 'var(--primary)', width: 15, height: 15, flexShrink: 0 }} />
          Ne plus afficher ce message
        </label>
        <button onClick={dismiss} style={{ width: '100%', padding: '11px', borderRadius: 12 }}>
          Compris
        </button>
      </div>
    </div>
  );
}

export default WarnOnce;
