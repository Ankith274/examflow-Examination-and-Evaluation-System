/**
 * proctorService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Online Examination & Evaluation System — Proctor Service
 *
 * Responsibilities:
 *  • Tab / window visibility monitoring
 *  • Full-screen enforcement & detection
 *  • Copy / paste / right-click prevention
 *  • Keyboard shortcut blocking (DevTools, Print, Save, etc.)
 *  • Mouse leave detection (cursor exits viewport)
 *  • Face / webcam presence detection (via MediaPipe or basic heuristics)
 *  • Multiple-face / no-face alerts
 *  • Screenshot / screen-capture detection (best-effort)
 *  • Idle / inactivity detection
 *  • Network offline detection
 *  • Violation log management (in-memory + localStorage backup)
 *  • Event emitter for UI layer to subscribe to proctor events
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ────────────────────────────────────────────────────────────────

export const ViolationType = Object.freeze({
  TAB_SWITCH:          "TAB_SWITCH",
  WINDOW_BLUR:         "WINDOW_BLUR",
  FULLSCREEN_EXIT:     "FULLSCREEN_EXIT",
  COPY_ATTEMPT:        "COPY_ATTEMPT",
  PASTE_ATTEMPT:       "PASTE_ATTEMPT",
  CUT_ATTEMPT:         "CUT_ATTEMPT",
  RIGHT_CLICK:         "RIGHT_CLICK",
  KEYBOARD_SHORTCUT:   "KEYBOARD_SHORTCUT",
  MOUSE_LEAVE:         "MOUSE_LEAVE",
  NO_FACE_DETECTED:    "NO_FACE_DETECTED",
  MULTIPLE_FACES:      "MULTIPLE_FACES",
  FACE_OBSTRUCTED:     "FACE_OBSTRUCTED",
  SCREENSHOT_ATTEMPT:  "SCREENSHOT_ATTEMPT",
  IDLE_TIMEOUT:        "IDLE_TIMEOUT",
  NETWORK_OFFLINE:     "NETWORK_OFFLINE",
  DEVTOOLS_OPEN:       "DEVTOOLS_OPEN",
  SCREEN_SHARE:        "SCREEN_SHARE",
});

export const ViolationSeverity = Object.freeze({
  LOW:      "LOW",      // Warn only
  MEDIUM:   "MEDIUM",   // Warn + increment counter
  HIGH:     "HIGH",     // Warn + counter + possible auto-submit
  CRITICAL: "CRITICAL", // Immediate escalation / auto-submit
});

const SEVERITY_MAP = {
  [ViolationType.TAB_SWITCH]:         ViolationSeverity.HIGH,
  [ViolationType.WINDOW_BLUR]:        ViolationSeverity.MEDIUM,
  [ViolationType.FULLSCREEN_EXIT]:    ViolationSeverity.HIGH,
  [ViolationType.COPY_ATTEMPT]:       ViolationSeverity.MEDIUM,
  [ViolationType.PASTE_ATTEMPT]:      ViolationSeverity.MEDIUM,
  [ViolationType.CUT_ATTEMPT]:        ViolationSeverity.LOW,
  [ViolationType.RIGHT_CLICK]:        ViolationSeverity.LOW,
  [ViolationType.KEYBOARD_SHORTCUT]:  ViolationSeverity.MEDIUM,
  [ViolationType.MOUSE_LEAVE]:        ViolationSeverity.LOW,
  [ViolationType.NO_FACE_DETECTED]:   ViolationSeverity.HIGH,
  [ViolationType.MULTIPLE_FACES]:     ViolationSeverity.CRITICAL,
  [ViolationType.FACE_OBSTRUCTED]:    ViolationSeverity.MEDIUM,
  [ViolationType.SCREENSHOT_ATTEMPT]: ViolationSeverity.HIGH,
  [ViolationType.IDLE_TIMEOUT]:       ViolationSeverity.MEDIUM,
  [ViolationType.NETWORK_OFFLINE]:    ViolationSeverity.HIGH,
  [ViolationType.DEVTOOLS_OPEN]:      ViolationSeverity.CRITICAL,
  [ViolationType.SCREEN_SHARE]:       ViolationSeverity.CRITICAL,
};

// Thresholds — configurable via ProctorService constructor options
const DEFAULTS = {
  maxViolations:          5,        // Auto-submit after this many HIGH/CRITICAL violations
  idleTimeoutMs:          60_000,   // 60 seconds of inactivity = idle violation
  mouseleaveDebounceMs:   1_500,    // Debounce mouse-leave events
  faceCheckIntervalMs:    3_000,    // How often to analyze webcam frame
  devToolsCheckIntervalMs:1_000,    // DevTools size-diff check interval
  storageKey:             "ep_proctor_log",
  sessionKey:             "ep_proctor_session",
  requireFullscreen:      true,
  enableWebcam:           false,    // Set true when webcam proctoring is available
  enableDevToolsDetect:   true,
  enableScreenShareDetect:true,
  autoSubmitOnMaxViolations: true,
};

// Blocked keyboard shortcuts
const BLOCKED_SHORTCUTS = [
  { key: "F12" },
  { key: "F5" },
  { key: "F11" },
  { ctrlKey: true, key: "u" },   // View source
  { ctrlKey: true, key: "s" },   // Save
  { ctrlKey: true, key: "p" },   // Print
  { ctrlKey: true, key: "a" },   // Select all
  { ctrlKey: true, key: "c" },   // Copy (handled separately)
  { ctrlKey: true, key: "v" },   // Paste (handled separately)
  { ctrlKey: true, key: "x" },   // Cut (handled separately)
  { ctrlKey: true, shiftKey: true, key: "i" },  // DevTools
  { ctrlKey: true, shiftKey: true, key: "j" },  // Console
  { ctrlKey: true, shiftKey: true, key: "c" },  // Inspector
  { ctrlKey: true, shiftKey: true, key: "k" },  // Firefox Console
  { metaKey: true, key: "c" },   // Mac copy
  { metaKey: true, key: "v" },   // Mac paste
  { metaKey: true, key: "s" },   // Mac save
  { metaKey: true, key: "p" },   // Mac print
  { metaKey: true, shiftKey: true, key: "i" },
  { key: "PrintScreen" },
];

// ─── Tiny EventEmitter ────────────────────────────────────────────────────────

class EventEmitter {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, ...args) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(...args); } catch (e) { console.error(`[ProctorService] Listener error on "${event}":`, e); }
    });
  }

  once(event, fn) {
    const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
    this.on(event, wrapper);
  }

  removeAllListeners(event) {
    if (event) delete this._listeners[event];
    else this._listeners = {};
  }
}

// ─── ProctorService ───────────────────────────────────────────────────────────

class ProctorService extends EventEmitter {
  /**
   * @param {object} options — Override DEFAULTS
   */
  constructor(options = {}) {
    super();
    this._opts = { ...DEFAULTS, ...options };
    this._active = false;
    this._violations = [];
    this._highViolationCount = 0;
    this._sessionId = null;
    this._examId = null;
    this._studentId = null;

    // Cleanup references
    this._cleanupFns = [];

    // Timers
    this._idleTimer = null;
    this._devToolsTimer = null;
    this._faceCheckTimer = null;
    this._mouseleaveTimer = null;

    // Webcam
    this._stream = null;
    this._videoEl = null;
    this._canvasEl = null;

    // DevTools heuristic baseline
    this._devToolsBaseline = null;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Start all proctor monitors.
   * @param {object} context — { examId, studentId }
   */
  async start({ examId, studentId } = {}) {
    if (this._active) {
      console.warn("[ProctorService] Already active. Call stop() first.");
      return;
    }

    this._examId    = examId    || "unknown_exam";
    this._studentId = studentId || "unknown_student";
    this._sessionId = this._generateSessionId();
    this._active    = true;
    this._violations = this._loadPersistedViolations();

    console.info(`[ProctorService] Session started — ${this._sessionId}`);

    this._registerVisibilityMonitor();
    this._registerWindowBlurMonitor();
    this._registerClipboardMonitor();
    this._registerRightClickMonitor();
    this._registerKeyboardMonitor();
    this._registerMouseLeaveMonitor();
    this._registerIdleMonitor();
    this._registerNetworkMonitor();
    this._registerSelectionMonitor();

    if (this._opts.requireFullscreen) {
      this._registerFullscreenMonitor();
      await this._requestFullscreen();
    }

    if (this._opts.enableDevToolsDetect) {
      this._startDevToolsDetection();
    }

    if (this._opts.enableScreenShareDetect) {
      this._registerScreenShareMonitor();
    }

    if (this._opts.enableWebcam) {
      await this._initWebcam();
    }

    this.emit("started", { sessionId: this._sessionId, examId, studentId });
  }

  /**
   * Stop all monitors and release resources.
   */
  stop() {
    if (!this._active) return;
    this._active = false;

    // Run all cleanup functions
    this._cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
    this._cleanupFns = [];

    // Clear timers
    clearTimeout(this._idleTimer);
    clearInterval(this._devToolsTimer);
    clearInterval(this._faceCheckTimer);
    clearTimeout(this._mouseleaveTimer);

    // Release webcam
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }

    // Persist final log
    this._persistViolations();

    console.info(`[ProctorService] Session ended — ${this._sessionId}`);
    this.emit("stopped", { sessionId: this._sessionId, summary: this.getSummary() });
  }

  /**
   * Pause monitoring temporarily (e.g. during allowed break).
   */
  pause() {
    this._paused = true;
    this.emit("paused");
  }

  /**
   * Resume monitoring after pause.
   */
  resume() {
    this._paused = false;
    this.emit("resumed");
    this._resetIdleTimer();
  }

  /**
   * Get the full violation log.
   * @returns {ViolationRecord[]}
   */
  getViolations() {
    return [...this._violations];
  }

  /**
   * Get violation count by type or total.
   * @param {string} [type]
   */
  getViolationCount(type) {
    if (type) return this._violations.filter(v => v.type === type).length;
    return this._violations.length;
  }

  /**
   * Get a summary object suitable for submission payload.
   */
  getSummary() {
    const counts = {};
    this._violations.forEach(v => {
      counts[v.type] = (counts[v.type] || 0) + 1;
    });
    return {
      sessionId:          this._sessionId,
      examId:             this._examId,
      studentId:          this._studentId,
      totalViolations:    this._violations.length,
      highViolations:     this._highViolationCount,
      violationCounts:    counts,
      violations:         this._violations,
      generatedAt:        new Date().toISOString(),
    };
  }

  /**
   * Clear the violation log (use with caution — admin only).
   */
  clearViolations() {
    this._violations = [];
    this._highViolationCount = 0;
    this._persistViolations();
    this.emit("violations_cleared");
  }

  /**
   * Manually request fullscreen (e.g. on user prompt).
   */
  async requestFullscreen() {
    return this._requestFullscreen();
  }

  /**
   * Check whether the exam is currently in fullscreen.
   */
  isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  // ── Violation Recording ─────────────────────────────────────────────────────

  /**
   * Record a violation event.
   * @param {string} type — ViolationType constant
   * @param {object} [meta] — Extra context
   */
  recordViolation(type, meta = {}) {
    if (!this._active || this._paused) return;

    const severity = SEVERITY_MAP[type] || ViolationSeverity.LOW;
    /** @type {ViolationRecord} */
    const record = {
      id:         this._generateId(),
      type,
      severity,
      timestamp:  new Date().toISOString(),
      examId:     this._examId,
      studentId:  this._studentId,
      sessionId:  this._sessionId,
      meta,
    };

    this._violations.push(record);

    if (severity === ViolationSeverity.HIGH || severity === ViolationSeverity.CRITICAL) {
      this._highViolationCount++;
    }

    // Persist to localStorage after every violation
    this._persistViolations();

    // Emit to UI layer
    this.emit("violation", record);
    this.emit(`violation:${type}`, record);

    console.warn(`[ProctorService] Violation [${severity}] — ${type}`, meta);

    // Auto-submit check
    if (
      this._opts.autoSubmitOnMaxViolations &&
      this._highViolationCount >= this._opts.maxViolations
    ) {
      this._triggerAutoSubmit(record);
    }

    return record;
  }

  // ── Private: Monitors ───────────────────────────────────────────────────────

  /** Visibility API — detects tab switches and minimized windows */
  _registerVisibilityMonitor() {
    const handler = () => {
      if (document.hidden) {
        this.recordViolation(ViolationType.TAB_SWITCH, {
          visibilityState: document.visibilityState,
        });
      }
    };
    document.addEventListener("visibilitychange", handler);
    this._cleanupFns.push(() => document.removeEventListener("visibilitychange", handler));
  }

  /** Window blur — focus moved to another window */
  _registerWindowBlurMonitor() {
    const handler = () => {
      if (!document.hidden) {
        // Only record if not already caught by visibility change
        this.recordViolation(ViolationType.WINDOW_BLUR, {
          activeElement: document.activeElement?.tagName,
        });
      }
    };
    window.addEventListener("blur", handler);
    this._cleanupFns.push(() => window.removeEventListener("blur", handler));
  }

  /** Fullscreen monitor */
  _registerFullscreenMonitor() {
    const handler = () => {
      if (!this.isFullscreen() && this._active) {
        this.recordViolation(ViolationType.FULLSCREEN_EXIT, {
          innerWidth:  window.innerWidth,
          innerHeight: window.innerHeight,
        });
        // Re-prompt fullscreen after short delay
        setTimeout(() => {
          if (this._active && !this.isFullscreen()) {
            this.emit("fullscreen_required");
          }
        }, 500);
      }
    };

    const events = [
      "fullscreenchange",
      "webkitfullscreenchange",
      "mozfullscreenchange",
      "MSFullscreenChange",
    ];
    events.forEach(e => document.addEventListener(e, handler));
    this._cleanupFns.push(() => events.forEach(e => document.removeEventListener(e, handler)));
  }

  /** Clipboard — copy, paste, cut */
  _registerClipboardMonitor() {
    const copyHandler  = (e) => { e.preventDefault(); this.recordViolation(ViolationType.COPY_ATTEMPT,  { selectedText: window.getSelection()?.toString()?.slice(0, 100) }); };
    const pasteHandler = (e) => { e.preventDefault(); this.recordViolation(ViolationType.PASTE_ATTEMPT, {}); };
    const cutHandler   = (e) => { e.preventDefault(); this.recordViolation(ViolationType.CUT_ATTEMPT,   {}); };

    document.addEventListener("copy",  copyHandler);
    document.addEventListener("paste", pasteHandler);
    document.addEventListener("cut",   cutHandler);

    this._cleanupFns.push(() => {
      document.removeEventListener("copy",  copyHandler);
      document.removeEventListener("paste", pasteHandler);
      document.removeEventListener("cut",   cutHandler);
    });
  }

  /** Right-click context menu */
  _registerRightClickMonitor() {
    const handler = (e) => {
      e.preventDefault();
      this.recordViolation(ViolationType.RIGHT_CLICK, { x: e.clientX, y: e.clientY });
    };
    document.addEventListener("contextmenu", handler);
    this._cleanupFns.push(() => document.removeEventListener("contextmenu", handler));
  }

  /** Keyboard shortcut blocking */
  _registerKeyboardMonitor() {
    const handler = (e) => {
      const blocked = BLOCKED_SHORTCUTS.some(s => {
        if (s.key && s.key.toLowerCase() !== e.key.toLowerCase()) return false;
        if (s.ctrlKey  !== undefined && s.ctrlKey  !== e.ctrlKey)  return false;
        if (s.shiftKey !== undefined && s.shiftKey !== e.shiftKey) return false;
        if (s.altKey   !== undefined && s.altKey   !== e.altKey)   return false;
        if (s.metaKey  !== undefined && s.metaKey  !== e.metaKey)  return false;
        return true;
      });

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        this.recordViolation(ViolationType.KEYBOARD_SHORTCUT, {
          key:      e.key,
          ctrlKey:  e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey:   e.altKey,
          metaKey:  e.metaKey,
          code:     e.code,
        });
      }
    };

    document.addEventListener("keydown", handler, true); // capture phase
    this._cleanupFns.push(() => document.removeEventListener("keydown", handler, true));
  }

  /** Mouse leaving viewport */
  _registerMouseLeaveMonitor() {
    const handler = (e) => {
      // Only fire when mouse truly leaves the document
      if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        clearTimeout(this._mouseleaveTimer);
        this._mouseleaveTimer = setTimeout(() => {
          this.recordViolation(ViolationType.MOUSE_LEAVE, {
            x:       e.clientX,
            y:       e.clientY,
            edge:    e.clientY <= 0 ? "top" : e.clientX <= 0 ? "left" : e.clientX >= window.innerWidth ? "right" : "bottom",
          });
        }, this._opts.mouseleaveDebounceMs);
      }
    };

    const cancelHandler = () => clearTimeout(this._mouseleaveTimer);
    document.addEventListener("mouseleave", handler);
    document.addEventListener("mouseenter", cancelHandler);
    this._cleanupFns.push(() => {
      document.removeEventListener("mouseleave", handler);
      document.removeEventListener("mouseenter", cancelHandler);
    });
  }

  /** Idle / inactivity detection */
  _registerIdleMonitor() {
    const activityEvents = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

    const resetIdle = () => this._resetIdleTimer();
    activityEvents.forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));

    this._resetIdleTimer();

    this._cleanupFns.push(() => {
      activityEvents.forEach(ev => document.removeEventListener(ev, resetIdle));
      clearTimeout(this._idleTimer);
    });
  }

  _resetIdleTimer() {
    clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      this.recordViolation(ViolationType.IDLE_TIMEOUT, {
        idleMs: this._opts.idleTimeoutMs,
      });
      // Keep re-checking
      this._resetIdleTimer();
    }, this._opts.idleTimeoutMs);
  }

  /** Network offline detection */
  _registerNetworkMonitor() {
    const offlineHandler = () => {
      this.recordViolation(ViolationType.NETWORK_OFFLINE, { online: false });
      this.emit("network_offline");
    };
    const onlineHandler = () => this.emit("network_online");

    window.addEventListener("offline", offlineHandler);
    window.addEventListener("online",  onlineHandler);
    this._cleanupFns.push(() => {
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("online",  onlineHandler);
    });
  }

  /** Text selection prevention */
  _registerSelectionMonitor() {
    const handler = (e) => {
      // Allow selection inside <input> and <textarea>
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
    };
    document.addEventListener("selectstart", handler);
    this._cleanupFns.push(() => document.removeEventListener("selectstart", handler));
  }

  // ── DevTools Detection ──────────────────────────────────────────────────────

  /**
   * Heuristic DevTools detection using window size differential.
   * Not 100% reliable but covers common cases.
   */
  _startDevToolsDetection() {
    const threshold = 160;
    let alerted = false;

    const check = () => {
      if (!this._active) return;

      const widthDiff  = window.outerWidth  - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;

      if (widthDiff > threshold || heightDiff > threshold) {
        if (!alerted) {
          alerted = true;
          this.recordViolation(ViolationType.DEVTOOLS_OPEN, {
            outerWidth:  window.outerWidth,
            innerWidth:  window.innerWidth,
            outerHeight: window.outerHeight,
            innerHeight: window.innerHeight,
            widthDiff,
            heightDiff,
          });
        }
      } else {
        alerted = false;
      }
    };

    this._devToolsTimer = setInterval(check, this._opts.devToolsCheckIntervalMs);
    this._cleanupFns.push(() => clearInterval(this._devToolsTimer));

    // Also hook the debugger trick (slows execution when DevTools are open)
    this._devToolsDebuggerCheck();
  }

  _devToolsDebuggerCheck() {
    let devToolsOpen = false;
    const element = new Image();
    Object.defineProperty(element, "id", {
      get: () => {
        devToolsOpen = true;
        if (this._active) {
          this.recordViolation(ViolationType.DEVTOOLS_OPEN, { method: "getter_trap" });
        }
      },
    });
    // This triggers the getter if DevTools is open and inspecting
    // eslint-disable-next-line no-console
    console.log && console.log("%c", element);
  }

  // ── Screen Share Detection ──────────────────────────────────────────────────

  _registerScreenShareMonitor() {
    // Modern browsers expose display capture in mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) return;

    // Monkey-patch getDisplayMedia to detect screen capture attempts
    const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
    if (originalGetDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = async (...args) => {
        this.recordViolation(ViolationType.SCREEN_SHARE, { method: "getDisplayMedia_intercepted" });
        // Still allow the call so browser doesn't error, but record it
        try {
          return await originalGetDisplayMedia(...args);
        } catch (err) {
          throw err;
        }
      };
      // Restore on cleanup
      this._cleanupFns.push(() => {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      });
    }
  }

  // ── Fullscreen Helpers ──────────────────────────────────────────────────────

  async _requestFullscreen() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen)             await el.requestFullscreen();
      else if (el.webkitRequestFullscreen)  await el.webkitRequestFullscreen();
      else if (el.mozRequestFullScreen)     await el.mozRequestFullScreen();
      else if (el.msRequestFullscreen)      await el.msRequestFullscreen();
      this.emit("fullscreen_entered");
    } catch (err) {
      console.warn("[ProctorService] Fullscreen request failed:", err.message);
      this.emit("fullscreen_failed", { error: err.message });
    }
  }

  // ── Webcam / Face Detection ─────────────────────────────────────────────────

  async _initWebcam() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
        audio: false,
      });

      this._videoEl  = document.createElement("video");
      this._canvasEl = document.createElement("canvas");
      this._videoEl.srcObject = this._stream;
      this._videoEl.setAttribute("playsinline", "true");
      await this._videoEl.play();

      this._canvasEl.width  = 320;
      this._canvasEl.height = 240;

      this.emit("webcam_ready", { stream: this._stream });

      // Start face checking
      this._faceCheckTimer = setInterval(() => this._checkFacePresence(), this._opts.faceCheckIntervalMs);
      this._cleanupFns.push(() => clearInterval(this._faceCheckTimer));
    } catch (err) {
      console.warn("[ProctorService] Webcam init failed:", err.message);
      this.emit("webcam_error", { error: err.message });
    }
  }

  /**
   * Basic face presence check using skin-tone pixel heuristics.
   * Replace with MediaPipe FaceMesh for production-grade detection.
   */
  _checkFacePresence() {
    if (!this._videoEl || !this._canvasEl || !this._active) return;

    const ctx = this._canvasEl.getContext("2d");
    ctx.drawImage(this._videoEl, 0, 0, 320, 240);

    const imageData = ctx.getImageData(80, 30, 160, 180); // Center crop
    const { data } = imageData;
    let skinPixels = 0;
    const total = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (this._isSkinTone(r, g, b)) skinPixels++;
    }

    const skinRatio = skinPixels / total;

    if (skinRatio < 0.03) {
      this.recordViolation(ViolationType.NO_FACE_DETECTED, { skinRatio: skinRatio.toFixed(4) });
    } else if (skinRatio > 0.65) {
      // Multiple faces or face very close — heuristic only
      this.recordViolation(ViolationType.MULTIPLE_FACES, { skinRatio: skinRatio.toFixed(4) });
    }
    // Emit frame data for UI overlay
    this.emit("face_check", { skinRatio, frame: this._canvasEl.toDataURL("image/jpeg", 0.5) });
  }

  /**
   * Basic skin tone detection (works across multiple skin tones, not just light skin).
   */
  _isSkinTone(r, g, b) {
    // Using normalized RGB and YCbCr heuristics
    if (r < 30 && g < 30 && b < 30) return false;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 15) return false;
    const yCbCr_y  = 0.299 * r + 0.587 * g + 0.114 * b;
    const yCbCr_cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const yCbCr_cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    return (
      yCbCr_y  > 80  &&
      yCbCr_cb > 77  && yCbCr_cb < 127 &&
      yCbCr_cr > 133 && yCbCr_cr < 173
    );
  }

  /**
   * Get a snapshot frame from webcam as a data URL.
   * @returns {string|null}
   */
  captureWebcamSnapshot() {
    if (!this._videoEl || !this._canvasEl) return null;
    const ctx = this._canvasEl.getContext("2d");
    ctx.drawImage(this._videoEl, 0, 0, 320, 240);
    return this._canvasEl.toDataURL("image/jpeg", 0.8);
  }

  // ── Auto-submit ─────────────────────────────────────────────────────────────

  _triggerAutoSubmit(triggeringViolation) {
    console.error("[ProctorService] MAX VIOLATIONS REACHED — triggering auto-submit");
    this.emit("auto_submit", {
      reason:             "max_violations_exceeded",
      triggeringViolation,
      summary:            this.getSummary(),
    });
    this.stop();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  _persistViolations() {
    try {
      const payload = {
        sessionId:  this._sessionId,
        examId:     this._examId,
        studentId:  this._studentId,
        violations: this._violations,
        savedAt:    new Date().toISOString(),
      };
      localStorage.setItem(this._opts.storageKey, JSON.stringify(payload));
    } catch (e) {
      // localStorage might be unavailable (private browsing quotas)
      console.warn("[ProctorService] Could not persist violations:", e.message);
    }
  }

  _loadPersistedViolations() {
    try {
      const raw = localStorage.getItem(this._opts.storageKey);
      if (!raw) return [];
      const data = JSON.parse(raw);
      // Only restore if same session
      if (data.sessionId === this._sessionId) return data.violations || [];
      return [];
    } catch {
      return [];
    }
  }

  // ── Utils ───────────────────────────────────────────────────────────────────

  _generateSessionId() {
    return `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  _generateId() {
    return `v_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

/**
 * Default singleton instance.
 * Import and use directly:
 *
 *   import proctorService from './proctorService';
 *   await proctorService.start({ examId: 'CS401', studentId: '22CS1A0501' });
 *   proctorService.on('violation', (record) => console.log(record));
 *   proctorService.on('auto_submit', ({ summary }) => submitExam(summary));
 */
const proctorService = new ProctorService();
export default proctorService;

/**
 * Factory for custom-configured instances (e.g. per-exam settings).
 *
 *   import { createProctorService } from './proctorService';
 *   const ps = createProctorService({ maxViolations: 3, enableWebcam: true });
 */
export function createProctorService(options = {}) {
  return new ProctorService(options);
}

export { ProctorService };

// ─── Usage Reference ──────────────────────────────────────────────────────────
/*

QUICK START
──────────────────────────────────────────────
import proctorService, { ViolationType } from './proctorService';

// 1. Start monitoring
await proctorService.start({ examId: 'CS401', studentId: '22CS1A0501' });

// 2. Listen for events
proctorService.on('violation', (record) => {
  console.log(`Violation: ${record.type} [${record.severity}]`);
  // Show warning toast to student
  showToast(`Warning: ${record.type}`);
});

proctorService.on('auto_submit', ({ summary }) => {
  // Trigger exam submission
  submitExam(summary);
});

proctorService.on('fullscreen_required', () => {
  showModal('Please return to fullscreen to continue your exam.');
});

proctorService.on('network_offline', () => {
  showBanner('You are offline. Reconnect to continue.');
});

// 3. On exam submit
const summary = proctorService.getSummary();
await submitExamWithProctorLog(answers, summary);
proctorService.stop();


EVENTS EMITTED
──────────────────────────────────────────────
"started"            → { sessionId, examId, studentId }
"stopped"            → { sessionId, summary }
"paused"             → (no args)
"resumed"            → (no args)
"violation"          → ViolationRecord
"violation:<TYPE>"   → ViolationRecord  (e.g. "violation:TAB_SWITCH")
"auto_submit"        → { reason, triggeringViolation, summary }
"fullscreen_entered" → (no args)
"fullscreen_failed"  → { error }
"fullscreen_required"→ (no args)
"network_offline"    → (no args)
"network_online"     → (no args)
"webcam_ready"       → { stream }
"webcam_error"       → { error }
"face_check"         → { skinRatio, frame }
"violations_cleared" → (no args)


VIOLATION RECORD SHAPE
──────────────────────────────────────────────
{
  id:         "v_1710800000000_abc12",
  type:       "TAB_SWITCH",           // ViolationType constant
  severity:   "HIGH",                 // ViolationSeverity constant
  timestamp:  "2026-03-19T10:30:00Z",
  examId:     "CS401",
  studentId:  "22CS1A0501",
  sessionId:  "ps_1710800000000_xyz",
  meta:       { ... }                 // Type-specific extra data
}

*/
