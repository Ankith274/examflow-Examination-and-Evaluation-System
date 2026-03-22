// proctorService.js
// Manages WebSocket connection to the proctoring server.
// Sends webcam frames and receives violation alerts.

const WS_URL = import.meta.env.REACT_APP_WS_URL || 'ws://localhost:5001';

class ProctorService {
  constructor() {
    this.ws = null;
    this.sessionId = null;
    this.onViolation = null;
    this.reconnectAttempts = 0;
    this.maxReconnects = 5;
  }

  connect(sessionId, onViolation) {
    this.sessionId = sessionId;
    this.onViolation = onViolation;
    this._open();
  }

  _open() {
    const token = localStorage.getItem('token');
    this.ws = new WebSocket(`${WS_URL}?sessionId=${this.sessionId}&token=${token}`);

    this.ws.onopen = () => {
      console.log('[Proctor] WebSocket connected');
      this.reconnectAttempts = 0;
      this.ws.send(JSON.stringify({ type: 'init', sessionId: this.sessionId }));
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'violation' && this.onViolation) {
          this.onViolation(msg.payload);
        }
      } catch (e) {
        console.warn('[Proctor] Bad message', e);
      }
    };

    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnects) {
        this.reconnectAttempts++;
        console.log(`[Proctor] Reconnecting (${this.reconnectAttempts})...`);
        setTimeout(() => this._open(), 2000 * this.reconnectAttempts);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[Proctor] WebSocket error', err);
    };
  }

  sendFrame(base64ImageData) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'frame',
      sessionId: this.sessionId,
      data: base64ImageData,
      timestamp: Date.now()
    }));
  }

  reportBrowserEvent(eventType) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'browser_event',
      sessionId: this.sessionId,
      event: eventType,
      timestamp: Date.now()
    }));
  }

  disconnect() {
    this.maxReconnects = 0;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default new ProctorService();
