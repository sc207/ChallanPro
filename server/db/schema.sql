CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  pincode TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  mobile2 TEXT DEFAULT '',
  email TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  website TEXT DEFAULT '',
  logo_path TEXT DEFAULT '',
  primary_color TEXT DEFAULT '#0f172a',
  secondary_color TEXT DEFAULT '#1d4ed8',
  footer_text TEXT DEFAULT '',
  authorized_signatory TEXT DEFAULT '',
  bank TEXT DEFAULT '',
  financial_year TEXT DEFAULT '2526',
  next_bill_number INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dc_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL DEFAULT 'Default',
  prefix TEXT DEFAULT '',
  next_number INTEGER DEFAULT 1,
  series_type TEXT DEFAULT 'normal',
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS clients (
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
  chal_prefix TEXT DEFAULT '',
  chal_start_number INTEGER DEFAULT 1,
  chal_seq_period TEXT DEFAULT '',
  chal_next_number INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  size TEXT DEFAULT '',
  unit TEXT DEFAULT 'meter',
  price REAL DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS challans (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  client_id INTEGER NOT NULL,
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
  challan_label TEXT DEFAULT 'DELIVERY CHALLAN',
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  client_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  mode TEXT DEFAULT 'cash',
  date TEXT NOT NULL,
  note TEXT DEFAULT '',
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

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

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'staff',
  active INTEGER DEFAULT 1,
  totp_secret TEXT,
  totp_enabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);


CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  company_id INTEGER,
  details_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

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

CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_challans_company ON challans(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_challans_status ON challans(company_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(company_id, status);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_company ON supplier_payments(company_id);
CREATE INDEX IF NOT EXISTS idx_upi_accounts_company ON upi_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
