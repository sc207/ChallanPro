const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapChallan, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');
const { assignBillNumber } = require('../services/billNumber');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

router.get('/', requireCompanyId, async (req, res) => {
  try {
    let sql = 'SELECT * FROM challans WHERE company_id = ? AND is_deleted = 0';
    const params = [req.companyId];
    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY date DESC';
    const rows = await queryAll(sql, params);
    res.json(rows.map(mapChallan));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || 'c' + uid();
    const items = b.items || [];
    const total = b.total || items.reduce((s, i) => s + (i.lt || i.qty * i.price || 0), 0);
    const status = b.status || 'draft';
    let billNo = b.billNo || '';

    await run(
      `INSERT INTO challans (id,company_id,client_id,bill_no,date,total,mode,status,items_json,gst_enabled,ref_bill_no,vehicle_no,receiver,notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.companyId, b.clientId, billNo, b.date, total, b.mode||'credit', status,
       JSON.stringify(items), b.gstEnabled||0, b.refBillNo||'', b.vehicleNo||'', b.receiver||'', b.notes||'']
    );
    const row = await queryOne('SELECT * FROM challans WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'challan', entityId: id, companyId: req.companyId, details: { billNo } });
    res.status(201).json(mapChallan(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body;
    const existing = await queryOne('SELECT * FROM challans WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const items = b.items || JSON.parse(existing.items_json || '[]');
    const total = b.total ?? items.reduce((s, i) => s + (i.lt || 0), 0);
    await run(
      `UPDATE challans SET bill_no=?,client_id=?,date=?,total=?,mode=?,items_json=?,gst_enabled=?,ref_bill_no=?,vehicle_no=?,receiver=?,notes=? WHERE id=?`,
      [b.billNo??existing.bill_no, b.clientId||existing.client_id, b.date||existing.date, total, b.mode||existing.mode,
       JSON.stringify(items), b.gstEnabled??existing.gst_enabled, b.refBillNo??existing.ref_bill_no,
       b.vehicleNo??existing.vehicle_no, b.receiver??existing.receiver, b.notes??existing.notes, id]
    );
    const row = await queryOne('SELECT * FROM challans WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'challan', entityId: id, companyId: existing.company_id, details: { billNo: row.bill_no } });
    res.json(mapChallan(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM challans WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Only draft challans can be confirmed' });
    let billNo;
    if (existing.bill_no && existing.bill_no.trim()) {
      billNo = existing.bill_no;
      const parts = billNo.split('/');
      const num = parseInt(parts[1]) || 0;
      const co = await queryOne('SELECT next_bill_number FROM companies WHERE id = ?', [existing.company_id]);
      if (co && num >= co.next_bill_number) {
        await run('UPDATE companies SET next_bill_number = ? WHERE id = ?', [num + 1, existing.company_id]);
      }
    } else {
      billNo = await assignBillNumber(existing.company_id);
    }
    await run(
      `UPDATE challans SET status='confirmed', bill_no=?, confirmed_at=datetime('now') WHERE id=?`,
      [billNo, id]
    );
    const row = await queryOne('SELECT * FROM challans WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CONFIRM', entityType: 'challan', entityId: id, companyId: existing.company_id, details: { billNo } });
    res.json(mapChallan(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM challans WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run(`UPDATE challans SET status='cancelled' WHERE id=?`, [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CANCEL', entityType: 'challan', entityId: id, companyId: existing.company_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM challans WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE challans SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'challan', entityId: id, companyId: existing.company_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
