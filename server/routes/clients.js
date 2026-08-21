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
    const cstart = b.chalStartNumber || 1;
    const result = await run(
      'INSERT INTO clients (company_id,name,address,phone,email,gstin,opening_balance,opening_balance_date,last_asked,chal_prefix,chal_start_number,chal_seq_period,chal_next_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.companyId, b.name, b.address||'', b.phone||'', b.email||'', b.gstin||b.gst||'', b.openingBalance??0, b.openingBalanceDate||null, b.lastAsked||null, b.chalPrefix||'', cstart, '', cstart]
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
    const newStart = b.chalStartNumber ?? existing.chal_start_number ?? 1;
    const startChanged = b.chalStartNumber !== undefined && b.chalStartNumber !== existing.chal_start_number;
    await run(
      'UPDATE clients SET name=?,address=?,phone=?,email=?,gstin=?,opening_balance=?,opening_balance_date=?,last_asked=?,chal_prefix=?,chal_start_number=?,chal_next_number=?,chal_seq_period=? WHERE id=?',
      // Merge against the existing row so a partial PUT can't blank fields or NULL the NOT-NULL name
      [b.name ?? existing.name, b.address ?? existing.address, b.phone ?? existing.phone, b.email ?? existing.email,
       b.gstin ?? b.gst ?? existing.gstin, b.openingBalance ?? existing.opening_balance, b.openingBalanceDate ?? existing.opening_balance_date, b.lastAsked ?? existing.last_asked,
       b.chalPrefix??existing.chal_prefix, newStart,
       startChanged ? newStart : (existing.chal_next_number || newStart),
       startChanged ? '' : (existing.chal_seq_period || ''), id]
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
