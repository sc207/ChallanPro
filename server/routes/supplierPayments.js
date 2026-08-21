const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapSupplierPayment, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');

const router = express.Router();

function uid() {
  return 'sp' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM supplier_payments WHERE company_id = ? AND is_deleted = 0 ORDER BY date DESC',
      [req.companyId]
    );
    res.json(rows.map(mapSupplierPayment));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    const id = b.id || uid();
    await run(
      'INSERT INTO supplier_payments (id,company_id,supplier_id,amount,mode,date,note,upi_account_id) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.companyId, b.supplierId, b.amount, b.mode||'cash', b.date, b.note||'', b.upiAccountId||null]
    );
    const row = await queryOne('SELECT * FROM supplier_payments WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'supplierPayment', entityId: id, companyId: req.companyId, details: { amount: b.amount } });
    res.status(201).json(mapSupplierPayment(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await queryOne('SELECT * FROM supplier_payments WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE supplier_payments SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'supplierPayment', entityId: id, companyId: existing.company_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
