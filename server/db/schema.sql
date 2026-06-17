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
  last_asked TEXT,
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

CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_challans_company ON challans(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_challans_status ON challans(company_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_company ON audit_logs(company_id);
