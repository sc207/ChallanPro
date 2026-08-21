const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapUpiAccount, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');

const router = express.Router();

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM upi_accounts WHERE company_id = ? AND is_deleted = 0 ORDER BY name',
      [req.companyId]
    );
    res.json(rows.map(mapUpiAccount));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Name is required' });
    const result = await run(
      'INSERT INTO upi_accounts (company_id, name, opening_balance) VALUES (?,?,?)',
      [req.companyId, b.name, b.openingBalance ?? 0]
    );
    const row = await queryOne('SELECT * FROM upi_accounts WHERE id = ?', [result.lastInsertRowid]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'upiAccount', entityId: String(result.lastInsertRowid), companyId: req.companyId, details: { name: b.name } });
    res.status(201).json(mapUpiAccount(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const existing = await queryOne('SELECT * FROM upi_accounts WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run(
      'UPDATE upi_accounts SET name=?, opening_balance=? WHERE id=?',
      [b.name || existing.name, b.openingBalance ?? existing.opening_balance, id]
    );
    const row = await queryOne('SELECT * FROM upi_accounts WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'upiAccount', entityId: String(id), companyId: existing.company_id, details: { name: row.name } });
    res.json(mapUpiAccount(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await queryOne('SELECT * FROM upi_accounts WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE upi_accounts SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'upiAccount', entityId: String(id), companyId: existing.company_id, details: { name: existing.name } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
