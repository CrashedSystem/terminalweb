'use strict';
/* sessions.js — WebSocket client with auto-reconnect */

TW.sessions = (() => {
  const RECONNECT_BASE = 1000;
  const RECONNECT_MAX = 10000;

  class SessionClient {
    /**
     * @param {object} pane - pane object with callbacks:
     *   onOutput(data), onExit(code), onStatus(status), onSessionId(id)
     * @param {object} opts { sessionId, profileId, cols, rows }
     */
    constructor(pane, opts) {
      this.pane = pane;
      this.sessionId = opts.sessionId || null;
      this.profileId = opts.profileId;
      this.cols = opts.cols;
      this.rows = opts.rows;
      this.ws = null;
      this.closedByUser = false;
      this.reconnectAttempt = 0;
      this.reconnectTimer = null;
      this.connected = false;
    }

    connect() {
      this.closedByUser = false;
      this._open();
    }

    _open() {
      const params = new URLSearchParams();
      if (this.sessionId) params.set('session', this.sessionId);
      if (this.profileId) params.set('profile', this.profileId);
      params.set('cols', this.cols);
      params.set('rows', this.rows);
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${location.host}/ws?${params.toString()}`;

      this.pane.onStatus('connecting');
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempt = 0;
        this.pane.onStatus('connected');
      };

      this.ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        switch (msg.type) {
          case 'session':
            this.sessionId = msg.sessionId;
            this.pane.onSessionId(msg.sessionId);
            break;
          case 'output':
            this.pane.onOutput(msg.data);
            break;
          case 'exit':
            this.connected = false;
            this.pane.onExit(msg.code);
            break;
          case 'error':
            this.pane.onStatus('error');
            break;
          default:
            break;
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        if (this.closedByUser) return;
        // Unexpected close → reconnect with backoff
        const delay = Math.min(RECONNECT_BASE * Math.pow(2, this.reconnectAttempt), RECONNECT_MAX);
        this.reconnectAttempt++;
        this.pane.onStatus('reconnecting');
        this.reconnectTimer = setTimeout(() => this._open(), delay);
      };

      this.ws.onerror = () => {
        try { this.ws.close(); } catch (e) { /* ignore */ }
      };
    }

    sendInput(data) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'input', data }));
      }
    }

    resize(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    }

    kill() {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'kill' }));
      }
    }

    /** User-initiated close: no reconnect. */
    close() {
      this.closedByUser = true;
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      if (this.ws) {
        try { this.ws.close(); } catch (e) { /* ignore */ }
      }
    }
  }

  function connect(pane, opts) {
    return new SessionClient(pane, opts);
  }

  return { connect };
})();