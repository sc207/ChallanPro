require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getDb, run, queryOne } = require('./connection');

async function migrateSchema() {
  const db = await getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await run(stmt);
  }
  console.log('Schema migrated.');
}

async function seed() {
  const count = await queryOne('SELECT COUNT(*) as c FROM companies');
  if (count && count.c > 0) {
    console.log('Database already seeded, skipping.');
    return;
  }

  await run(
    `INSERT INTO companies (id,name,tagline,address,city,state,mobile,email,gstin,authorized_signatory,bank,financial_year,next_bill_number,primary_color,secondary_color)
     VALUES (1,'Demo Textiles Pvt Ltd','Textile Merchant','Shop 15, Textile Market, Ring Road, Surat','Surat','Gujarat','98765 00000','demo@textiles.com','24AABCD0000A1Z5','Sunny C.','HDFC Bank — A/c 50100123456789','2526',34,'#0f172a','#1d4ed8')`
  );

  const clients = [
    [1,'Rajesh Kumar Textiles','Station Road, Surat, GJ','98765 43210','rajesh@rktextiles.com','24AABRC5567F1Z5','2026-05-10'],
    [1,'M/s Patel & Sons','CG Road, Ahmedabad, GJ','98234 56789','patel@patelsons.com','24AABPS3345F1Z5','2026-05-08'],
    [1,'Krishna Fabrics Pvt Ltd','Dadar West, Mumbai, MH','98123 45678','info@krishnafabrics.com','27AABKF2234F1Z5','2026-05-05'],
    [1,'Anand Trading Co.','Sayajigunj, Vadodara, GJ','98456 78901','anand@anandtrading.com','24AABAT4456F1Z5',null],
    [1,'Shree Bhavani Traders','Kalavad Road, Rajkot, GJ','98678 90123','bhavani@traders.com','24AABSB6678F1Z5','2026-04-28'],
    [1,'Modern Garments','Udhna, Surat, GJ','98345 67012','modern@garments.com','24AABMG7789F1Z5',null],
  ];
  for (const c of clients) {
    await run('INSERT INTO clients (company_id,name,address,phone,email,gstin,last_asked) VALUES (?,?,?,?,?,?,?)', c);
  }

  const products = [
    ['Cotton Fabric','Premium cotton plain weave','44"','meter',250],
    ['Polyester Fabric','Synthetic polyester blend','60"','meter',150],
    ['Silk Fabric','Pure mulberry silk','36"','meter',850],
    ['Rayon Fabric','Viscose rayon soft finish','58"','meter',180],
    ['Denim Fabric','Heavy denim 10oz','54"','meter',320],
    ['Georgette','Light chiffon georgette','44"','meter',300],
    ['Velvet','Stretch velvet premium','60"','meter',480],
    ['Linen','Irish linen blend','44"','meter',420],
    ['Cotton T-Shirts','Round neck plain t-shirts','M/L','piece',95],
    ['Polo Shirts','Pique polo collared shirts','M/L','piece',145],
  ];
  for (const p of products) {
    await run('INSERT INTO products (company_id,name,description,size,unit,price) VALUES (1,?,?,?,?,?)', p);
  }

  // Seed challans from original demo (subset + key ones)
  const challans = require('./seed-data');
  for (const ch of challans.challans) {
    await run(
      `INSERT INTO challans (id,company_id,client_id,bill_no,date,total,mode,status,items_json,vehicle_no,receiver,notes,confirmed_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
      [ch.id, 1, ch.clientId, ch.billNo, ch.date, ch.total, ch.mode, 'confirmed', JSON.stringify(ch.items), ch.vehicleNo||'', ch.receiver||'', ch.notes||'']
    );
  }
  for (const p of challans.payments) {
    await run(
      'INSERT INTO payments (id,company_id,client_id,amount,mode,date,note) VALUES (?,?,?,?,?,?,?)',
      [p.id, 1, p.clientId, p.amount, p.mode, p.date, p.note||'']
    );
  }

  await run("INSERT INTO app_settings (key,value) VALUES ('active_company_id','1')");
  console.log('Seed data inserted.');
}

async function main() {
  await migrateSchema();
  if (process.argv.includes('--seed')) await seed();
  process.exit(0);
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { migrateSchema, seed };
