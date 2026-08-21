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
    openingBalance: row.opening_balance || 0,
    openingBalanceDate: row.opening_balance_date || null,
    lastAsked: row.last_asked || null,
    // per-client challan-number series (non-GST): PREFIX/MON/NN, monthly reset
    chalPrefix: row.chal_prefix || '',
    chalStartNumber: row.chal_start_number || 1,
    chalSeqPeriod: row.chal_seq_period || '',
    chalNextNumber: row.chal_next_number || 1,
  };
}

function mapSupplier(row) {
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
    openingBalance: row.opening_balance || 0,
    openingBalanceDate: row.opening_balance_date || null,
    lastAsked: row.last_asked || null,
    // per-supplier purchase-number series (PREFIX/MON/NN, monthly reset)
    purPrefix: row.pur_prefix || '',
    purStartNumber: row.pur_start_number || 1,
    purSeqPeriod: row.pur_seq_period || '',
    purNextNumber: row.pur_next_number || 1,
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
    seriesId: row.series_id || null,
    showDcNo: row.show_dc_no === undefined || row.show_dc_no === null ? 1 : row.show_dc_no,
    challanLabel: row.challan_label || 'DELIVERY CHALLAN',
    upiAccountId: row.upi_account_id || null,
    confirmedAt: row.confirmed_at || null,
  };
}

function mapPurchase(row) {
  if (!row) return null;
  let items = [];
  try { items = JSON.parse(row.items_json || '[]'); } catch (_) {}
  return {
    id: row.id,
    companyId: row.company_id,
    supplierId: row.supplier_id,
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
    docLabel: row.doc_label || 'PURCHASE INVOICE',
    upiAccountId: row.upi_account_id || null,
    confirmedAt: row.confirmed_at || null,
  };
}

function mapDcSeries(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name || 'Default',
    prefix: row.prefix || '',
    nextNumber: row.next_number || 1,
    seriesType: row.series_type || 'normal',
    startNumber: row.start_number || 1,
    seqPeriod: row.seq_period || '',
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
    upiAccountId: row.upi_account_id || null,
  };
}

function mapSupplierPayment(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    supplierId: row.supplier_id,
    amount: row.amount,
    mode: row.mode || 'cash',
    date: row.date,
    note: row.note || '',
    upiAccountId: row.upi_account_id || null,
  };
}

function mapUpiAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    openingBalance: row.opening_balance || 0,
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

module.exports = { mapCompany, mapClient, mapSupplier, mapProduct, mapChallan, mapPurchase, mapPayment, mapSupplierPayment, mapDcSeries, mapUpiAccount, requireCompanyId };
