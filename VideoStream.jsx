import { useState, useEffect, useRef, useCallback } from "react";

/**
 * VideoStream.jsx — Online Examination & Evaluation System
 * Proctoring / Live Video Monitor Component
 *
 * Props:
 *  - mode              {"student"|"proctor"}  View mode (default: "student")
 *  - studentName       {string}               Student display name
 *  - examTitle         {string}               Exam title shown in overlay
 *  - onViolation       {function}             Called when a violation is detected ({ type, message, timestamp })
 *  - onStreamStart     {function}             Called when camera stream starts successfully
 *  - onStreamStop      {function}             Called when stream stops
 *  - showControls      {boolean}              Show mute/camera toggle controls (default: true)
 *  - showStatus        {boolean}              Show live proctoring status badge (default: true)
 *  - recordingEnabled  {boolean}              Show recording indicator (default: true)
 *  - width             {number}               Video width in px (default: 640)
 *  - height            {number}               Video height in px (default: 360)
 *  - faceDetection     {boolean}              Enable simulated face-detection warnings (default: true)
 */

// ── Violation types ──────────────────────────────────────────────────────────
const VIOLATIONS = {
  FACE_NOT_VISIBLE:  { type: "FACE_NOT_VISIBLE",  label: "Face Not Visible",   severity: "high"   },
  MULTIPLE_FACES:    { type: "MULTIPLE_FACES",     label: "Multiple Faces",     severity: "high"   },
  LOOKING_AWAY:      { type: "LOOKING_AWAY",       label: "Looking Away",       severity: "medium" },
  TAB_SWITCH:        { type: "TAB_SWITCH",         label: "Tab Switch",         severity: "high"   },
  AUDIO_DETECTED:    { type: "AUDIO_DETECTED",     label: "Audio Detected",     severity: "low"    },
  CAMERA_BLOCKED:    { type: "CAMERA_BLOCKED",     label: "Camera Blocked",     severity: "high"   },
};

// ── Utility ──────────────────────────────────────────────────────────────────
function formatTimestamp(date) {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Sub-components ───────────────────────────────────────────────────────────

function RecordingDot() {
  return (
    <span className="rec-dot-wrap" aria-label="Recording">
      <span className="rec-dot" />
      <span className="rec-label">REC</span>
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    connecting:   { label: "Connecting…",   cls: "connecting" },
    live:         { label: "● LIVE",         cls: "live"        },
    paused:       { label: "⏸ Paused",       cls: "paused"      },
    error:        { label: "⚠ No Signal",    cls: "error"       },
    permission:   { label: "⛔ No Access",   cls: "error"       },
  };
  const s = map[status] || map.connecting;
  return <span className={`status-badge ${s.cls}`}>{s.label}</span>;
}

function ViolationToast({ violations }) {
  if (!violations.length) return null;
  const latest = violations[violations.length - 1];
  const sev = latest.severity;
  return (
    <div className={`violation-toast sev-${sev}`} key={latest.timestamp}>
      <span className="violation-icon">
        {sev === "high" ? "🚨" : sev === "medium" ? "⚠️" : "ℹ️"}
      </span>
      <span className="violation-body">
        <strong>{latest.label}</strong>
        <span className="violation-time">{formatTimestamp(new Date(latest.timestamp))}</span>
      </span>
    </div>
  );
}

function ViolationLog({ violations }) {
  if (!violations.length) return (
    <div className="vlog-empty">No violations detected</div>
  );
  return (
    <ul className="vlog-list">
      {[...violations].reverse().map((v, i) => (
        <li key={i} className={`vlog-item sev-${v.severity}`}>
          <span className="vlog-dot" />
          <span className="vlog-text">{v.label}</span>
          <span className="vlog-time">{formatTimestamp(new Date(v.timestamp))}</span>
        </li>
      ))}
    </ul>
  );
}

function PermissionScreen({ onRetry }) {
  return (
    <div className="perm-screen">
      <div className="perm-icon">📷</div>
      <div className="perm-title">Camera Access Required</div>
      <div className="perm-sub">This exam requires your camera for proctoring. Please allow access and try again.</div>
      <button className="perm-btn" onClick={onRetry}>Grant Access</button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VideoStream({
  mode             = "student",
  studentName      = "Student",
  examTitle        = "Online Examination",
  onViolation      = () => {},
  onStreamStart    = () => {},
  onStreamStop     = () => {},
  showControls     = true,
  showStatus       = true,
  recordingEnabled = true,
  width            = 640,
  height           = 360,
  faceDetection    = true,
}) {
  const videoRef        = useRef(null);
  const streamRef       = useRef(null);
  const violationTimer  = useRef(null);

  const [streamStatus,   setStreamStatus]   = useState("connecting");
  const [isMuted,        setIsMuted]        = useState(false);
  const [isCamOff,       setIsCamOff]       = useState(false);
  const [violations,     setViolations]     = useState([]);
  const [toastVisible,   setToastVisible]   = useState(false);
  const [showLog,        setShowLog]        = useState(false);
  const [permDenied,     setPermDenied]     = useState(false);
  const [elapsed,        setElapsed]        = useState(0);
  const [isFullscreen,   setIsFullscreen]   = useState(false);
  const wrapRef = useRef(null);

  // ── Start camera ──
  const startStream = useCallback(async () => {
    setStreamStatus("connecting");
    setPermDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamStatus("live");
      onStreamStart(stream);
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setPermDenied(true);
        setStreamStatus("permission");
      } else {
        setStreamStatus("error");
      }
    }
  }, [onStreamStart]);

  // ── Stop camera ──
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreamStatus("paused");
    onStreamStop();
  }, [onStreamStop]);

  // ── Toggle camera ──
  const toggleCamera = useCallback(() => {
    if (isCamOff) {
      startStream();
      setIsCamOff(false);
    } else {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
      }
      setIsCamOff(true);
      setStreamStatus("paused");
    }
  }, [isCamOff, startStream]);

  // ── Toggle mute ──
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => (t.enabled = isMuted));
    }
    setIsMuted((m) => !m);
  }, [isMuted]);

  // ── Add violation ──
  const addViolation = useCallback((violationKey) => {
    const v = VIOLATIONS[violationKey];
    if (!v) return;
    const entry = { ...v, timestamp: Date.now() };
    setViolations((prev) => [...prev, entry]);
    setToastVisible(true);
    onViolation(entry);
    clearTimeout(violationTimer.current);
    violationTimer.current = setTimeout(() => setToastVisible(false), 4000);
  }, [onViolation]);

  // ── Tab visibility detection ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && streamStatus === "live") {
        addViolation("TAB_SWITCH");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [streamStatus, addViolation]);

  // ── Elapsed timer ──
  useEffect(() => {
    if (streamStatus !== "live") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [streamStatus]);

  // ── Simulated face detection (demo only — replace with real ML in prod) ──
  useEffect(() => {
    if (!faceDetection || streamStatus !== "live") return;
    // In production, integrate TensorFlow.js face-api.js or a backend service here.
    // This is a demo simulation only.
    const demo = setInterval(() => {
      const roll = Math.random();
      if (roll < 0.03)       addViolation("FACE_NOT_VISIBLE");
      else if (roll < 0.045) addViolation("LOOKING_AWAY");
      else if (roll < 0.05)  addViolation("MULTIPLE_FACES");
    }, 8000);
    return () => clearInterval(demo);
  }, [faceDetection, streamStatus, addViolation]);

  // ── Start on mount ──
  useEffect(() => {
    startStream();
    return () => { stopStream(); clearTimeout(violationTimer.current); };
  }, []); // eslint-disable-line

  // ── Fullscreen ──
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ── Format elapsed ──
  const elapsedStr = (() => {
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const p = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  })();

  const highViolations = violations.filter((v) => v.severity === "high").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

        :root {
          --vs-bg:        #080c12;
          --vs-surface:   #0e1420;
          --vs-panel:     #121824;
          --vs-border:    rgba(255,255,255,0.06);
          --vs-text:      #dde3ee;
          --vs-muted:     #5a6478;
          --vs-accent:    #3b82f6;
          --vs-live:      #22c55e;
          --vs-warn:      #f59e0b;
          --vs-danger:    #ef4444;
          --vs-mono:      'DM Mono', monospace;
          --vs-font:      'Outfit', sans-serif;
        }

        .vs-wrapper * { box-sizing: border-box; margin: 0; padding: 0; }
        .vs-wrapper {
          font-family: var(--vs-font);
          background: var(--vs-bg);
          color: var(--vs-text);
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
          border: 1px solid var(--vs-border);
          box-shadow: 0 24px 80px rgba(0,0,0,0.6);
          width: 100%;
          max-width: 700px;
        }

        /* ── Top bar ── */
        .vs-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px;
          background: var(--vs-surface);
          border-bottom: 1px solid var(--vs-border);
          gap: 12px;
          flex-wrap: wrap;
        }
        .vs-topbar-left  { display: flex; align-items: center; gap: 10px; }
        .vs-topbar-right { display: flex; align-items: center; gap: 10px; }
        .vs-exam-title { font-size: 12px; font-weight: 600; color: var(--vs-text); letter-spacing: 0.02em; }
        .vs-student-name { font-family: var(--vs-mono); font-size: 11px; color: var(--vs-muted); }
        .vs-elapsed {
          font-family: var(--vs-mono); font-size: 11px; color: var(--vs-muted);
          background: rgba(255,255,255,0.04);
          padding: 3px 10px; border-radius: 6px;
          border: 1px solid var(--vs-border);
        }

        /* ── Status badge ── */
        .status-badge {
          font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; padding: 3px 10px;
          border-radius: 100px; border: 1px solid currentColor;
        }
        .status-badge.live        { color: var(--vs-live);   background: rgba(34,197,94,0.1);  animation: livePulse 2s ease-in-out infinite; }
        .status-badge.connecting  { color: var(--vs-accent); background: rgba(59,130,246,0.1);  }
        .status-badge.paused      { color: var(--vs-warn);   background: rgba(245,158,11,0.1);  }
        .status-badge.error       { color: var(--vs-danger); background: rgba(239,68,68,0.1);   }
        @keyframes livePulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.3); }
          50%      { box-shadow: 0 0 0 4px rgba(34,197,94,0); }
        }

        /* ── REC dot ── */
        .rec-dot-wrap { display: flex; align-items: center; gap: 5px; }
        .rec-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vs-danger); animation: recBlink 1s step-start infinite; }
        @keyframes recBlink { 50% { opacity: 0; } }
        .rec-label { font-family: var(--vs-mono); font-size: 10px; font-weight: 500; color: var(--vs-danger); letter-spacing: 0.12em; }

        /* ── Video area ── */
        .vs-video-area {
          position: relative;
          background: #000;
          width: 100%;
          aspect-ratio: 16/9;
          overflow: hidden;
        }

        .vs-video {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          transform: scaleX(-1); /* mirror for student */
        }

        /* Scan line overlay */
        .vs-scanlines {
          position: absolute; inset: 0; pointer-events: none; z-index: 2;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0px, transparent 3px,
            rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px
          );
        }

        /* Corner brackets */
        .vs-corners { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
        .corner {
          position: absolute; width: 18px; height: 18px;
          border-color: rgba(59,130,246,0.6); border-style: solid;
        }
        .corner.tl { top: 12px; left: 12px;  border-width: 2px 0 0 2px; }
        .corner.tr { top: 12px; right: 12px; border-width: 2px 2px 0 0; }
        .corner.bl { bottom: 12px; left: 12px;  border-width: 0 0 2px 2px; }
        .corner.br { bottom: 12px; right: 12px; border-width: 0 2px 2px 0; }

        /* Face detection box (simulated) */
        .face-box {
          position: absolute;
          top: 22%; left: 30%; width: 40%; height: 55%;
          border: 1.5px solid rgba(34,197,94,0.5);
          border-radius: 4px;
          z-index: 4;
          pointer-events: none;
          animation: faceBoxBreath 3s ease-in-out infinite;
        }
        .face-box.warning-face { border-color: rgba(239,68,68,0.7); animation: faceBoxWarn 0.5s ease-in-out infinite alternate; }
        @keyframes faceBoxBreath { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes faceBoxWarn   { from{opacity:0.5} to{opacity:1} }
        .face-label {
          position: absolute; top: -18px; left: 0;
          font-family: var(--vs-mono); font-size: 9px; letter-spacing: 0.08em;
          color: rgba(34,197,94,0.8); text-transform: uppercase;
        }
        .face-label.warning-face { color: rgba(239,68,68,0.8); }

        /* ── Overlays ── */
        .vs-overlay-center {
          position: absolute; inset: 0; z-index: 10;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: rgba(8,12,18,0.85); backdrop-filter: blur(8px);
          gap: 12px;
        }

        /* Camera off overlay */
        .cam-off-overlay { gap: 8px; }
        .cam-off-icon { font-size: 40px; opacity: 0.6; }
        .cam-off-text { font-size: 13px; color: var(--vs-muted); font-weight: 500; }

        /* Permission screen */
        .perm-screen {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
          padding: 32px; text-align: center;
        }
        .perm-icon  { font-size: 48px; }
        .perm-title { font-size: 16px; font-weight: 600; color: var(--vs-text); }
        .perm-sub   { font-size: 12px; color: var(--vs-muted); max-width: 280px; line-height: 1.6; }
        .perm-btn {
          background: var(--vs-accent); color: #fff;
          font-family: var(--vs-font); font-size: 12px; font-weight: 600;
          border: none; border-radius: 8px; padding: 9px 24px; cursor: pointer;
          transition: opacity 0.2s;
        }
        .perm-btn:hover { opacity: 0.85; }

        /* Violation toast */
        .violation-toast {
          position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
          z-index: 20; display: flex; align-items: center; gap: 10px;
          padding: 8px 16px; border-radius: 10px;
          font-size: 12px; font-weight: 500;
          border: 1px solid currentColor;
          backdrop-filter: blur(12px);
          animation: toastIn 0.35s ease;
          white-space: nowrap;
        }
        .violation-toast.sev-high   { color: var(--vs-danger); background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.35); }
        .violation-toast.sev-medium { color: var(--vs-warn);   background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.3); }
        .violation-toast.sev-low    { color: #60a5fa;          background: rgba(59,130,246,0.12); border-color: rgba(59,130,246,0.25); }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .violation-icon { font-size: 14px; }
        .violation-body { display: flex; flex-direction: column; gap: 1px; }
        .violation-time { font-family: var(--vs-mono); font-size: 10px; opacity: 0.7; }

        /* ── Bottom controls ── */
        .vs-controls {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px;
          background: var(--vs-surface);
          border-top: 1px solid var(--vs-border);
          gap: 10px;
        }
        .vs-controls-left, .vs-controls-right { display: flex; align-items: center; gap: 8px; }

        .ctrl-btn {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(255,255,255,0.05); border: 1px solid var(--vs-border);
          color: var(--vs-text); font-size: 15px; cursor: pointer;
          transition: all 0.18s;
        }
        .ctrl-btn:hover { background: rgba(255,255,255,0.1); }
        .ctrl-btn.off   { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); color: var(--vs-danger); }

        .viol-count-btn {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.04); border: 1px solid var(--vs-border);
          border-radius: 10px; padding: 6px 12px; cursor: pointer; transition: all 0.18s;
          font-family: var(--vs-font); font-size: 11px; font-weight: 600; color: var(--vs-muted);
        }
        .viol-count-btn:hover { background: rgba(255,255,255,0.08); }
        .viol-count-btn.has-high { color: var(--vs-danger); border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); }
        .viol-badge {
          background: var(--vs-danger); color: #fff;
          font-size: 9px; font-weight: 700;
          border-radius: 100px; padding: 1px 6px; min-width: 18px; text-align: center;
        }

        /* ── Violation log panel ── */
        .vs-log {
          background: var(--vs-panel);
          border-top: 1px solid var(--vs-border);
          padding: 14px 16px;
          max-height: 180px;
          overflow-y: auto;
        }
        .vs-log-title { font-size: 10px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--vs-muted); margin-bottom: 10px; }
        .vlog-empty   { font-size: 12px; color: var(--vs-muted); text-align: center; padding: 12px; }
        .vlog-list    { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .vlog-item    { display: flex; align-items: center; gap: 8px; font-size: 11px; }
        .vlog-dot     { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .vlog-item.sev-high   .vlog-dot { background: var(--vs-danger); }
        .vlog-item.sev-medium .vlog-dot { background: var(--vs-warn); }
        .vlog-item.sev-low    .vlog-dot { background: #60a5fa; }
        .vlog-text { flex: 1; color: var(--vs-text); }
        .vlog-time { font-family: var(--vs-mono); font-size: 10px; color: var(--vs-muted); }

        /* scrollbar */
        .vs-log::-webkit-scrollbar { width: 4px; }
        .vs-log::-webkit-scrollbar-track { background: transparent; }
        .vs-log::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      <div className="vs-wrapper" ref={wrapRef}>

        {/* ── Top Bar ── */}
        <div className="vs-topbar">
          <div className="vs-topbar-left">
            {showStatus && <StatusBadge status={streamStatus} />}
            {recordingEnabled && streamStatus === "live" && <RecordingDot />}
          </div>
          <div className="vs-exam-title">{examTitle}</div>
          <div className="vs-topbar-right">
            <span className="vs-student-name">{studentName}</span>
            {streamStatus === "live" && (
              <span className="vs-elapsed">{elapsedStr}</span>
            )}
          </div>
        </div>

        {/* ── Video Area ── */}
        <div className="vs-video-area">

          {/* Raw video */}
          <video
            ref={videoRef}
            className="vs-video"
            autoPlay
            playsInline
            muted={isMuted}
            style={{ display: streamStatus === "live" && !isCamOff ? "block" : "none" }}
          />

          {/* Scanlines */}
          <div className="vs-scanlines" />

          {/* Corner brackets */}
          <div className="vs-corners">
            <div className="corner tl" /><div className="corner tr" />
            <div className="corner bl" /><div className="corner br" />
          </div>

          {/* Face detection box — only when live */}
          {streamStatus === "live" && !isCamOff && (
            <div className={`face-box ${violations.length && violations[violations.length-1]?.severity === "high" ? "warning-face" : ""}`}>
              <span className={`face-label ${violations.length && violations[violations.length-1]?.severity === "high" ? "warning-face" : ""}`}>
                {violations.length && violations[violations.length-1]?.severity === "high"
                  ? "⚠ " + violations[violations.length-1]?.label
                  : "Face Detected"}
              </span>
            </div>
          )}

          {/* Violation toast */}
          {toastVisible && <ViolationToast violations={violations} />}

          {/* Camera off overlay */}
          {isCamOff && streamStatus !== "permission" && (
            <div className="vs-overlay-center cam-off-overlay">
              <div className="cam-off-icon">🚫</div>
              <div className="cam-off-text">Camera is off</div>
            </div>
          )}

          {/* Connecting overlay */}
          {streamStatus === "connecting" && (
            <div className="vs-overlay-center">
              <div style={{ color: "#3b82f6", fontSize: 13, fontWeight: 500 }}>Initializing camera…</div>
            </div>
          )}

          {/* Error overlay */}
          {streamStatus === "error" && (
            <div className="vs-overlay-center">
              <div style={{ fontSize: 36 }}>📵</div>
              <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>Camera unavailable</div>
              <button className="perm-btn" onClick={startStream} style={{ marginTop: 4 }}>Retry</button>
            </div>
          )}

          {/* Permission denied */}
          {permDenied && (
            <div className="vs-overlay-center">
              <PermissionScreen onRetry={startStream} />
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        {showControls && (
          <div className="vs-controls">
            <div className="vs-controls-left">
              <button
                className={`ctrl-btn ${isMuted ? "off" : ""}`}
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              >
                {isMuted ? "🔇" : "🎙️"}
              </button>
              <button
                className={`ctrl-btn ${isCamOff ? "off" : ""}`}
                onClick={toggleCamera}
                title={isCamOff ? "Turn camera on" : "Turn camera off"}
                aria-label={isCamOff ? "Enable camera" : "Disable camera"}
              >
                {isCamOff ? "📷" : "🎥"}
              </button>
              <button
                className="ctrl-btn"
                onClick={toggleFullscreen}
                title="Toggle fullscreen"
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? "⊡" : "⛶"}
              </button>
            </div>

            <div className="vs-controls-right">
              <button
                className={`viol-count-btn ${highViolations > 0 ? "has-high" : ""}`}
                onClick={() => setShowLog((s) => !s)}
                aria-expanded={showLog}
              >
                {violations.length > 0
                  ? <span className="viol-badge">{violations.length}</span>
                  : "✓"}
                {violations.length > 0 ? "Violations" : "No Violations"}
              </button>
            </div>
          </div>
        )}

        {/* ── Violation Log ── */}
        {showLog && (
          <div className="vs-log">
            <div className="vs-log-title">Violation Log</div>
            <ViolationLog violations={violations} />
          </div>
        )}

      </div>
    </>
  );
}


/* ─────────────────────────────────────────────────────────────────
   USAGE EXAMPLE:

   import VideoStream from "./VideoStream";

   function ExamPage() {
     const handleViolation = ({ type, label, severity, timestamp }) => {
       console.log(`[${severity.toUpperCase()}] ${label} at ${timestamp}`);
       // POST to your backend proctoring API here
     };

     return (
       <VideoStream
         mode="student"
         studentName="Jane Doe"
         examTitle="CS101 — Final Exam"
         onViolation={handleViolation}
         onStreamStart={(stream) => console.log("Stream started", stream)}
         onStreamStop={() => console.log("Stream stopped")}
         showControls={true}
         showStatus={true}
         recordingEnabled={true}
         faceDetection={true}
         width={640}
         height={360}
       />
     );
   }

   PRODUCTION NOTES:
   - Replace the simulated face detection in the useEffect with real
     inference using TensorFlow.js + face-api.js or your backend API.
   - For proctoring mode, stream video to your server using WebRTC
     (RTCPeerConnection) or MediaRecorder + chunked upload.
   - Tab-switch detection via visibilitychange is already wired up.
   - Integrate WebSocket for real-time proctor alerts.
───────────────────────────────────────────────────────────────── */