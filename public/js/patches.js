// API-integrated overrides for mutation functions

const _switchCompanyCore = switchCompany;

async function doSwitchCompany(id) {
  closeCoPanel();
  await _switchCompanyCore(id);
  updateCoSwitcher();
}

window.switchCompany = doSwitchCompany;

markAskedToday = async function(clientId) {
  const cl = APP.clients.find(c => c.id === clientId);
  if (!cl) return;
  cl.lastAsked = TODAY;
  await API.put('/clients/' + clientId, cl);
  renderAging(); renderClients(); renderDashboard();
  if (el('page-followups')?.classList.contains('active')) renderFollowups();
  if (el('page-customer-detail')?.classList.contains('active')) renderCustomerDetail();
};

saveQuickPayment = async function() {
  const clientId = parseInt(el('qp-client')?.value);
  const amt = parseFloat(el('qp-amt')?.value) || 0;
  if (!clientId) { alert('Select a client.'); return; }
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const qpMode = el('qp-mode').value;
  if (!qpMode) { alert('Select a payment mode.'); return; }
  const qpUpi = qpMode === 'upi' ? (parseInt(el('qp-upi')?.value) || null) : null;
  if (qpMode === 'upi' && !qpUpi) { alert('Select the UPI account that received this.'); return; }
  const p = await persistPayment({
    clientId, date: el('qp-date').value, amount: amt,
    mode: qpMode, note: el('qp-note').value, upiAccountId: qpUpi
  });
  APP.payments.push(p);
  closeModal();
  toast('Payment recorded');
  refreshAfterPayment();
};

doDeletePayment = async function(id) {
  await API.del('/payments/' + id);
  APP.payments = APP.payments.filter(p => p.id !== id);
  clearAllocCache();
  closeModal();
  el('modal-foot').innerHTML = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save" onclick="handleSave()">Save</button>';
  toast('Payment deleted', 't-del');
  refreshAfterPayment();
};

saveEditPayment = async function(id) {
  const amt = parseFloat(el('ep-amt')?.value) || 0;
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const epMode = el('ep-mode').value;
  const epUpi = epMode === 'upi' ? (parseInt(el('ep-upi')?.value) || null) : null;
  if (epMode === 'upi' && !epUpi) { alert('Select the UPI account.'); return; }
  let p;
  try {
    // Create the replacement FIRST, delete the old only after it succeeds — a failure can never lose the payment
    p = await persistPayment({
      clientId: parseInt(el('ep-client').value), amount: amt,
      date: el('ep-date').value, mode: epMode, note: el('ep-note').value, upiAccountId: epUpi
    });
    if (!p || p.id == null) throw new Error('empty response');
    await API.del('/payments/' + id);
  } catch (e) {
    alert('Could not update payment: ' + (e && e.message ? e.message : 'server error') + '\nPlease try again.');
    return;
  }
  APP.payments = APP.payments.filter(x => x.id !== id);
  APP.payments.push(p);
  clearAllocCache();
  closeModal();
  toast('Payment updated');
  refreshAfterPayment();
};

doAddCompany = async function() {
  const name = el('nco-name').value.trim();
  if (!name) { alert('Company name is required.'); return; }
  const co = await API.post('/companies', {
    name, authorizedSignatory: el('nco-prop').value.trim(),
    mobile: el('nco-phone').value.trim(), mobile2: el('nco-phone2')?.value.trim() || '',
    email: el('nco-email').value.trim(),
    gstin: el('nco-gst').value.trim(), address: el('nco-addr').value.trim(),
    bank: el('nco-bank').value.trim(), financialYear: el('nco-prefix').value.trim() || '2526',
  });
  APP.companies.push(co);
  await doSwitchCompany(co.id);
  closeModal();
  toast('Company added & switched');
};

saveCompanyEdit = async function(existingId) {
  const name = el('eco-name').value.trim();
  if (!name) { alert('Company name is required.'); return; }
  const co = await API.put('/companies/' + existingId, {
    name, authorizedSignatory: el('eco-prop').value.trim(),
    mobile: el('eco-phone').value.trim(), mobile2: el('eco-phone2')?.value.trim() || '',
    email: el('eco-email').value.trim(),
    gstin: el('eco-gst').value.trim(), address: el('eco-addr').value.trim(),
    bank: el('eco-bank').value.trim(), financialYear: el('eco-prefix').value.trim() || '2526',
  });
  const idx = APP.companies.findIndex(c => c.id === existingId);
  if (idx >= 0) APP.companies[idx] = co;
  closeModal();
  updateCoSwitcher();
  renderCompanies();
  applyCompanyTheme(co);
  toast('Company details saved');
};

deleteCompany = async function(id) {
  if (APP.companies.length <= 1) { toast('Cannot delete the only company', 't-del'); return; }
  if (!confirm('Delete this company?')) return;
  await API.del('/companies/' + id);
  await loadCompanies();
  if (APP.activeCompanyId === id) await doSwitchCompany(APP.companies[0].id);
  else { await loadCompanyData(APP.activeCompanyId); refreshAll(); }
  toast('Company deleted', 't-del');
};

saveChallan = async function(existingId) {
  try {
    const rows = [...document.querySelectorAll('#prod-rows .prow')];
    const items = [];
    for (const row of rows) {
      const pid = parseInt(row.querySelector('.prod-sel').value) || 0;
      const price = parseFloat(row.querySelector('.price-f').value) || 0;
      const qty = parseFloat(row.querySelector('.qty-f').value) || 0;
      if (!pid || !qty) continue;
      const p = APP.products.find(x => x.id === pid);
      items.push({ pid, name: p.name, size: row.querySelector('.size-f').value, price, qty, unit: p.unit, lt: price * qty });
    }
    if (!items.length) { alert('Add at least one product row with qty.'); return; }
    const clId = parseInt(el('ch-client').value);
    if (!clId) { alert('Select a client.'); return; }
    // Non-GST (normal series) numbers per client → require the client to have a series prefix
    {
      const _sid = parseInt(el('ch-series')?.value) || 0;
      const _s = _sid ? APP.dcSeries.find(x => x.id === _sid) : APP.dcSeries.find(x => x.companyId === APP.activeCompanyId);
      const _type = _s ? (_s.seriesType || 'normal') : 'normal';
      if (_type === 'normal') {
        const _cl = APP.clients.find(c => c.id === clId);
        if (_cl && !(_cl.chalPrefix && String(_cl.chalPrefix).trim())) {
          alert('This client has no non-GST challan series.\nAdd a Prefix for the client on the Customers page first, then create the challan.');
          return;
        }
      }
    }
    const modeVal = el('ch-mode').value;
    if (!modeVal) { alert('Select a payment mode.'); return; }
    const upiAccountId = modeVal === 'upi' ? (parseInt(el('ch-upi')?.value) || null) : null;
    if (modeVal === 'upi' && !upiAccountId) { alert('Select the UPI account that received this.'); return; }
    const billNoVal = (el('ch-bill')?.value || '').trim();
    const dup = APP.challans.some(c => c.billNo === billNoVal && c.id !== existingId);
    if (dup) { alert('DC No. "' + billNoVal + '" already exists. Please use a different number.'); return; }
    const baseTotal = items.reduce((s, it) => s + it.lt, 0);
    const gstEnabled = el('ch-gst')?.checked ? 1 : 0;
    const total = gstEnabled ? +(baseTotal * 1.18).toFixed(2) : baseTotal;
    const seriesId = parseInt(el('ch-series')?.value) || null;
    const showDcNo = el('ch-show-dcno')?.checked ? 1 : 0;
    const payload = {
      id: existingId || undefined,
      billNo: billNoVal,
      clientId: clId, date: el('ch-date').value, mode: modeVal,
      items, total, vehicleNo: el('ch-veh').value, receiver: el('ch-recv').value,
      notes: el('ch-notes').value, status: 'draft',
      gstEnabled,
      refBillNo: el('ch-ref-bill')?.value || '',
      seriesId,
      showDcNo,
      challanLabel: el('ch-doc-label')?.value || 'DELIVERY CHALLAN',
      upiAccountId,
    };
    let ch;
    if (existingId) {
      ch = await API.put('/challans/' + existingId, payload);
      const idx = APP.challans.findIndex(c => c.id === existingId);
      if (idx >= 0) APP.challans[idx] = ch;
    } else {
      ch = await API.post('/challans?companyId=' + APP.activeCompanyId, payload);
      ch = await API.post('/challans/' + ch.id + '/confirm');
      APP.challans.unshift(ch);
      // Refresh series + clients so the next auto-number (client-wise for non-GST, series for GST/Hide) is correct
      if (typeof reloadDcSeries === 'function') await reloadDcSeries();
      if (typeof reloadClients === 'function') await reloadClients();
    }
    clearAllocCache();
    closeModal();
    try { renderChallans(); renderDashboard(); } catch (_) { /* a render error must not read as a save failure */ }
    toast(existingId ? 'Challan updated' : 'Challan saved');
  } catch(e) {
    toast(e.message || 'Failed to save challan', 't-del');
  }
};

saveClient = async function(existingId) {
  const name = el('cl-name').value.trim();
  const phone = el('cl-phone').value.trim();
  if (!name || !phone) { alert('Name and Phone are required.'); return; }
  const chalPrefix = el('cl-chal-prefix')?.value.trim() || '';
  if (!chalPrefix) { alert('Challan Series Prefix is required — it keeps this client\'s non-GST challan numbers unique (e.g. the client\'s initials).'); el('cl-chal-prefix')?.focus(); return; }
  const obAmt = parseFloat(el('cl-ob-amt')?.value) || 0;
  const obType = el('cl-ob-type')?.value;
  const obj = {
    name, phone, address: el('cl-addr').value.trim(), email: el('cl-email').value.trim(),
    gst: el('cl-gst').value.trim(),
    openingBalance: obType === 'cr' ? -obAmt : obAmt,
    openingBalanceDate: el('cl-ob-date')?.value || null,
    lastAsked: el('cl-asked').value || null,
    chalPrefix,
    chalStartNumber: parseInt(el('cl-chal-start')?.value) || 1,
  };
  let saved;
  try {
    saved = existingId
      ? await API.put('/clients/' + existingId, obj)
      : await API.post('/clients?companyId=' + APP.activeCompanyId, obj);
  } catch (e) {
    alert('Could not save client: ' + (e && e.message ? e.message : 'server error') + '\nPlease try again.');
    return;   // keep the modal open for a retry; handleSave() resets the button
  }
  if (!saved || saved.id == null) {   // guard against an empty/invalid response corrupting the list
    alert('Client may not have saved correctly. Refresh and check before re-adding.');
    return;
  }
  if (existingId) {
    const idx = APP.clients.findIndex(c => c.id === existingId);
    if (idx >= 0) APP.clients[idx] = saved; else APP.clients.push(saved);
  } else {
    APP.clients.push(saved);
  }
  closeModal();
  try { renderClients(); populateClientSelects(); } catch (_) { /* render errors must not mask a successful save */ }
  toast(existingId ? 'Client updated' : 'Client added');
};

saveProduct = async function(existingId) {
  const name = el('pr-name').value.trim();
  const unit = el('pr-unit').value;
  const price = parseFloat(el('pr-price').value) || 0;
  if (!name) { alert('Name is required.'); return; }
  if (unit !== 'charge' && !price) { alert('Rate is required.'); return; }
  const obj = {
    name, desc: el('pr-desc').value.trim(), size: el('pr-size').value.trim(),
    unit, price,
  };
  let saved;
  try {
    saved = existingId
      ? await API.put('/products/' + existingId, obj)
      : await API.post('/products?companyId=' + APP.activeCompanyId, obj);
  } catch (e) {
    alert('Could not save product: ' + (e && e.message ? e.message : 'server error') + '\nPlease try again.');
    return;
  }
  if (!saved || saved.id == null) { alert('Product may not have saved correctly. Refresh and check.'); return; }
  if (existingId) {
    const idx = APP.products.findIndex(p => p.id === existingId);
    if (idx >= 0) APP.products[idx] = saved; else APP.products.push(saved);
  } else {
    APP.products.push(saved);
  }
  closeModal();
  try { renderProducts(); } catch (_) {}
  toast(existingId ? 'Product updated' : 'Product saved');
};

savePayment = async function(clientId) {
  const amt = parseFloat(el('pm-amt').value) || 0;
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const pmMode = el('pm-mode').value;
  if (!pmMode) { alert('Select a payment mode.'); return; }
  const pmUpi = pmMode === 'upi' ? (parseInt(el('pm-upi')?.value) || null) : null;
  if (pmMode === 'upi' && !pmUpi) { alert('Select the UPI account that received this.'); return; }
  const p = await persistPayment({
    clientId, date: el('pm-date').value, amount: amt,
    mode: pmMode, note: el('pm-note').value, upiAccountId: pmUpi,
  });
  APP.payments.push(p);
  clearAllocCache();
  closeModal();
  toast('Payment recorded');
  refreshAfterPayment();
};

doDelete = async function(type, id) {
  if (type === 'challan') {
    await API.del('/challans/' + id);
    APP.challans = APP.challans.filter(c => c.id !== id);
    clearAllocCache();
  } else if (type === 'client') {
    await API.del('/clients/' + id);
    APP.clients = APP.clients.filter(c => c.id != id);
    clearAllocCache();
  } else if (type === 'product') {
    await API.del('/products/' + id);
    APP.products = APP.products.filter(p => p.id != id);
  } else if (type === 'purchase') {
    await API.del('/purchases/' + id);
    APP.purchases = APP.purchases.filter(p => p.id !== id);
    clearAllocCache();
  } else if (type === 'supplier') {
    await API.del('/suppliers/' + id);
    APP.suppliers = APP.suppliers.filter(s => s.id != id);
    clearAllocCache();
  }
  closeModal();
  el('modal-foot').innerHTML = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save" onclick="handleSave()">Save</button>';
  toast(type[0].toUpperCase() + type.slice(1) + ' deleted', 't-del');
  if (type === 'challan') renderChallans();
  if (type === 'client') renderClients();
  if (type === 'product') renderProducts();
  if (type === 'purchase' && typeof renderPurchases === 'function') renderPurchases();
  if (type === 'supplier' && typeof renderSuppliers === 'function') renderSuppliers();
  renderDashboard();
};

async function logoutUser() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
}

importData = function(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.challans || !data.clients) { alert('Invalid backup file.'); return; }
      if (!confirm('Replace ALL data with this backup?')) { input.value = ''; return; }
      await API.post('/backup/import', data);
      await loadStore();
      populateClientSelects();
      refreshAll();
      nav('dashboard');
      toast('Backup imported successfully');
    } catch (err) { alert('Import failed: ' + err.message); }
    input.value = '';
  };
  reader.readAsText(file);
};

resetToSeed = async function() {
  if (!confirm('Reset to demo data? All current data will be cleared.')) return;
  alert('Contact admin to re-seed database via: npm run migrate -- --seed');
};

uploadCompanyLogo = async function(companyId, input) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('logo', file);
  try {
    const res = await fetch('/api/companies/' + companyId + '/logo', {
      method: 'POST', credentials: 'include', body: fd
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    const idx = APP.companies.findIndex(c => c.id === companyId);
    if (idx >= 0) APP.companies[idx] = data;
    applyCompanyTheme(getActiveCompany());
    updateCoSwitcher();
    toast('Logo uploaded');
  } catch (e) {
    toast(e.message, 't-del');
  }
  input.value = '';
};

/* ══════════════════ SUPPLIERS ══════════════════ */
saveSupplier = async function(existingId) {
  const name = el('sup-name').value.trim();
  if (!name) { alert('Supplier name is required.'); return; }
  const obAmt = parseFloat(el('sup-ob-amt')?.value) || 0;
  const obType = el('sup-ob-type')?.value;
  const obj = {
    name,
    phone: el('sup-phone').value.trim(),
    address: el('sup-addr').value.trim(),
    email: el('sup-email')?.value.trim() || '',
    gst: el('sup-gst').value.trim(),
    openingBalance: obType === 'cr' ? -obAmt : obAmt,
    openingBalanceDate: el('sup-ob-date')?.value || null,
    lastAsked: el('sup-asked')?.value || null,
    purPrefix: el('sup-pur-prefix')?.value.trim() || '',
    purStartNumber: parseInt(el('sup-pur-start')?.value) || 1,
  };
  let saved;
  try {
    saved = existingId
      ? await API.put('/suppliers/' + existingId, obj)
      : await API.post('/suppliers?companyId=' + APP.activeCompanyId, obj);
  } catch (e) {
    alert('Could not save supplier: ' + (e && e.message ? e.message : 'server error') + '\nPlease try again.');
    return;
  }
  if (!saved || saved.id == null) { alert('Supplier may not have saved correctly. Refresh and check.'); return; }
  if (existingId) {
    const idx = APP.suppliers.findIndex(s => s.id === existingId);
    if (idx >= 0) APP.suppliers[idx] = saved; else APP.suppliers.push(saved);
  } else {
    APP.suppliers.push(saved);
  }
  closeModal();
  try { if (typeof renderSuppliers === 'function') renderSuppliers(); if (typeof populateSupplierSelects === 'function') populateSupplierSelects(); } catch (_) {}
  toast(existingId ? 'Supplier updated' : 'Supplier added');
};

/* ══════════════════ PURCHASES ══════════════════ */
savePurchase = async function(existingId) {
  try {
    const rows = [...document.querySelectorAll('#pur-rows .prow')];
    const items = [];
    for (const row of rows) {
      const pid = parseInt(row.querySelector('.prod-sel').value) || 0;
      const price = parseFloat(row.querySelector('.price-f').value) || 0;
      const qty = parseFloat(row.querySelector('.qty-f').value) || 0;
      if (!pid || !qty) continue;
      const p = APP.products.find(x => x.id === pid);
      items.push({ pid, name: p.name, size: row.querySelector('.size-f').value, price, qty, unit: p.unit, lt: price * qty });
    }
    if (!items.length) { alert('Add at least one product row with qty.'); return; }
    const supId = parseInt(el('pur-supplier').value);
    if (!supId) { alert('Select a supplier.'); return; }
    const modeVal = el('pur-mode').value;
    if (!modeVal) { alert('Select a payment mode.'); return; }
    const upiAccountId = modeVal === 'upi' ? (parseInt(el('pur-upi')?.value) || null) : null;
    if (modeVal === 'upi' && !upiAccountId) { alert('Select the UPI account used to pay.'); return; }
    const billNoVal = (el('pur-bill')?.value || '').trim();
    const dup = APP.purchases.some(p => p.billNo === billNoVal && p.id !== existingId);
    if (billNoVal && dup) { alert('Purchase No. "' + billNoVal + '" already exists. Please use a different number.'); return; }
    const baseTotal = items.reduce((s, it) => s + it.lt, 0);
    const gstEnabled = el('pur-gst')?.checked ? 1 : 0;
    const total = gstEnabled ? +(baseTotal * 1.18).toFixed(2) : baseTotal;
    const payload = {
      id: existingId || undefined,
      billNo: billNoVal,
      supplierId: supId, date: el('pur-date').value, mode: modeVal,
      items, total, vehicleNo: el('pur-veh')?.value || '', receiver: el('pur-recv')?.value || '',
      notes: el('pur-notes').value, status: 'draft',
      gstEnabled,
      refBillNo: el('pur-ref-bill')?.value || '',
      docLabel: el('pur-doc-label')?.value || 'PURCHASE INVOICE',
      upiAccountId,
    };
    let pu;
    if (existingId) {
      pu = await API.put('/purchases/' + existingId, payload);
      const idx = APP.purchases.findIndex(p => p.id === existingId);
      if (idx >= 0) APP.purchases[idx] = pu;
    } else {
      pu = await API.post('/purchases?companyId=' + APP.activeCompanyId, payload);
      pu = await API.post('/purchases/' + pu.id + '/confirm');
      APP.purchases.unshift(pu);
      // Refresh suppliers so the next auto-number (PREFIX/MON/NN, monthly reset) is correct
      if (typeof reloadSuppliers === 'function') await reloadSuppliers();
    }
    clearAllocCache();
    closeModal();
    try { if (typeof renderPurchases === 'function') renderPurchases(); renderDashboard(); } catch (_) { /* render error must not read as a save failure */ }
    toast(existingId ? 'Purchase updated' : 'Purchase saved');
  } catch (e) {
    toast(e.message || 'Failed to save purchase', 't-del');
  }
};

/* ══════════════════ SUPPLIER PAYMENTS ══════════════════ */
function _refreshAfterSupplierPayment() {
  clearAllocCache();
  if (typeof renderSupplierPayments === 'function') renderSupplierPayments();
  if (typeof renderSuppliers === 'function') renderSuppliers();
  if (el('page-supplier-detail')?.classList.contains('active') && typeof renderSupplierDetail === 'function') renderSupplierDetail();
  if (el('page-upi')?.classList.contains('active') && typeof renderUpiReport === 'function') renderUpiReport();
  renderDashboard();
}

saveSupplierPayment = async function(supplierId) {
  const amt = parseFloat(el('spm-amt').value) || 0;
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const mode = el('spm-mode').value;
  if (!mode) { alert('Select a payment mode.'); return; }
  const upi = mode === 'upi' ? (parseInt(el('spm-upi')?.value) || null) : null;
  if (mode === 'upi' && !upi) { alert('Select the UPI account used to pay.'); return; }
  const p = await persistSupplierPayment({ supplierId, date: el('spm-date').value, amount: amt, mode, note: el('spm-note').value, upiAccountId: upi });
  APP.supplierPayments.push(p);
  closeModal();
  toast('Payment recorded');
  _refreshAfterSupplierPayment();
};

saveQuickSupplierPayment = async function() {
  const supplierId = parseInt(el('sqp-supplier')?.value);
  const amt = parseFloat(el('sqp-amt')?.value) || 0;
  if (!supplierId) { alert('Select a supplier.'); return; }
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const mode = el('sqp-mode').value;
  if (!mode) { alert('Select a payment mode.'); return; }
  const upi = mode === 'upi' ? (parseInt(el('sqp-upi')?.value) || null) : null;
  if (mode === 'upi' && !upi) { alert('Select the UPI account used to pay.'); return; }
  const p = await persistSupplierPayment({ supplierId, date: el('sqp-date').value, amount: amt, mode, note: el('sqp-note').value, upiAccountId: upi });
  APP.supplierPayments.push(p);
  closeModal();
  toast('Payment recorded');
  _refreshAfterSupplierPayment();
};

saveEditSupplierPayment = async function(id) {
  const amt = parseFloat(el('sep-amt')?.value) || 0;
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const mode = el('sep-mode').value;
  const upi = mode === 'upi' ? (parseInt(el('sep-upi')?.value) || null) : null;
  if (mode === 'upi' && !upi) { alert('Select the UPI account.'); return; }
  let p;
  try {
    // Create the replacement FIRST, delete the old only after it succeeds — a failure can never lose the payment
    p = await persistSupplierPayment({ supplierId: parseInt(el('sep-supplier').value), amount: amt, date: el('sep-date').value, mode, note: el('sep-note').value, upiAccountId: upi });
    if (!p || p.id == null) throw new Error('empty response');
    await API.del('/supplier-payments/' + id);
  } catch (e) {
    alert('Could not update payment: ' + (e && e.message ? e.message : 'server error') + '\nPlease try again.');
    return;
  }
  APP.supplierPayments = APP.supplierPayments.filter(x => x.id !== id);
  APP.supplierPayments.push(p);
  closeModal();
  toast('Payment updated');
  _refreshAfterSupplierPayment();
};

doDeleteSupplierPayment = async function(id) {
  await API.del('/supplier-payments/' + id);
  APP.supplierPayments = APP.supplierPayments.filter(p => p.id !== id);
  closeModal();
  el('modal-foot').innerHTML = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save" onclick="handleSave()">Save</button>';
  toast('Payment deleted', 't-del');
  _refreshAfterSupplierPayment();
};

/* ══════════════════ UPI ACCOUNTS ══════════════════ */
saveUpiAccount = async function(existingId) {
  const name = el('upi-name').value.trim();
  if (!name) { alert('Account name is required.'); return; }
  const obj = { name, openingBalance: parseFloat(el('upi-ob')?.value) || 0 };
  let saved;
  try {
    saved = existingId
      ? await API.put('/upi-accounts/' + existingId, obj)
      : await API.post('/upi-accounts?companyId=' + APP.activeCompanyId, obj);
  } catch (e) {
    alert('Could not save UPI account: ' + (e && e.message ? e.message : 'server error') + '\nPlease try again.');
    return;
  }
  if (!saved || saved.id == null) { alert('UPI account may not have saved correctly. Refresh and check.'); return; }
  if (existingId) {
    const idx = APP.upiAccounts.findIndex(u => u.id === existingId);
    if (idx >= 0) APP.upiAccounts[idx] = saved; else APP.upiAccounts.push(saved);
  } else {
    APP.upiAccounts.push(saved);
  }
  closeModal();
  try { if (typeof renderUpiReport === 'function') renderUpiReport(); } catch (_) {}
  toast(existingId ? 'UPI account updated' : 'UPI account added');
  return saved;
};

deleteUpiAccount = async function(id) {
  if (!confirm('Delete this UPI account?')) return;
  await API.del('/upi-accounts/' + id);
  APP.upiAccounts = APP.upiAccounts.filter(u => u.id !== id);
  if (typeof renderUpiReport === 'function') renderUpiReport();
  toast('UPI account deleted', 't-del');
};

exportData = async function() {
  try {
    const res = await fetch('/api/backup/export', { credentials: 'include' });
    if (!res.ok) throw new Error('Export failed');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ChallanPro-Backup-' + TODAY + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exported successfully');
  } catch (e) {
    toast(e.message, 't-del');
  }
};
