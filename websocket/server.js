require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const { verify } = require('../backend/src/utils/jwt');
const frameHandler = require('./handlers/frameHandler');
const audioHandler = require('./handlers/audioHandler');

const PORT = process.env.WS_PORT || 5001;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Track admin subscribers and per-session clients
const adminClients = new Set();
const sessionClients = new Map(); // sessionId -> Set<ws>

wss.on('connection', (ws, req) => {
  const { query } = url.parse(req.url, true);
  const { sessionId, token } = query;

  // Authenticate
  let user;
  try {
    user = verify(token);
  } catch {
    ws.close(4001, 'Unauthorized');
    return;
  }

  // Admin feed subscriber
  if (req.url.includes('/admin') || user.role === 'admin') {
    adminClients.add(ws);
    ws.on('close', () => adminClients.delete(ws));
    console.log(`[WS] Admin connected: ${user.email}`);
    return;
  }

  // Student session client
  if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
  sessionClients.get(sessionId).add(ws);
  console.log(`[WS] Student connected: ${user.email} | session: ${sessionId}`);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'frame') {
      const violation = await frameHandler.process(msg.data, msg.sessionId, user);
      if (violation) {
        // Alert the student
        ws.send(JSON.stringify({ type: 'violation', payload: violation }));
        // Broadcast to all admins
        broadcastToAdmins({ type: 'violation', payload: { ...violation, student_name: user.name } });
      }
    }

    if (msg.type === 'browser_event') {
      const violation = await audioHandler.processBrowserEvent(msg.event, msg.sessionId, user);
      if (violation) {
        ws.send(JSON.stringify({ type: 'violation', payload: violation }));
        broadcastToAdmins({ type: 'violation', payload: { ...violation, student_name: user.name } });
      }
    }
  });

  ws.on('close', () => {
    sessionClients.get(sessionId)?.delete(ws);
    console.log(`[WS] Student disconnected: session ${sessionId}`);
  });

  ws.on('error', (err) => console.error('[WS] Error:', err));
});

function broadcastToAdmins(payload) {
  const msg = JSON.stringify(payload);
  adminClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

server.listen(PORT, () => console.log(`✅ WebSocket server running on port ${PORT}`));

module.exports = { broadcastToAdmins };
