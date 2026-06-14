const express = require('express');
const { queryOne, run } = require('../db/connection');

const router = express.Router();

router.get('/active-company', async (req, res) => {
  try {
    const row = await queryOne("SELECT value FROM app_settings WHERE key = 'active_company_id'");
    res.json({ activeCompanyId: row ? parseInt(row.value, 10) : 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/active-company', async (req, res) => {
  try {
    const id = req.body.activeCompanyId;
    await run(
      "INSERT INTO app_settings (key, value) VALUES ('active_company_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      [String(id)]
    );
    res.json({ activeCompanyId: id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
