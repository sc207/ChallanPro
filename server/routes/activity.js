const express = require('express');
const { queryAll } = require('../db/connection');
const { formatActivity } = require('../services/audit');
const { requireCompanyId } = require('../utils/mappers');

const router = express.Router();

router.get('/', requireCompanyId, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const rows = await queryAll(
      `SELECT * FROM audit_logs WHERE company_id = ? OR company_id IS NULL
       ORDER BY created_at DESC LIMIT ?`,
      [req.companyId, limit]
    );
    res.json(rows.map(formatActivity));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
