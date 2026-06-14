const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { requireRole } = require('../middleware/auth');
const { logAudit } = require('../services/audit');

const router = express.Router();

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const rows = await queryAll('SELECT id, email, role, active, created_at FROM users ORDER BY id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const role = req.body.role === 'admin' ? 'admin' : 'staff';
    if (!email) return res.status(400).json({ error: 'Email required' });
    const result = await run('INSERT INTO users (email, role) VALUES (?, ?)', [email, role]);
    const row = await queryOne('SELECT id, email, role, active, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'user', entityId: String(result.lastInsertRowid), details: { email, role } });
    res.status(201).json(row);
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'User already exists' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id/activate', requireRole('admin'), async (req, res) => {
  try {
    await run('UPDATE users SET active = 1 WHERE id = ?', [req.params.id]);
    const row = await queryOne('SELECT id, email, role, active, created_at FROM users WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'user', entityId: req.params.id, details: { action: 'reactivate' } });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id, 10) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    await run('UPDATE users SET active = 0 WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'user', entityId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
