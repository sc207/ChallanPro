const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapSupplier, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');

const router = express.Router();

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM suppliers WHERE company_id = ? AND is_deleted = 0 ORDER BY name',
      [req.companyId]
    );
    res.json(rows.map(mapSupplier));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Name is required' });
    const start = b.purStartNumber || 1;
    const result = await run(
      'INSERT INTO suppliers (company_id,name,address,phone,email,gstin,opening_balance,opening_balance_date,last_asked,pur_prefix,pur_start_number,pur_seq_period,pur_next_number) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.companyId, b.name, b.address||'', b.phone||'', b.email||'', b.gstin||b.gst||'', b.openingBalance??0, b.openingBalanceDate||null, b.lastAsked||null, b.purPrefix||'', start, '', start]
    );
    const id = result.lastInsertRowid;
    const row = await queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'supplier', entityId: String(id), companyId: req.companyId, details: { name: b.name } });
    res.status(201).json(mapSupplier(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const existing = await queryOne('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (b.name !== undefined && !String(b.name).trim()) return res.status(400).json({ error: 'Name is required' });
    const newStart = b.purStartNumber ?? existing.pur_start_number ?? 1;
    const startChanged = b.purStartNumber !== undefined && b.purStartNumber !== existing.pur_start_number;
    await run(
      'UPDATE suppliers SET name=?,address=?,phone=?,email=?,gstin=?,opening_balance=?,opening_balance_date=?,last_asked=?,pur_prefix=?,pur_start_number=?,pur_next_number=?,pur_seq_period=? WHERE id=?',
      [b.name??existing.name, b.address??existing.address, b.phone??existing.phone, b.email??existing.email, (b.gstin??b.gst)??existing.gstin,
       b.openingBalance??existing.opening_balance, b.openingBalanceDate??existing.opening_balance_date, b.lastAsked??existing.last_asked,
       b.purPrefix??existing.pur_prefix, newStart,
       startChanged ? newStart : (existing.pur_next_number || newStart),
       startChanged ? '' : (existing.pur_seq_period || ''), id]
    );
    const row = await queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'supplier', entityId: String(id), companyId: existing.company_id, details: { name: row.name } });
    res.json(mapSupplier(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await queryOne('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE suppliers SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'supplier', entityId: String(id), companyId: existing.company_id, details: { name: existing.name } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
