const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const { authRequired } = require('./middleware/auth');

/* -------------------- FAIL-FAST: STRONG JWT SECRET IN PROD -------------------- */
if (config.isProd && (!process.env.JWT_SECRET || config.jwtSecret === 'dev-secret-change-in-production')) {
  console.error('FATAL: JWT_SECRET must be set to a strong, unique value in production.');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const clientsRoutes = require('./routes/clients');
const productsRoutes = require('./routes/products');
const challansRoutes = require('./routes/challans');
const paymentsRoutes = require('./routes/payments');
const usersRoutes = require('./routes/users');
const activityRoutes = require('./routes/activity');
const settingsRoutes = require('./routes/settings');
const dcSeriesRoutes = require('./routes/dcSeries');
const suppliersRoutes = require('./routes/suppliers');
const purchasesRoutes = require('./routes/purchases');
const supplierPaymentsRoutes = require('./routes/supplierPayments');
const upiAccountsRoutes = require('./routes/upiAccounts');
const sessionsRoutes = require('./routes/sessions');

const app = express();

app.set('trust proxy', 1);
/* -------------------- SECURITY MIDDLEWARE -------------------- */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // The SPA relies on inline <script>, inline onclick= handlers and inline style= attributes,
      // so 'unsafe-inline' is required on both the *-src and *-src-attr directives. Helmet's default
      // script-src-attr is 'none' (blocks onclick=), which is why it must be overridden explicitly.
      // Tighten these once inline handlers are moved to addEventListener.
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
      styleSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

/* CORS: allow only trusted origins in production (comma-separated ALLOWED_ORIGINS);
   with none configured (local dev) requests are allowed. */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));


app.use(cookieParser());

/* -------------------- RATE LIMITING -------------------- */
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many OTP requests' }
});

app.use('/api/auth/request-setup-otp', otpLimiter);

/* -------------------- HEALTH CHECK (RENDER) -------------------- */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/* -------------------- FILE UPLOAD SETUP (SAFE) -------------------- */
const uploadDir = config.uploadsDir || 'uploads';

fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.join(uploadDir, 'logos'), { recursive: true });

app.use('/uploads', express.static(uploadDir));

/* -------------------- ROUTES -------------------- */
app.use('/api/auth', authRoutes);

/* Protected routes */
app.use('/api', authRequired);

app.use('/api/companies', companiesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/challans', challansRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/dc-series', dcSeriesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/supplier-payments', supplierPaymentsRoutes);
app.use('/api/upi-accounts', upiAccountsRoutes);
app.use('/api/sessions', sessionsRoutes);

/* -------------------- BACKUP IMPORT -------------------- */
app.post('/api/backup/import', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const data = req.body;
    const { run: dbRun } = require('./db/connection');

    for (const co of (data.companies || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO companies
        (id,name,tagline,address,city,state,mobile,email,gstin,bank,financial_year,authorized_signatory,primary_color,secondary_color)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          co.id,
          co.name,
          co.tagline || '',
          co.address || '',
          co.city || '',
          co.state || '',
          co.mobile || co.phone || '',
          co.email || '',
          co.gstin || co.gst || '',
          co.bank || '',
          co.financialYear || co.billPrefix || '2526',
          co.authorizedSignatory || co.proprietor || '',
          co.primaryColor || '#0f172a',
          co.secondaryColor || '#1d4ed8'
        ]
      );
    }

    for (const cl of (data.clients || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO clients
        (id,company_id,name,address,phone,email,gstin,last_asked,opening_balance,opening_balance_date,chal_prefix,chal_start_number,chal_seq_period,chal_next_number)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          cl.id,
          cl.companyId,
          cl.name,
          cl.address || '',
          cl.phone || '',
          cl.email || '',
          cl.gst || cl.gstin || '',
          cl.lastAsked || null,
          cl.openingBalance || 0,
          cl.openingBalanceDate || null,
          cl.chalPrefix || '',
          cl.chalStartNumber || 1,
          cl.chalSeqPeriod || '',
          cl.chalNextNumber || 1
        ]
      );
    }

    for (const pr of (data.products || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO products
        (id,company_id,name,description,size,unit,price)
        VALUES (?,?,?,?,?,?,?)`,
        [
          pr.id,
          pr.companyId || 1,
          pr.name,
          pr.desc || '',
          pr.size || '',
          pr.unit || 'meter',
          pr.price || 0
        ]
      );
    }

    for (const s of (data.dcSeries || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO dc_series
        (id,company_id,name,prefix,next_number,series_type,start_number,seq_period)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
          s.id,
          s.companyId || 1,
          s.name || 'Default',
          s.prefix || '',
          s.nextNumber || 1,
          s.seriesType || 'normal',
          s.startNumber || 1,
          s.seqPeriod || ''
        ]
      );
    }

    for (const ch of (data.challans || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO challans
        (id,company_id,client_id,bill_no,date,total,mode,status,items_json,vehicle_no,receiver,notes,gst_enabled,ref_bill_no,series_id,show_dc_no,challan_label,upi_account_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          ch.id,
          ch.companyId || 1,
          ch.clientId,
          ch.billNo || '',
          ch.date,
          ch.total,
          ch.mode || 'credit',
          ch.status || 'confirmed',
          JSON.stringify(ch.items || []),
          ch.vehicleNo || '',
          ch.receiver || '',
          ch.notes || '',
          ch.gstEnabled || 0,
          ch.refBillNo || '',
          ch.seriesId || null,
          ch.showDcNo == null ? 1 : ch.showDcNo,
          ch.challanLabel || 'DELIVERY CHALLAN',
          ch.upiAccountId || null
        ]
      );
    }

    for (const p of (data.payments || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO payments
        (id,company_id,client_id,amount,mode,date,note,upi_account_id)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
          p.id,
          p.companyId || 1,
          p.clientId,
          p.amount,
          p.mode || 'cash',
          p.date,
          p.note || '',
          p.upiAccountId || null
        ]
      );
    }

    for (const s of (data.suppliers || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO suppliers
        (id,company_id,name,address,phone,email,gstin,opening_balance,opening_balance_date,last_asked,pur_prefix,pur_start_number,pur_seq_period,pur_next_number)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          s.id, s.companyId || 1, s.name, s.address || '', s.phone || '', s.email || '',
          s.gst || s.gstin || '', s.openingBalance || 0, s.openingBalanceDate || null, s.lastAsked || null,
          s.purPrefix || '', s.purStartNumber || 1, s.purSeqPeriod || '', s.purNextNumber || 1
        ]
      );
    }

    for (const pu of (data.purchases || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO purchases
        (id,company_id,supplier_id,bill_no,date,total,mode,status,items_json,gst_enabled,ref_bill_no,vehicle_no,receiver,notes,doc_label,upi_account_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          pu.id, pu.companyId || 1, pu.supplierId, pu.billNo || '', pu.date, pu.total, pu.mode || 'credit',
          pu.status || 'confirmed', JSON.stringify(pu.items || []), pu.gstEnabled || 0, pu.refBillNo || '',
          pu.vehicleNo || '', pu.receiver || '', pu.notes || '', pu.docLabel || 'PURCHASE INVOICE', pu.upiAccountId || null
        ]
      );
    }

    for (const sp of (data.supplierPayments || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO supplier_payments
        (id,company_id,supplier_id,amount,mode,date,note,upi_account_id)
        VALUES (?,?,?,?,?,?,?,?)`,
        [
          sp.id, sp.companyId || 1, sp.supplierId, sp.amount, sp.mode || 'cash', sp.date, sp.note || '', sp.upiAccountId || null
        ]
      );
    }

    for (const u of (data.upiAccounts || [])) {
      await dbRun(
        `INSERT OR REPLACE INTO upi_accounts
        (id,company_id,name,opening_balance)
        VALUES (?,?,?,?)`,
        [u.id, u.companyId || 1, u.name, u.openingBalance || 0]
      );
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------- BACKUP EXPORT -------------------- */
app.get('/api/backup/export', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }

    const { queryAll } = require('./db/connection');
    const { mapCompany, mapClient, mapProduct, mapChallan, mapPayment, mapDcSeries, mapSupplier, mapPurchase, mapSupplierPayment, mapUpiAccount } = require('./utils/mappers');

    const data = {
      companies: (await queryAll('SELECT * FROM companies WHERE is_deleted=0')).map(mapCompany),
      clients: (await queryAll('SELECT * FROM clients WHERE is_deleted=0')).map(mapClient),
      products: (await queryAll('SELECT * FROM products WHERE is_deleted=0')).map(mapProduct),
      challans: (await queryAll('SELECT * FROM challans WHERE is_deleted=0')).map(mapChallan),
      payments: (await queryAll('SELECT * FROM payments WHERE is_deleted=0')).map(mapPayment),
      dcSeries: (await queryAll('SELECT * FROM dc_series WHERE is_deleted=0')).map(mapDcSeries),
      suppliers: (await queryAll('SELECT * FROM suppliers WHERE is_deleted=0')).map(mapSupplier),
      purchases: (await queryAll('SELECT * FROM purchases WHERE is_deleted=0')).map(mapPurchase),
      supplierPayments: (await queryAll('SELECT * FROM supplier_payments WHERE is_deleted=0')).map(mapSupplierPayment),
      upiAccounts: (await queryAll('SELECT * FROM upi_accounts WHERE is_deleted=0')).map(mapUpiAccount),
      auditLogs: await queryAll('SELECT id,user_email,action,entity_type,entity_id,company_id,details_json,created_at FROM audit_logs ORDER BY id DESC LIMIT 10000'),
      exportedAt: new Date().toISOString(),
    };

    const filename = 'challanpro-backup-' + new Date().toISOString().slice(0,10) + '.json';
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------- WIPE ALL DATA -------------------- */
app.delete('/api/backup/wipe', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const { run: dbRun } = require('./db/connection');
    await dbRun('DELETE FROM audit_logs');
    await dbRun('DELETE FROM payments');
    await dbRun('DELETE FROM challans');
    await dbRun('DELETE FROM clients');
    await dbRun('DELETE FROM products');
    await dbRun('DELETE FROM supplier_payments');
    await dbRun('DELETE FROM purchases');
    await dbRun('DELETE FROM suppliers');
    await dbRun('DELETE FROM upi_accounts');
    await dbRun('UPDATE companies SET next_bill_number = 1');
    // Reset DC-series counters so numbering restarts cleanly (definitions are kept)
    await dbRun("UPDATE dc_series SET next_number = start_number, seq_period = ''");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* -------------------- STATIC FRONTEND -------------------- */
app.use(express.static(path.join(__dirname, '../public')));

app.get('/login', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/login.html'))
);

app.get('/login.html', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/login.html'))
);

/* -------------------- FRONTEND ROUTE FALLBACK -------------------- */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }

  res.sendFile(path.join(__dirname, '../public/index.html'));
});

/* -------------------- GLOBAL ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: config.isProd ? 'Internal server error' : err.message
  });
});

/* -------------------- SERVER START -------------------- */
const start = async () => {
  const { migrateSchema, seed } = require('./db/migrate');

  await migrateSchema();

  const { queryOne } = require('./db/connection');
  const cnt = await queryOne('SELECT COUNT(*) as c FROM companies');

  if (!cnt || cnt.c === 0) {
    await seed();
  }

  const PORT = process.env.PORT || config.port || 3000;

  app.listen(PORT, () => {
    console.log(`ChallanPro running on port ${PORT}`);
  });
};

start();