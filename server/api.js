'use strict';
/**
 * api.js — REST endpoints.
 *   GET    /api/health
 *   GET    /api/sessions          list live tmux sessions
 *   POST   /api/sessions          { profileId, cols, rows } → { id }
 *   DELETE /api/sessions/:id      kill session permanently
 *   GET    /api/settings          merged settings
 *   PUT    /api/settings          save settings
 *   GET    /api/profiles          resolved profile list
 */
const express = require('express');
const config = require('./config');
const sessions = require('./sessions');

function router() {
  const r = express.Router();

  r.get('/health', (req, res) => {
    res.json({ ok: true, name: 'terminalweb', version: '0.2.0' });
  });

  r.get('/sessions', (req, res) => {
    sessions.list((ids) => res.json({ sessions: ids }));
  });

  r.post('/sessions', (req, res) => {
    const profile = config.getProfile(req.body && req.body.profileId);
    if (!profile) return res.status(400).json({ error: 'unknown profile' });
    const cols = Number((req.body && req.body.cols) || 80);
    const rows = Number((req.body && req.body.rows) || 24);
    const s = sessions.create(profile, cols, rows);
    res.json({ id: s.id });
  });

  r.delete('/sessions/:id', (req, res) => {
    sessions.kill(req.params.id);
    res.json({ ok: true });
  });

  r.get('/settings', (req, res) => {
    res.json(config.load());
  });

  r.put('/settings', (req, res) => {
    try {
      config.save(req.body);
      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  r.get('/profiles', (req, res) => {
    res.json(config.load().profiles);
  });

  return r;
}

module.exports = router;