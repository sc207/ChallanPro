const express = require('express');
const { queryAll, run } = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/audit');

const router = express.Router();

// List active (non-revoked) sessions — admin only
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT id,user_id,user_email,user_agent,ip,created_at,last_seen FROM sessions WHERE revoked = 0 ORDER BY last_seen DESC'
    );
    const current = req.user.jti;
    res.json(rows.map(r => ({
      id: r.id,
      userEmail: r.user_email,
      userAgent: r.user_agent,
      ip: r.ip,
      createdAt: r.created_at,
      lastSeen: r.last_seen,
      current: r.id === current,
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Revoke ALL sessions (?all=1) or all OTHERS (default, keeps the caller signed in) — admin only
router.delete('/', requireRole('admin'), async (req, res) => {
  try {
    if (req.query.all === '1') {
      await run('UPDATE sessions SET revoked = 1 WHERE revoked = 0');
    } else {
      await run('UPDATE sessions SET revoked = 1 WHERE revoked = 0 AND id != ?', [req.user.jti || '']);
    }
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'DELETE', entityType: 'session', entityId: '*', details: { scope: req.query.all === '1' ? 'all' : 'others' } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Revoke a single session — admin only
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await run('UPDATE sessions SET revoked = 1 WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'DELETE', entityType: 'session', entityId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
