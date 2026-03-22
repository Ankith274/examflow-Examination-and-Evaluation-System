import React from 'react';

export default function Timer({ timeLeft }) {
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const isWarning = timeLeft < 300; // last 5 min
  const isDanger = timeLeft < 60;   // last 1 min

  const fmt = (n) => String(n).padStart(2, '0');

  return (
    <div className={`timer ${isWarning ? 'warning' : ''} ${isDanger ? 'danger' : ''}`}>
      <span className="timer-icon">⏱</span>
      {hours > 0 && <><span className="timer-unit">{fmt(hours)}</span><span className="timer-sep">:</span></>}
      <span className="timer-unit">{fmt(minutes)}</span>
      <span className="timer-sep">:</span>
      <span className="timer-unit">{fmt(seconds)}</span>
    </div>
  );
}
