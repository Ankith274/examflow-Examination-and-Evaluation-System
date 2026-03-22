import React, { useEffect } from 'react';

export default function WarningPopup({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div className="warning-popup">
      <div className="warning-popup-inner">
        <div className="warning-icon">⚠</div>
        <div className="warning-popup-body">
          <div className="warning-popup-title">Proctoring Alert</div>
          <div className="warning-popup-msg">{message}</div>
          <div className="warning-popup-note">
            This violation has been recorded and reported to your supervisor.
          </div>
        </div>
        <button className="warning-close" onClick={onDismiss}>✕</button>
      </div>
    </div>
  );
}
