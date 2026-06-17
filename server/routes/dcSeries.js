const express = require('express');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapDcSeries, requireCompanyId } = require('../utils/mappers');

const router = express.Router();

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT * FROM dc_series WHERE company_id = ? AND is_deleted = 0 ORDER BY id',
      [req.companyId]
    );
    res.json(rows.map(mapDcSeries));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireCompanyId, async (req, res) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ error: 'Name is required' });
    const result = await run(
      'INSERT INTO dc_series (company_id, name, prefix, next_number, series_type) VALUES (?,?,?,?,?)',
      [req.companyId, b.name, b.prefix || '', b.nextNumber || 1, b.seriesType || 'normal']
    );
    const row = await queryOne('SELECT * FROM dc_series WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(mapDcSeries(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    const existing = await queryOne('SELECT * FROM dc_series WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run(
      'UPDATE dc_series SET name=?, prefix=?, next_number=?, series_type=? WHERE id=?',
      [b.name || existing.name, b.prefix ?? existing.prefix, b.nextNumber ?? existing.next_number, b.seriesType || existing.series_type || 'normal', id]
    );
    const row = await queryOne('SELECT * FROM dc_series WHERE id = ?', [id]);
    res.json(mapDcSeries(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await queryOne('SELECT * FROM dc_series WHERE id = ? AND is_deleted = 0', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await run('UPDATE dc_series SET is_deleted = 1 WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
