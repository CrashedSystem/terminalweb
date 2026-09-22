'use strict';
/**
 * terminalweb server — entry point.
 * HTTP (express static + REST) + WebSocket (/ws) PTY transport.
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const config = require('./config');
const sessions = require('./sessions');
const api = require('./api');

const settings = config.load();
const PORT = Number(process.env.PORT || settings.port || 8080);
const HOST = '127.0.0.1';
const TOKEN = process.env.TOKEN || settings.token || '';

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', api());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function authOk(url) {
  if (!TOKEN) return true;
  const q = new URL(url, 'http://localhost').searchParams;
  return q.get('token') === TOKEN;
}

wss.on('connection', (ws, req) => {
  if (!authOk(req.url)) {
    ws.close(4001, 'unauthorized');
    return;
  }

  const q = new URL(req.url, 'http://localhost').searchParams;
  const sessionId = q.get('session');
  const profileId = q.get('profile');
  const cols = Number(q.get('cols') || 80);
  const rows = Number(q.get('rows') || 24);

  /** @type {{id:string}|null} */
  let current = null;

  const attach = (id, pid) => {
    const profile = config.getProfile(pid);
    if (!profile) {
      ws.send(JSON.stringify({ type: 'error', message: 'unknown profile' }));
      return;
    }
    sessions.attach(id, profile, cols, rows);
    sessions.addClient(id, ws);
    current = { id };
    ws.send(JSON.stringify({ type: 'session', sessionId: id }));
  };

  if (sessionId) {
    attach(sessionId, profileId || config.load().defaultProfile);
  } else {
    // No session id → create a fresh session with the requested profile
    const profile = config.getProfile(profileId);
    if (!profile) {
      ws.send(JSON.stringify({ type: 'error', message: 'unknown profile' }));
      return;
    }
    const s = sessions.create(profile, cols, rows);
    sessions.addClient(s.id, ws);
    current = { id: s.id };
    ws.send(JSON.stringify({ type: 'session', sessionId: s.id }));
  }

  ws.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(buf.toString());
    } catch (e) {
      return;
    }
    switch (msg.type) {
      case 'create': {
        const profile = config.getProfile(msg.profileId);
        if (!profile) {
          ws.send(JSON.stringify({ type: 'error', message: 'unknown profile' }));
          return;
        }
        const s = sessions.create(profile, msg.cols || cols, msg.rows || rows);
        sessions.addClient(s.id, ws);
        current = { id: s.id };
        ws.send(JSON.stringify({ type: 'session', sessionId: s.id }));
        break;
      }
      case 'input':
        if (current) sessions.write(current.id, msg.data);
        break;
      case 'resize':
        if (current) sessions.resize(current.id, msg.cols, msg.rows);
        break;
      case 'kill':
        if (current) sessions.kill(current.id);
        break;
      default:
        break;
    }
  });

  ws.on('close', () => {
    if (current) sessions.removeClient(current.id, ws);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`terminalweb listening on http://${HOST}:${PORT}`);
});

function shutdown() {
  sessions.shutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);