const { queryOne, run } = require('../db/connection');

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function periodOf(dateStr) { return (dateStr || '').slice(0, 7); }        // YYYY-MM
function monOf(dateStr) { const m = parseInt((dateStr || '').slice(5, 7), 10) || 1; return MONTHS[Math.min(11, Math.max(0, m - 1))]; }
function pad2(n) { return String(n).padStart(2, '0'); }

// Build a PREFIX/MON/NN number (empty prefix -> MON/NN). Prefix trailing slashes are stripped.
function formatSeriesNo(prefix, dateStr, counter) {
  const pfx = String(prefix || '').replace(/\/+$/, '');
  const parts = [];
  if (pfx) parts.push(pfx);
  parts.push(monOf(dateStr));
  parts.push(pad2(counter));
  return parts.join('/');
}

// Parse the trailing numeric segment of a manually-entered number (AP/JUL/05 -> 5)
function parseTrailingNum(billNo) {
  const parts = String(billNo || '').split('/');
  return parseInt(parts[parts.length - 1], 10) || 0;
}

/* -------------------- DEFAULT COMPANY SERIES (legacy, unchanged) -------------------- */
async function previewNextBillNo(companyId) {
  const co = await queryOne(
    'SELECT financial_year, next_bill_number FROM companies WHERE id = ? AND is_deleted = 0',
    [companyId]
  );
  if (!co) throw new Error('Company not found');
  const num = String(co.next_bill_number).padStart(3, '0');
  return `${co.financial_year}/${num}`;
}

async function assignBillNumber(companyId) {
  const co = await queryOne(
    'SELECT financial_year, next_bill_number FROM companies WHERE id = ? AND is_deleted = 0',
    [companyId]
  );
  if (!co) throw new Error('Company not found');
  const billNo = `${co.financial_year}/${String(co.next_bill_number).padStart(3, '0')}`;
  await run('UPDATE companies SET next_bill_number = next_bill_number + 1 WHERE id = ?', [companyId]);
  return billNo;
}

/* -------------------- DC SERIES (challans) --------------------
   Only the 'normal' (non-GST) type uses PREFIX/MON/NN with monthly reset.
   'gst' and 'hide' keep the legacy continuous format: prefix + padded number. */
async function assignBillNumberFromSeries(seriesId, dateStr) {
  const s = await queryOne('SELECT * FROM dc_series WHERE id = ? AND is_deleted = 0', [seriesId]);
  if (!s) throw new Error('DC series not found');
  if ((s.series_type || 'normal') === 'normal') {
    const period = periodOf(dateStr);
    const start = s.start_number || 1;
    const counter = (s.seq_period === period) ? (s.next_number || start) : start;
    const billNo = formatSeriesNo(s.prefix, dateStr, counter);
    await run('UPDATE dc_series SET seq_period = ?, next_number = ? WHERE id = ?', [period, counter + 1, seriesId]);
    return billNo;
  }
  // gst / hide → legacy: prefix + padded running number (continuous, no month reset)
  const counter = s.next_number || s.start_number || 1;
  const billNo = (s.prefix || '') + String(counter).padStart(3, '0');
  await run('UPDATE dc_series SET next_number = ? WHERE id = ?', [counter + 1, seriesId]);
  return billNo;
}

// When a challan is confirmed with a manually/auto entered number, advance the series counter to match.
async function bumpSeriesForManual(seriesId, billNo, dateStr) {
  const s = await queryOne('SELECT * FROM dc_series WHERE id = ? AND is_deleted = 0', [seriesId]);
  if (!s) return;
  if ((s.series_type || 'normal') === 'normal') {
    const period = periodOf(dateStr);
    const num = parseTrailingNum(billNo);
    const start = s.start_number || 1;
    const curNext = (s.seq_period === period) ? (s.next_number || start) : start;
    if (s.seq_period !== period || num >= curNext) {
      await run('UPDATE dc_series SET seq_period = ?, next_number = ? WHERE id = ?', [period, num + 1, seriesId]);
    }
    return;
  }
  // gst / hide → legacy continuous: strip prefix, compare the plain number
  const pfx = s.prefix || '';
  const numStr = billNo.startsWith(pfx) ? billNo.slice(pfx.length) : billNo;
  const num = parseInt(numStr, 10) || 0;
  if (num >= (s.next_number || 1)) {
    await run('UPDATE dc_series SET next_number = ? WHERE id = ?', [num + 1, seriesId]);
  }
}

/* -------------------- SUPPLIER SERIES (purchases) — PREFIX/MON/NN, monthly reset -------------------- */
async function assignPurchaseNumberFromSupplier(supplierId, dateStr) {
  const s = await queryOne('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0', [supplierId]);
  if (!s) throw new Error('Supplier not found');
  const period = periodOf(dateStr);
  const start = s.pur_start_number || 1;
  const counter = (s.pur_seq_period === period) ? (s.pur_next_number || start) : start;
  const billNo = formatSeriesNo(s.pur_prefix, dateStr, counter);
  await run('UPDATE suppliers SET pur_seq_period = ?, pur_next_number = ? WHERE id = ?', [period, counter + 1, supplierId]);
  return billNo;
}

async function bumpSupplierForManual(supplierId, billNo, dateStr) {
  const s = await queryOne('SELECT * FROM suppliers WHERE id = ? AND is_deleted = 0', [supplierId]);
  if (!s) return;
  const period = periodOf(dateStr);
  const num = parseTrailingNum(billNo);
  const start = s.pur_start_number || 1;
  const curNext = (s.pur_seq_period === period) ? (s.pur_next_number || start) : start;
  if (s.pur_seq_period !== period || num >= curNext) {
    await run('UPDATE suppliers SET pur_seq_period = ?, pur_next_number = ? WHERE id = ?', [period, num + 1, supplierId]);
  }
}

/* -------------------- CLIENT SERIES (non-GST challans) — PREFIX/MON/NN, monthly reset -------------------- */
async function assignBillNumberFromClient(clientId, dateStr) {
  const c = await queryOne('SELECT * FROM clients WHERE id = ? AND is_deleted = 0', [clientId]);
  if (!c) throw new Error('Client not found');
  const period = periodOf(dateStr);
  const start = c.chal_start_number || 1;
  const counter = (c.chal_seq_period === period) ? (c.chal_next_number || start) : start;
  const billNo = formatSeriesNo(c.chal_prefix, dateStr, counter);
  await run('UPDATE clients SET chal_seq_period = ?, chal_next_number = ? WHERE id = ?', [period, counter + 1, clientId]);
  return billNo;
}

async function bumpClientForManual(clientId, billNo, dateStr) {
  const c = await queryOne('SELECT * FROM clients WHERE id = ? AND is_deleted = 0', [clientId]);
  if (!c) return;
  const period = periodOf(dateStr);
  const num = parseTrailingNum(billNo);
  const start = c.chal_start_number || 1;
  const curNext = (c.chal_seq_period === period) ? (c.chal_next_number || start) : start;
  if (c.chal_seq_period !== period || num >= curNext) {
    await run('UPDATE clients SET chal_seq_period = ?, chal_next_number = ? WHERE id = ?', [period, num + 1, clientId]);
  }
}

module.exports = {
  previewNextBillNo,
  assignBillNumber,
  assignBillNumberFromSeries,
  bumpSeriesForManual,
  assignPurchaseNumberFromSupplier,
  bumpSupplierForManual,
  assignBillNumberFromClient,
  bumpClientForManual,
  formatSeriesNo,
  monOf,
  periodOf,
};
