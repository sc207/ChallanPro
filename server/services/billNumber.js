const { queryOne, run } = require('../db/connection');

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

async function assignBillNumberFromSeries(seriesId) {
  const s = await queryOne('SELECT * FROM dc_series WHERE id = ? AND is_deleted = 0', [seriesId]);
  if (!s) throw new Error('DC series not found');
  const billNo = (s.prefix || '') + String(s.next_number).padStart(3, '0');
  await run('UPDATE dc_series SET next_number = next_number + 1 WHERE id = ?', [seriesId]);
  return billNo;
}

module.exports = { previewNextBillNo, assignBillNumber, assignBillNumberFromSeries };
