require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getDb, run, queryOne } = require('./connection');

/* -------------------- SCHEMA MIGRATION -------------------- */
async function migrateSchema() {
  const db = await getDb();

  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf8'
  );

  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await run(stmt);
  }

  console.log('Schema migrated.');

  // Safe-add new columns to existing databases (throws if already present — ignore)
  const safeAlter = [
    `ALTER TABLE companies ADD COLUMN mobile2 TEXT DEFAULT ''`,
    `ALTER TABLE challans ADD COLUMN gst_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE challans ADD COLUMN ref_bill_no TEXT DEFAULT ''`,
  ];
  for (const sql of safeAlter) {
    try { await run(sql); } catch (_) {}
  }
}

/* -------------------- CLEAN SEED (ONLY YOUR COMPANY) -------------------- */
async function seed() {
  const count = await queryOne('SELECT COUNT(*) as c FROM companies');

  if (count && count.c > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  // ✅ ONLY ONE COMPANY (Riddhi Steel)
  await run(
    `INSERT INTO companies 
    (id, name, tagline, address, city, state, mobile, email, gstin, authorized_signatory, bank, financial_year, next_bill_number, primary_color, secondary_color)
    VALUES 
    (1, 'Riddhi Steel', '', 
    'O/S. Delhi Gate, Dudheshwer Road, Ahmedabad-380004, Gujarat, India', 
    'Ahmedabad', 'Gujarat', 
    '+91 98256 89211', 
    '', 
    '', 
    'Karan Chauhan', 
    '', 
    '2526', 
    1, 
    '#0f172a', 
    '#1d4ed8')`
  );

  // ❌ NO clients
  // ❌ NO products
  // ❌ NO challans
  // ❌ NO payments

  console.log('Clean seed completed: only company inserted.');
}

/* -------------------- MAIN -------------------- */
async function main() {
  await migrateSchema();

  if (process.argv.includes('--seed')) {
    await seed();
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { migrateSchema, seed };