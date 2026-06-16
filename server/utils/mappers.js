function mapCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    pincode: row.pincode || '',
    mobile: row.mobile || '',
    mobile2: row.mobile2 || '',
    email: row.email || '',
    gstin: row.gstin || '',
    website: row.website || '',
    logoPath: row.logo_path || '',
    primaryColor: row.primary_color || '#0f172a',
    secondaryColor: row.secondary_color || '#1d4ed8',
    footerText: row.footer_text || '',
    authorizedSignatory: row.authorized_signatory || '',
    bank: row.bank || '',
    financialYear: row.financial_year || '2526',
    nextBillNumber: row.next_bill_number || 1,
    // legacy aliases for frontend compat
    phone: row.mobile || '',
    phone2: row.mobile2 || '',
    gst: row.gstin || '',
    proprietor: row.authorized_signatory || '',
    billPrefix: row.financial_year || '2526',
    logo: row.logo_path || '',
  };
}

function mapClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    address: row.address || '',
    phone: row.phone || '',
    email: row.email || '',
    gst: row.gstin || '',
    gstin: row.gstin || '',
    lastAsked: row.last_asked || null,
  };
}

function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    desc: row.description || '',
    description: row.description || '',
    size: row.size || '',
    unit: row.unit || 'meter',
    price: row.price || 0,
  };
}

function mapChallan(row) {
  if (!row) return null;
  let items = [];
  try { items = JSON.parse(row.items_json || '[]'); } catch (_) {}
  return {
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    billNo: row.bill_no || '',
    date: row.date,
    total: row.total || 0,
    mode: row.mode || 'credit',
    status: row.status || 'draft',
    items,
    gstEnabled: row.gst_enabled || 0,
    refBillNo: row.ref_bill_no || '',
    vehicleNo: row.vehicle_no || '',
    receiver: row.receiver || '',
    notes: row.notes || '',
    confirmedAt: row.confirmed_at || null,
  };
}

function mapPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    clientId: row.client_id,
    amount: row.amount,
    mode: row.mode || 'cash',
    date: row.date,
    note: row.note || '',
  };
}

function requireCompanyId(req, res, next) {
  const companyId = parseInt(req.query.companyId || req.body.companyId || req.body.company_id, 10);
  if (!companyId || isNaN(companyId)) {
    return res.status(400).json({ error: 'companyId is required' });
  }
  req.companyId = companyId;
  next();
}

module.exports = { mapCompany, mapClient, mapProduct, mapChallan, mapPayment, requireCompanyId };
