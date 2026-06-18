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
  const p = await persistPayment({
    clientId, date: el('qp-date').value, amount: amt,
    mode: el('qp-mode').value, note: el('qp-note').value
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
  await API.del('/payments/' + id);
  const p = await persistPayment({
    clientId: parseInt(el('ep-client').value), amount: amt,
    date: el('ep-date').value, mode: el('ep-mode').value, note: el('ep-note').value
  });
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
      clientId: clId, date: el('ch-date').value, mode: el('ch-mode').value,
      items, total, vehicleNo: el('ch-veh').value, receiver: el('ch-recv').value,
      notes: el('ch-notes').value, status: 'draft',
      gstEnabled,
      refBillNo: el('ch-ref-bill')?.value || '',
      seriesId,
      showDcNo,
      challanLabel: el('ch-doc-label')?.value || 'DELIVERY CHALLAN',
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
      if (seriesId) {
        const si = APP.dcSeries.findIndex(x => x.id === seriesId);
        if (si >= 0) APP.dcSeries[si] = { ...APP.dcSeries[si], nextNumber: APP.dcSeries[si].nextNumber + 1 };
      }
    }
    clearAllocCache();
    closeModal();
    renderChallans();
    renderDashboard();
    toast(existingId ? 'Challan updated' : 'Challan saved');
  } catch(e) {
    toast(e.message || 'Failed to save challan', 't-del');
  }
};

saveClient = async function(existingId) {
  const name = el('cl-name').value.trim();
  const phone = el('cl-phone').value.trim();
  if (!name || !phone) { alert('Name and Phone are required.'); return; }
  const obAmt = parseFloat(el('cl-ob-amt')?.value) || 0;
  const obType = el('cl-ob-type')?.value;
  const obj = {
    name, phone, address: el('cl-addr').value.trim(), email: el('cl-email').value.trim(),
    gst: el('cl-gst').value.trim(),
    openingBalance: obType === 'cr' ? -obAmt : obAmt,
    openingBalanceDate: el('cl-ob-date')?.value || null,
    lastAsked: el('cl-asked').value || null,
  };
  let saved;
  if (existingId) {
    saved = await API.put('/clients/' + existingId, obj);
    const idx = APP.clients.findIndex(c => c.id === existingId);
    if (idx >= 0) APP.clients[idx] = saved;
  } else {
    saved = await API.post('/clients?companyId=' + APP.activeCompanyId, obj);
    APP.clients.push(saved);
  }
  closeModal();
  renderClients();
  populateClientSelects();
  toast(existingId ? 'Client updated' : 'Client added');
};

saveProduct = async function(existingId) {
  const name = el('pr-name').value.trim();
  const price = parseFloat(el('pr-price').value) || 0;
  if (!name || !price) { alert('Name and Rate are required.'); return; }
  const obj = {
    name, desc: el('pr-desc').value.trim(), size: el('pr-size').value.trim(),
    unit: el('pr-unit').value, price,
  };
  let saved;
  if (existingId) {
    saved = await API.put('/products/' + existingId, obj);
    const idx = APP.products.findIndex(p => p.id === existingId);
    if (idx >= 0) APP.products[idx] = saved;
  } else {
    saved = await API.post('/products?companyId=' + APP.activeCompanyId, obj);
    APP.products.push(saved);
  }
  closeModal();
  renderProducts();
  toast(existingId ? 'Product updated' : 'Product saved');
};

savePayment = async function(clientId) {
  const amt = parseFloat(el('pm-amt').value) || 0;
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  const p = await persistPayment({
    clientId, date: el('pm-date').value, amount: amt,
    mode: el('pm-mode').value, note: el('pm-note').value,
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
  }
  closeModal();
  el('modal-foot').innerHTML = '<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save" onclick="handleSave()">Save</button>';
  toast(type[0].toUpperCase() + type.slice(1) + ' deleted', 't-del');
  if (type === 'challan') renderChallans();
  if (type === 'client') renderClients();
  if (type === 'product') renderProducts();
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
