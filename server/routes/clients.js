const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapClient, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');

const router = express.Router();

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM clients WHERE company_id = ? AND is_deleted = 0 ORDER BY name',
      [req.companyId]
    );
    res.json(rows.map(mapClient));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO clients (company_id,name,address,phone,email,gstin,last_asked) VALUES (?,?,?,?,?,?,?)',
      [req.companyId, b.name, b.address||'', b.phone||'', b.email||'', b.gstin||b.gst||'', b.lastAsked||null]
    );
    const id = result.lastInsertRowid;
    const row = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'client', entityId: String(id), companyId: req.companyId, details: { name: b.name } });
    res.status(201).json(mapClient(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const existing = await queryOne('SELECT * FROM clients WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run(
      'UPDATE clients SET name=?,address=?,phone=?,email=?,gstin=?,last_asked=? WHERE id=?',
      [b.name, b.address||'', b.phone||'', b.email||'', b.gstin||b.gst||'', b.lastAsked||null, id]
    );
    const row = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'client', entityId: String(id), companyId: existing.company_id, details: { name: b.name } });
    res.json(mapClient(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await queryOne('SELECT * FROM clients WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE clients SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'client', entityId: String(id), companyId: existing.company_id, details: { name: existing.name } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
