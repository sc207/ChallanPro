const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { authRequired } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const clientsRoutes = require('./routes/clients');
const productsRoutes = require('./routes/products');
const challansRoutes = require('./routes/challans');
const paymentsRoutes = require('./routes/payments');
const usersRoutes = require('./routes/users');
const activityRoutes = require('./routes/activity');
const settingsRoutes = require('./routes/settings');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many OTP requests' } });
app.use('/api/auth/request-otp', otpLimiter);

fs.mkdirSync(config.uploadsDir, { recursive: true });
fs.mkdirSync(path.join(config.uploadsDir, 'logos'), { recursive: true });
app.use('/uploads', express.static(config.uploadsDir));

app.use('/api/auth', authRoutes);

app.use('/api', authRequired);
app.use('/api/companies', companiesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/challans', challansRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);

app.post('/api/backup/import', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const data = req.body;
    const { run: dbRun } = require('./db/connection');
    // Simplified import — re-insert companies, clients, products, challans, payments
    for (const co of (data.companies || [])) {
      await dbRun(`INSERT OR REPLACE INTO companies (id,name,tagline,address,city,state,mobile,email,gstin,bank,financial_year,authorized_signatory,primary_color,secondary_color)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [co.id, co.name, co.tagline||'', co.address||'', co.city||'', co.state||'', co.mobile||co.phone||'', co.email||'', co.gstin||co.gst||'', co.bank||'', co.financialYear||co.billPrefix||'2526', co.authorizedSignatory||co.proprietor||'', co.primaryColor||'#0f172a', co.secondaryColor||'#1d4ed8']);
    }
    for (const cl of (data.clients || [])) {
      await dbRun('INSERT OR REPLACE INTO clients (id,company_id,name,address,phone,email,gstin,last_asked) VALUES (?,?,?,?,?,?,?,?)',
        [cl.id, cl.companyId, cl.name, cl.address||'', cl.phone||'', cl.email||'', cl.gst||cl.gstin||'', cl.lastAsked||null]);
    }
    for (const pr of (data.products || [])) {
      await dbRun('INSERT OR REPLACE INTO products (id,company_id,name,description,size,unit,price) VALUES (?,?,?,?,?,?,?)',
        [pr.id, pr.companyId||1, pr.name, pr.desc||'', pr.size||'', pr.unit||'meter', pr.price||0]);
    }
    for (const ch of (data.challans || [])) {
      await dbRun(`INSERT OR REPLACE INTO challans (id,company_id,client_id,bill_no,date,total,mode,status,items_json,vehicle_no,receiver,notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ch.id, ch.companyId||1, ch.clientId, ch.billNo||'', ch.date, ch.total, ch.mode||'credit', ch.status||'confirmed', JSON.stringify(ch.items||[]), ch.vehicleNo||'', ch.receiver||'', ch.notes||'']);
    }
    for (const p of (data.payments || [])) {
      await dbRun('INSERT OR REPLACE INTO payments (id,company_id,client_id,amount,mode,date,note) VALUES (?,?,?,?,?,?,?)',
        [p.id, p.companyId||1, p.clientId, p.amount, p.mode||'cash', p.date, p.note||'']);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/backup/export', async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { queryAll } = require('./db/connection');
    const { mapCompany, mapClient, mapProduct, mapChallan, mapPayment } = require('./utils/mappers');
    const data = {
      companies: (await queryAll('SELECT * FROM companies WHERE is_deleted=0')).map(mapCompany),
      clients: (await queryAll('SELECT * FROM clients WHERE is_deleted=0')).map(mapClient),
      products: (await queryAll('SELECT * FROM products WHERE is_deleted=0')).map(mapProduct),
      challans: (await queryAll('SELECT * FROM challans WHERE is_deleted=0')).map(mapChallan),
      payments: (await queryAll('SELECT * FROM payments WHERE is_deleted=0')).map(mapPayment),
      exportedAt: new Date().toISOString(),
    };
    res.setHeader('Content-Disposition', 'attachment; filename=challanpro-backup.json');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '../public/login.html')));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: config.isProd ? 'Internal server error' : err.message });
});

const start = async () => {
  const { migrateSchema, seed } = require('./db/migrate');
  await migrateSchema();
  const { queryOne } = require('./db/connection');
  const cnt = await queryOne('SELECT COUNT(*) as c FROM companies');
  if (!cnt || cnt.c === 0) await seed();
  app.listen(config.port, () => {
    console.log(`ChallanPro running on http://localhost:${config.port}`);
  });
};

start();
