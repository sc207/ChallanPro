const TODAY = new Date().toISOString().split('T')[0];
let APP = { companies: [], clients: [], products: [], challans: [], payments: [], dcSeries: [], suppliers: [], purchases: [], supplierPayments: [], upiAccounts: [], activeCompanyId: 1 };
let CURRENT_USER = null;

function getActiveCompany() {
  return APP.companies.find(c => c.id === APP.activeCompanyId) || APP.companies[0];
}
function cClients() { return APP.clients.filter(c => c.companyId === APP.activeCompanyId); }
function cChallans() { return APP.challans.filter(c => c.companyId === APP.activeCompanyId && c.status !== 'cancelled'); }
function cPayments() { return APP.payments.filter(p => p.companyId === APP.activeCompanyId); }
function cProducts() { return APP.products.filter(p => p.companyId === APP.activeCompanyId); }
function cSuppliers() { return APP.suppliers.filter(s => s.companyId === APP.activeCompanyId); }
function cPurchases() { return APP.purchases.filter(p => p.companyId === APP.activeCompanyId && p.status !== 'cancelled'); }
function cSupplierPayments() { return APP.supplierPayments.filter(p => p.companyId === APP.activeCompanyId); }
function cUpiAccounts() { return APP.upiAccounts.filter(u => u.companyId === APP.activeCompanyId); }
function upiAccountName(id) { const u = APP.upiAccounts.find(x => x.id === id); return u ? u.name : ''; }

async function checkAuth() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  const data = await res.json();
  if (!data.user) {
    window.location.href = '/login.html';
    return false;
  }
  CURRENT_USER = data.user;
  return true;
}

async function loadCompanies() {
  APP.companies = await API.get('/companies');
}

async function loadCompanyData(companyId) {
  const cid = companyId || APP.activeCompanyId;
  const [clients, products, challans, payments, dcSeries, suppliers, purchases, supplierPayments, upiAccounts] = await Promise.all([
    API.get('/clients?companyId=' + cid),
    API.get('/products?companyId=' + cid),
    API.get('/challans?companyId=' + cid),
    API.get('/payments?companyId=' + cid),
    API.get('/dc-series?companyId=' + cid),
    API.get('/suppliers?companyId=' + cid),
    API.get('/purchases?companyId=' + cid),
    API.get('/supplier-payments?companyId=' + cid),
    API.get('/upi-accounts?companyId=' + cid),
  ]);
  APP.clients = clients;
  APP.products = products;
  APP.challans = challans.filter(c => c.status !== 'cancelled');
  APP.payments = payments;
  APP.dcSeries = dcSeries;
  APP.suppliers = suppliers;
  APP.purchases = purchases.filter(p => p.status !== 'cancelled');
  APP.supplierPayments = supplierPayments;
  APP.upiAccounts = upiAccounts;
  APP.activeCompanyId = cid;
  clearAllocCache();
}

async function loadStore() {
  await loadCompanies();
  try {
    const s = await API.get('/settings/active-company');
    APP.activeCompanyId = s.activeCompanyId || APP.companies[0]?.id || 1;
  } catch (_) {
    APP.activeCompanyId = APP.companies[0]?.id || 1;
  }
  await loadCompanyData(APP.activeCompanyId);
  applyCompanyTheme(getActiveCompany());
}

function saveStore() { /* no-op: per-resource API saves */ }

async function persistClient(client) {
  if (client.id && APP.clients.find(c => c.id === client.id)) {
    return API.put('/clients/' + client.id, client);
  }
  return API.post('/clients?companyId=' + APP.activeCompanyId, client);
}

async function persistProduct(product) {
  if (product.id && APP.products.find(p => p.id === product.id)) {
    return API.put('/products/' + product.id, product);
  }
  return API.post('/products?companyId=' + APP.activeCompanyId, product);
}

async function persistChallan(challan) {
  if (challan.id && APP.challans.find(c => c.id === challan.id)) {
    return API.put('/challans/' + challan.id, challan);
  }
  return API.post('/challans?companyId=' + APP.activeCompanyId, challan);
}

async function persistPayment(payment) {
  return API.post('/payments?companyId=' + APP.activeCompanyId, payment);
}

async function persistSupplier(supplier) {
  if (supplier.id && APP.suppliers.find(s => s.id === supplier.id)) {
    return API.put('/suppliers/' + supplier.id, supplier);
  }
  return API.post('/suppliers?companyId=' + APP.activeCompanyId, supplier);
}

async function persistPurchase(purchase) {
  if (purchase.id && APP.purchases.find(p => p.id === purchase.id)) {
    return API.put('/purchases/' + purchase.id, purchase);
  }
  return API.post('/purchases?companyId=' + APP.activeCompanyId, purchase);
}

async function persistSupplierPayment(payment) {
  return API.post('/supplier-payments?companyId=' + APP.activeCompanyId, payment);
}

async function reloadSuppliers() {
  APP.suppliers = await API.get('/suppliers?companyId=' + APP.activeCompanyId);
}
async function reloadDcSeries() {
  APP.dcSeries = await API.get('/dc-series?companyId=' + APP.activeCompanyId);
}
async function reloadClients() {
  APP.clients = await API.get('/clients?companyId=' + APP.activeCompanyId);
}
async function reloadUpiAccounts() {
  APP.upiAccounts = await API.get('/upi-accounts?companyId=' + APP.activeCompanyId);
}

async function switchCompany(id) {
  APP.activeCompanyId = id;
  await API.put('/settings/active-company', { activeCompanyId: id });
  await loadCompanyData(id);
  applyCompanyTheme(getActiveCompany());
  if (typeof refreshAll === 'function') refreshAll();
}

async function loadActivity() {
  try {
    return await API.get('/activity?companyId=' + APP.activeCompanyId + '&limit=30');
  } catch (_) { return []; }
}
