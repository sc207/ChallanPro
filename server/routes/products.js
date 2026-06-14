const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapProduct, requireCompanyId } = require('../utils/mappers');
const { logAudit } = require('../services/audit');

const router = express.Router();

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM products WHERE company_id = ? AND is_deleted = 0 ORDER BY name',
      [req.companyId]
    );
    res.json(rows.map(mapProduct));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO products (company_id,name,description,size,unit,price) VALUES (?,?,?,?,?,?)',
      [req.companyId, b.name, b.desc||b.description||'', b.size||'', b.unit||'meter', b.price||0]
    );
    const id = result.lastInsertRowid;
    const row = await queryOne('SELECT * FROM products WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'product', entityId: String(id), companyId: req.companyId, details: { name: b.name } });
    res.status(201).json(mapProduct(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const existing = await queryOne('SELECT * FROM products WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run(
      'UPDATE products SET name=?,description=?,size=?,unit=?,price=? WHERE id=?',
      [b.name, b.desc||b.description||'', b.size||'', b.unit||'meter', b.price||0, id]
    );
    const row = await queryOne('SELECT * FROM products WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'product', entityId: String(id), companyId: existing.company_id, details: { name: b.name } });
    res.json(mapProduct(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await queryOne('SELECT * FROM products WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE products SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'product', entityId: String(id), companyId: existing.company_id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
