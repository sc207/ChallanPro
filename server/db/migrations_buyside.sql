-- ============================================================
--  ChallanPro — Buy-side migration (Suppliers, Purchases,
--  Supplier Payments, UPI accounts) + monthly-reset numbering
--  Safe to run more than once: CREATE TABLE uses IF NOT EXISTS.
--  The ALTER statements will error "duplicate column" if already
--  applied — that is harmless, ignore those specific errors.
-- ============================================================

-- ---- New tables ----
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  opening_balance REAL DEFAULT 0,
  opening_balance_date TEXT DEFAULT NULL,
  last_asked TEXT,
  pur_prefix TEXT DEFAULT '',
  pur_start_number INTEGER DEFAULT 1,
  pur_seq_period TEXT DEFAULT '',
  pur_next_number INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  supplier_id INTEGER NOT NULL,
  bill_no TEXT DEFAULT '',
  date TEXT NOT NULL,
  total REAL DEFAULT 0,
  mode TEXT DEFAULT 'credit',
  status TEXT DEFAULT 'draft',
  items_json TEXT NOT NULL DEFAULT '[]',
  gst_enabled INTEGER DEFAULT 0,
  ref_bill_no TEXT DEFAULT '',
  vehicle_no TEXT DEFAULT '',
  receiver TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  doc_label TEXT DEFAULT 'PURCHASE INVOICE',
  upi_account_id INTEGER,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  supplier_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  mode TEXT DEFAULT 'cash',
  date TEXT NOT NULL,
  note TEXT DEFAULT '',
  upi_account_id INTEGER,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS upi_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  opening_balance REAL DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ---- Indexes ----
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(company_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_company ON supplier_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_upi_accounts_company ON upi_accounts(company_id);

-- ---- Column additions to existing tables ----
-- (Run these individually; "duplicate column name" errors are safe to ignore.)
ALTER TABLE dc_series ADD COLUMN start_number INTEGER DEFAULT 1;
ALTER TABLE dc_series ADD COLUMN seq_period TEXT DEFAULT '';
ALTER TABLE challans  ADD COLUMN upi_account_id INTEGER;
ALTER TABLE payments  ADD COLUMN upi_account_id INTEGER;

-- ---- Per-client challan number series (non-GST) — PREFIX/MON/NN ----
ALTER TABLE clients ADD COLUMN chal_prefix TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN chal_start_number INTEGER DEFAULT 1;
ALTER TABLE clients ADD COLUMN chal_seq_period TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN chal_next_number INTEGER DEFAULT 1;

-- ---- Login sessions (device list + remote logout) ----
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_email TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  ip TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  last_seen TEXT DEFAULT (datetime('now')),
  revoked INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
