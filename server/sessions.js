'use strict';
/**
 * sessions.js — tmux-backed session manager.
 * Session = tmux session named `tw-<uuid>`.
 * - attach(): spawn pty (re-attaches to existing tmux session via -A)
 * - removeClient(): last client gone → kill pty (detach), tmux survives
 * - kill(): tmux kill-session — permanent termination
 */
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const ptyWrap = require('./pty');

class SessionManager {
  constructor() {
    /** @type {Map<string, {id:string, profile:object, pty:object, tmuxName:string, clients:Set}>} */
    this.sessions = new Map();
  }

  create(profile, cols, rows) {
    const id = randomUUID();
    return this.attach(id, profile, cols, rows);
  }

  attach(id, profile, cols, rows) {
    let s = this.sessions.get(id);
    if (!s) {
      const p = ptyWrap.spawnSession({ id, profile, cols, rows });
      s = { id, profile, pty: p, tmuxName: `tw-${id}`, clients: new Set() };
      this.sessions.set(id, s);

      p.onData((data) => {
        for (const c of s.clients) {
          if (c.readyState === 1) c.send(JSON.stringify({ type: 'output', data }));
        }
      });
      p.onExit(({ exitCode }) => {
        this.sessions.delete(id);
        for (const c of s.clients) {
          if (c.readyState === 1) c.send(JSON.stringify({ type: 'exit', code: exitCode }));
        }
      });
    } else {
      ptyWrap.resize(s.pty, cols, rows);
    }
    return s;
  }

  get(id) {
    return this.sessions.get(id);
  }

  addClient(id, ws) {
    const s = this.sessions.get(id);
    if (s) s.clients.add(ws);
    return s;
  }

  removeClient(id, ws) {
    const s = this.sessions.get(id);
    if (!s) return;
    s.clients.delete(ws);
    if (s.clients.size === 0) {
      // Detach: kill the tmux client process; tmux session persists.
      try { s.pty.kill(); } catch (e) { /* already dead */ }
      this.sessions.delete(id);
    }
  }

  write(id, data) {
    const s = this.sessions.get(id);
    if (s) {
      try { s.pty.write(data); } catch (e) { /* dead */ }
    }
  }

  resize(id, cols, rows) {
    const s = this.sessions.get(id);
    if (s) ptyWrap.resize(s.pty, cols, rows);
  }

  kill(id) {
    const s = this.sessions.get(id);
    if (s) {
      try { s.pty.kill(); } catch (e) { /* already dead */ }
      this.sessions.delete(id);
    }
    execFile('tmux', ['kill-session', '-t', `tw-${id}`], () => {});
  }

  /** List live tmux session ids (tw-* prefix). */
  list(cb) {
    execFile('tmux', ['list-sessions', '-F', '#{session_name}'], (err, stdout) => {
      if (err) return cb([]);
      const names = String(stdout)
        .trim()
        .split('\n')
        .filter((n) => n.startsWith('tw-'));
      cb(names.map((n) => n.slice(3)));
    });
  }

  /** Kill all ptys on shutdown (tmux sessions survive). */
  shutdown() {
    for (const s of this.sessions.values()) {
      try { s.pty.kill(); } catch (e) { /* ignore */ }
    }
    this.sessions.clear();
  }
}

module.exports = new SessionManager();