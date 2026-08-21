const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapPurchase, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');
const { assignPurchaseNumberFromSupplier, bumpSupplierForManual } = require('../services/billNumber');

const router = express.Router();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

router.get('/', requireCompanyId, async (req, res) => {
  try {
    let sql = 'SELECT * FROM purchases WHERE company_id = ? AND is_deleted = 0';
    const params = [req.companyId];
    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY date DESC';
    const rows = await queryAll(sql, params);
    res.json(rows.map(mapPurchase));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || 'pur' + uid();
    const items = b.items || [];
    const total = b.total || items.reduce((s, i) => s + (i.lt || i.qty * i.price || 0), 0);
    const status = b.status || 'draft';
    const billNo = b.billNo || '';

    await run(
      `INSERT INTO purchases (id,company_id,supplier_id,bill_no,date,total,mode,status,items_json,gst_enabled,ref_bill_no,vehicle_no,receiver,notes,doc_label,upi_account_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.companyId, b.supplierId, billNo, b.date, total, b.mode||'credit', status,
       JSON.stringify(items), b.gstEnabled||0, b.refBillNo||'', b.vehicleNo||'', b.receiver||'', b.notes||'',
       b.docLabel||'PURCHASE INVOICE', b.upiAccountId||null]
    );
    const row = await queryOne('SELECT * FROM purchases WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'purchase', entityId: id, companyId: req.companyId, details: { billNo } });
    res.status(201).json(mapPurchase(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const b = req.body;
    const existing = await queryOne('SELECT * FROM purchases WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const items = b.items || JSON.parse(existing.items_json || '[]');
    const total = b.total ?? items.reduce((s, i) => s + (i.lt || i.qty * i.price || 0), 0);
    await run(
      `UPDATE purchases SET bill_no=?,supplier_id=?,date=?,total=?,mode=?,items_json=?,gst_enabled=?,ref_bill_no=?,vehicle_no=?,receiver=?,notes=?,doc_label=?,upi_account_id=? WHERE id=?`,
      [b.billNo??existing.bill_no, b.supplierId||existing.supplier_id, b.date||existing.date, total, b.mode||existing.mode,
       JSON.stringify(items), b.gstEnabled??existing.gst_enabled, b.refBillNo??existing.ref_bill_no,
       b.vehicleNo??existing.vehicle_no, b.receiver??existing.receiver, b.notes??existing.notes,
       b.docLabel??existing.doc_label??'PURCHASE INVOICE', b.upiAccountId??existing.upi_account_id, id]
    );
    const row = await queryOne('SELECT * FROM purchases WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'purchase', entityId: id, companyId: existing.company_id, details: { billNo: row.bill_no } });
    res.json(mapPurchase(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/confirm', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM purchases WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Only draft purchases can be confirmed' });
    let billNo;
    if (existing.bill_no && existing.bill_no.trim()) {
      billNo = existing.bill_no;
      await bumpSupplierForManual(existing.supplier_id, billNo, existing.date);
    } else {
      billNo = await assignPurchaseNumberFromSupplier(existing.supplier_id, existing.date);
    }
    await run(
      `UPDATE purchases SET status='confirmed', bill_no=?, confirmed_at=datetime('now') WHERE id=?`,
      [billNo, id]
    );
    const row = await queryOne('SELECT * FROM purchases WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CONFIRM', entityType: 'purchase', entityId: id, companyId: existing.company_id, details: { billNo } });
    res.json(mapPurchase(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM purchases WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run(`UPDATE purchases SET status='cancelled' WHERE id=?`, [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CANCEL', entityType: 'purchase', entityId: id, companyId: existing.company_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM purchases WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE purchases SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'purchase', entityId: id, companyId: existing.company_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
