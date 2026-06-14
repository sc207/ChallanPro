const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { queryAll, queryOne, run } = require('../db/connection');
const { mapCompany } = require('../utils/mappers');
const { logAudit } = require('../services/audit');
const { previewNextBillNo } = require('../services/billNumber');
const { requireRole } = require('../middleware/auth');
const config = require('../config');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(config.uploadsDir, 'logos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${req.params.id}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 } });

router.get('/', async (req, res) => {
  try {
    const rows = await queryAll('SELECT * FROM companies WHERE is_deleted = 0 ORDER BY id');
    res.json(rows.map(mapCompany));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id/next-bill-no', async (req, res) => {
  try {
    const billNo = await previewNextBillNo(parseInt(req.params.id, 10));
    res.json({ billNo });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const b = req.body;
    const maxRow = await queryOne('SELECT MAX(id) as m FROM companies');
    const newId = (maxRow?.m || 0) + 1;
    await run(
      `INSERT INTO companies (id,name,tagline,address,city,state,pincode,mobile,email,gstin,website,
        primary_color,secondary_color,footer_text,authorized_signatory,bank,financial_year,next_bill_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [newId, b.name, b.tagline||'', b.address||'', b.city||'', b.state||'', b.pincode||'',
       b.mobile||b.phone||'', b.email||'', b.gstin||b.gst||'', b.website||'',
       b.primaryColor||'#0f172a', b.secondaryColor||'#1d4ed8', b.footerText||'',
       b.authorizedSignatory||b.proprietor||'', b.bank||'', b.financialYear||b.billPrefix||'2526', 1]
    );
    const row = await queryOne('SELECT * FROM companies WHERE id = ?', [newId]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE', entityType: 'company', entityId: String(newId), companyId: newId, details: { name: b.name } });
    res.status(201).json(mapCompany(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body;
    await run(
      `UPDATE companies SET name=?,tagline=?,address=?,city=?,state=?,pincode=?,mobile=?,email=?,gstin=?,
        website=?,primary_color=?,secondary_color=?,footer_text=?,authorized_signatory=?,bank=?,
        financial_year=?,next_bill_number=COALESCE(?,next_bill_number) WHERE id=?`,
      [b.name, b.tagline||'', b.address||'', b.city||'', b.state||'', b.pincode||'',
       b.mobile||b.phone||'', b.email||'', b.gstin||b.gst||'', b.website||'',
       b.primaryColor||'#0f172a', b.secondaryColor||'#1d4ed8', b.footerText||'',
       b.authorizedSignatory||b.proprietor||'', b.bank||'',
       b.financialYear||b.billPrefix||'2526', b.nextBillNumber||null, id]
    );
    const row = await queryOne('SELECT * FROM companies WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE', entityType: 'company', entityId: String(id), companyId: id, details: { name: b.name } });
    res.json(mapCompany(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/logo', requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    const id = req.params.id;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const logoPath = `/uploads/logos/${req.file.filename}`;
    await run('UPDATE companies SET logo_path = ? WHERE id = ?', [logoPath, id]);
    const row = await queryOne('SELECT * FROM companies WHERE id = ?', [id]);
    res.json(mapCompany(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await run('UPDATE companies SET is_deleted = 1 WHERE id = ?', [id]);
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'SOFT_DELETE', entityType: 'company', entityId: String(id), companyId: id });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
