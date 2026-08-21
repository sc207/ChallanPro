function importData(input) {
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if(!data.challans || !data.clients) { alert('Invalid backup file — missing challans or clients data.'); return; }
      if(!confirm('This will replace ALL current data with the backup. Continue?')) { input.value=''; return; }
      APP = data; clearAllocCache(); saveStore();
      clearAllocCache(); populateClientSelects(); renderDashboard(); renderDailyBook(); renderChallans(); renderCustomers(); renderFollowups(); renderProducts(); renderCompanies(); renderMonthly(); renderAging(); renderPayments(); updateCoSwitcher();
      nav('dashboard'); toast('Backup imported successfully');
    } catch(err) { alert('Could not read file: ' + err.message); }
    input.value = '';
  };
  reader.readAsText(file);
}
function resetToSeed() {
  if(!confirm('Reset to demo data? All your current data will be cleared.')) return;
  APP = JSON.parse(JSON.stringify(SEED)); clearAllocCache(); saveStore();
  clearAllocCache(); populateClientSelects(); renderDashboard(); renderDailyBook(); renderChallans(); renderCustomers(); renderFollowups(); renderProducts(); renderCompanies(); renderMonthly(); renderAging(); renderPayments(); updateCoSwitcher();
  nav('dashboard'); toast('Reset to demo data','t-info');
}

// ═══ COMPANY SWITCHER ═══
function updateCoSwitcher() {
  const co = getActiveCompany();
  const n = el('co-sw-name'); if(n) n.textContent = co ? co.name : '—';
  const list = el('co-panel-list'); if(!list) return;
  list.innerHTML = APP.companies.map(function(c){
    return '<div class="co-item '+(c.id===APP.activeCompanyId?'aco':'')+'" onclick="switchCompany('+c.id+')">'+
      '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.name+'</span>'+
      (c.id===APP.activeCompanyId?'<i class="fas fa-check" style="color:#60a5fa;font-size:11px;flex-shrink:0"></i>':'')+
    '</div>';
  }).join('');
}
function toggleCoPanel() {
  const panel = el('co-panel'), icon = el('co-sw-icon');
  panel.classList.toggle('open');
  if(icon) icon.style.transform = panel.classList.contains('open') ? 'rotate(180deg)' : '';
}
function closeCoPanel() {
  const panel = el('co-panel'), icon = el('co-sw-icon');
  if(panel){ panel.classList.remove('open'); }
  if(icon) icon.style.transform='';
}
// ═══ COMPANIES PAGE ═══
function renderCompanies() {
  const cos = APP.companies;
  const totalSales = cChallans().reduce(function(s,c){return s+c.total;},0);
  const totalPaid  = cPayments().reduce(function(s,p){return s+p.amount;},0);
  const totalOS    = cClients().reduce(function(s,cl){return s+Math.max(0,clientBalance(cl.id));},0);
  const co = getActiveCompany();
  const statsEl = el('co-stats');
  if(statsEl) statsEl.innerHTML=
    '<div class="stat-card"><div class="icon-box" style="background:#dbeafe"><i class="fas fa-building" style="color:#1d4ed8"></i></div><div><div class="stat-label">Active Company</div><div style="font-size:14px;font-weight:800;color:var(--text);line-height:1.2;margin-top:2px">'+(co?co.name:'—')+'</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#dcfce7"><i class="fas fa-rupee-sign" style="color:#15803d"></i></div><div><div class="stat-label">Total Sales</div><div class="stat-val">'+fmt(totalSales)+'</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#ede9fe"><i class="fas fa-money-bill-wave" style="color:#6d28d9"></i></div><div><div class="stat-label">Collected</div><div class="stat-val" style="color:#15803d">'+fmt(totalPaid)+'</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#fee2e2"><i class="fas fa-credit-card" style="color:#b91c1c"></i></div><div><div class="stat-label">Outstanding</div><div class="stat-val" style="color:#b91c1c">'+fmt(totalOS)+'</div></div></div>';

  const listEl = el('co-list');
  if(!listEl) return;
  listEl.innerHTML = cos.map(function(c){
    const isActive = c.id === APP.activeCompanyId;
    return '<div class="card" style="margin-bottom:10px;border:'+(isActive?'2px solid #1d4ed8':'1px solid #e2e8f0')+'">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px">'+
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
            '<div style="font-weight:700;font-size:15px">'+c.name+'</div>'+
            (isActive?'<span class="badge badge-paid" style="font-size:10px">Active</span>':'')+
          '</div>'+
          '<div style="font-size:12px;color:#64748b">'+[c.proprietor,c.phone,c.gst].filter(Boolean).join(' · ')+'</div>'+
          (c.address?'<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+c.address+'</div>':'')+
        '</div>'+
        '<div style="display:flex;gap:6px;flex-shrink:0">'+
          (!isActive?'<button class="btn btn-success btn-sm" onclick="switchCompany('+c.id+')">Switch</button>':'')+
          '<button class="btn btn-ghost btn-sm" onclick="openEditCompanyModal('+c.id+')"><i class="fas fa-edit"></i></button>'+
          (cos.length>1?'<button class="btn btn-danger btn-sm" onclick="deleteCompany('+c.id+')"><i class="fas fa-trash"></i></button>':'')+
        '</div>'+
      '</div></div>';
  }).join('');
}

function openAddCompanyModal() {
  closeCoPanel();
  var html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1"><label>Company Name *</label><input class="inp" id="nco-name" placeholder="e.g. My Textiles Pvt Ltd"></div>'+
      '<div class="form-row"><label>Proprietor</label><input class="inp" id="nco-prop" placeholder="Owner name"></div>'+
      '<div class="form-row"><label>Mobile No. 1</label><input class="inp" id="nco-phone" placeholder="98765 00000"></div>'+
      '<div class="form-row"><label>Mobile No. 2</label><input class="inp" id="nco-phone2" placeholder="Alternate mobile"></div>'+
      '<div class="form-row"><label>Email</label><input class="inp" id="nco-email" type="email" placeholder="email@company.com"></div>'+
      '<div class="form-row"><label>GST No</label><input class="inp" id="nco-gst" placeholder="24AABCC1234F1Z5"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Address</label><textarea class="inp" id="nco-addr" rows="2" placeholder="Full business address"></textarea></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Bank Details</label><input class="inp" id="nco-bank" placeholder="Bank Name — A/c XXXX — IFSC"></div>'+
      '<div class="form-row"><label>Bill No. Prefix</label><input class="inp" id="nco-prefix" value="2526" style="width:120px"></div>'+
    '</div>';
  openModal('Add New Company', html, doAddCompany);
}
function doAddCompany() {
  var name = el('nco-name').value.trim();
  if(!name){ alert('Company name is required.'); return; }
  var newId = APP.companies.length ? Math.max.apply(null, APP.companies.map(function(c){return c.id;})) + 1 : 1;
  APP.companies.push({
    id:newId, name:name,
    proprietor:el('nco-prop').value.trim(),
    phone:el('nco-phone').value.trim(),
    email:el('nco-email').value.trim(),
    gst:el('nco-gst').value.trim(),
    address:el('nco-addr').value.trim(),
    bank:el('nco-bank').value.trim(),
    billPrefix:(el('nco-prefix').value.trim()||'2526')
  });
  APP.activeCompanyId = newId;
  saveStore(); clearAllocCache(); closeModal();
  updateCoSwitcher(); refreshAll();
  toast('Company added & switched');
}
function openEditCompanyModal(existingId) {
  var co = APP.companies.find(function(c){return c.id===existingId;}); if(!co) return;
  var html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1"><label>Company Name *</label><input class="inp" id="eco-name" value="'+co.name+'"></div>'+
      '<div class="form-row"><label>Proprietor</label><input class="inp" id="eco-prop" value="'+(co.proprietor||'')+'"></div>'+
      '<div class="form-row"><label>Mobile No. 1</label><input class="inp" id="eco-phone" value="'+(co.phone||'')+'"></div>'+
      '<div class="form-row"><label>Mobile No. 2</label><input class="inp" id="eco-phone2" value="'+(co.mobile2||co.phone2||'')+'"></div>'+
      '<div class="form-row"><label>Email</label><input class="inp" id="eco-email" value="'+(co.email||'')+'"></div>'+
      '<div class="form-row"><label>GST No</label><input class="inp" id="eco-gst" value="'+(co.gst||'')+'"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Address</label><textarea class="inp" id="eco-addr" rows="2">'+(co.address||'')+'</textarea></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Bank Details</label><input class="inp" id="eco-bank" value="'+(co.bank||'')+'"></div>'+
      '<div class="form-row"><label>Bill No. Prefix</label><input class="inp" id="eco-prefix" value="'+(co.billPrefix||'2526')+'" style="width:120px"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Company Logo</label>'+
        (co.logoPath||co.logo?'<img src="'+(co.logoPath||co.logo)+'" style="height:40px;object-fit:contain;display:block;margin-bottom:8px">':'')+
        '<input class="inp" type="file" accept="image/png,image/jpeg,image/webp" onchange="uploadCompanyLogo('+existingId+',this)">'+
        '<div style="font-size:11px;color:#94a3b8;margin-top:4px">PNG/JPG/WebP, max 500 KB</div></div>'+
    '</div>';
  openModal('Edit Company — '+co.name, html, function(){return saveCompanyEdit(existingId);});
}
function saveCompanyEdit(existingId) {
  var name = el('eco-name').value.trim();
  if(!name){ alert('Company name is required.'); return; }
  var idx = APP.companies.findIndex(function(c){return c.id===existingId;});
  if(idx<0) return;
  APP.companies[idx] = {
    id:existingId, name:name,
    proprietor:el('eco-prop').value.trim(),
    phone:el('eco-phone').value.trim(),
    email:el('eco-email').value.trim(),
    gst:el('eco-gst').value.trim(),
    address:el('eco-addr').value.trim(),
    bank:el('eco-bank').value.trim(),
    billPrefix:(el('eco-prefix').value.trim()||'2526')
  };
  saveStore(); closeModal();
  updateCoSwitcher(); renderCompanies();
  toast('Company details saved');
}
function deleteCompany(id) {
  if(APP.companies.length<=1){ toast('Cannot delete the only company','t-del'); return; }
  if(!confirm('Delete this company? All its clients, challans, and payments will also be deleted.')) return;
  APP.companies = APP.companies.filter(function(c){return c.id!==id;});
  APP.clients   = APP.clients.filter(function(c){return c.companyId!==id;});
  APP.challans  = APP.challans.filter(function(c){return c.companyId!==id;});
  APP.payments  = APP.payments.filter(function(p){return p.companyId!==id;});
  APP.products  = APP.products.filter(function(p){return p.companyId!==id;});
  if(APP.activeCompanyId===id) APP.activeCompanyId = APP.companies[0].id;
  clearAllocCache(); saveStore();
  updateCoSwitcher(); refreshAll();
  toast('Company deleted','t-del');
}

// ═══ CUSTOMER DETAIL PAGE ═══
var currentClientId = null, lastPageBeforeDetail = 'customers';
function openCustomerDetail(clientId, fromPage) {
  currentClientId = clientId;
  lastPageBeforeDetail = fromPage || 'customers';
  _ldFrom = ''; _ldTo = ''; _ldPage = 1;
  nav('customer-detail');
}
function goBackFromDetail() {
  nav(lastPageBeforeDetail);
}
function renderCustomerDetail() {
  if(!currentClientId) return;
  var cl = APP.clients.find(function(c){return c.id===currentClientId;}); if(!cl) return;
  var s = clientStats(cl.id);
  var r = riskLevel(s.oldest, s.os);
  var hdr = el('cd-hdr-card');
  if(hdr) hdr.innerHTML=
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">'+
      '<div>'+
        '<div style="font-size:18px;font-weight:800">'+cl.name+'</div>'+
        '<div style="font-size:12px;opacity:.7;margin-top:3px">'+[cl.phone,cl.gst,cl.address].filter(Boolean).join(' · ')+'</div>'+
      '</div>'+
      '<span class="badge '+r.cls+'">'+r.label+'</span>'+
    '</div>'+
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'+
      '<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:10px"><div style="font-size:10px;opacity:.6;margin-bottom:3px">Total Sales</div><div style="font-size:16px;font-weight:800">'+fmt(s.totalSales)+'</div></div>'+
      '<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:10px"><div style="font-size:10px;opacity:.6;margin-bottom:3px">Paid</div><div style="font-size:16px;font-weight:800;color:#4ade80">'+fmt(s.totalPaid)+'</div></div>'+
      '<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:10px"><div style="font-size:10px;opacity:.6;margin-bottom:3px">Outstanding</div><div style="font-size:16px;font-weight:800;color:'+(s.os>0?'#f87171':'#4ade80')+'">'+fmt(s.os)+'</div></div>'+
      '<div style="background:rgba(255,255,255,.08);border-radius:8px;padding:10px"><div style="font-size:10px;opacity:.6;margin-bottom:3px">Oldest Pending</div><div style="font-size:16px;font-weight:800;color:'+(s.oldest>60?'#f87171':s.oldest>30?'#fbbf24':'#e2e8f0')+'">'+(s.oldest>0?s.oldest+'d':'—')+'</div></div>'+
    '</div>';
  showCdTab('overview');
}
function showCdTab(tab) {
  var tabs = el('cd-tabs');
  if(tabs) tabs.querySelectorAll('.cd-tab').forEach(function(t,i){
    t.classList.toggle('active', ['overview','challans','payments','ledger'][i]===tab);
  });
  ['overview','challans','payments','ledger'].forEach(function(t){
    var p=el('cdp-'+t); if(p) p.classList.toggle('active',t===tab);
  });
  if(!currentClientId) return;
  if(tab==='overview') renderCdOverview();
  else if(tab==='challans') renderCdChallans();
  else if(tab==='payments') renderCdPayments();
  else if(tab==='ledger') renderCdLedger();
}
function renderCdOverview() {
  var cId = currentClientId;
  var pending = APP.challans.filter(function(c){return c.clientId===cId&&outstanding(c)>0;}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var recent  = APP.challans.filter(function(c){return c.clientId===cId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);}).slice(0,5);
  var recentPmts = APP.payments.filter(function(p){return p.clientId===cId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);}).slice(0,5);
  var html='';
  if(pending.length){
    html+='<div class="card" style="margin-bottom:14px"><div style="font-weight:700;font-size:13px;color:#b91c1c;margin-bottom:10px"><i class="fas fa-exclamation-circle" style="margin-right:5px"></i>Pending Dues — FIFO Order</div>'+
      '<div style="overflow-x:auto"><table><thead><tr><th>DC No</th><th>Date</th><th>Total</th><th>Outstanding</th><th>Age</th><th>Status</th><th></th></tr></thead><tbody>'+
      pending.map(function(c){var os=outstanding(c),d=daysOld(c.date);return '<tr><td><strong style="color:#1d4ed8;cursor:pointer" onclick="openChallanView(\''+c.id+'\')">'+c.billNo+'</strong></td><td>'+fmtD(c.date)+'</td><td>'+fmt(c.total)+'</td><td style="font-weight:800;color:#b91c1c">'+fmt(os)+'</td><td style="color:'+(d>60?'#dc2626':d>30?'#d97706':'#334155')+';font-weight:600">'+d+'d</td><td><span class="badge badge-'+challanStatus(c)+'">'+challanStatus(c)+'</span></td><td><button class="btn btn-success btn-sm" onclick="openPaymentModal('+cId+')"><i class="fas fa-rupee-sign"></i></button></td></tr>';}).join('')+
      '</tbody></table></div></div>';
  }
  if(recent.length){
    html+='<div class="grid-2"><div class="card"><div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:10px">Recent Challans</div>'+
      recent.map(function(c){return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9"><div><div style="font-size:13px;font-weight:700;color:#1d4ed8;cursor:pointer" onclick="openChallanView(\''+c.id+'\')">'+c.billNo+'</div><div style="font-size:11px;color:#94a3b8">'+fmtD(c.date)+'</div></div><div style="text-align:right"><div style="font-weight:700">'+fmt(c.total)+'</div><span class="badge badge-'+challanStatus(c)+'" style="font-size:10px">'+challanStatus(c)+'</span></div></div>';}).join('')+
      '</div>'+
      '<div class="card"><div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:10px">Recent Payments</div>'+
      (recentPmts.length?recentPmts.map(function(p){return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9"><div><div style="font-size:13px;font-weight:700;color:#15803d">'+fmt(p.amount)+'</div><div style="font-size:11px;color:#94a3b8">'+fmtD(p.date)+'</div></div><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></div>';}).join(''):
      '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px">No payments yet</div>')+
      '</div></div>';
  }
  if(!html) html='<div style="text-align:center;padding:40px;color:#94a3b8"><i class="fas fa-user" style="font-size:32px;display:block;margin-bottom:10px"></i>No transactions yet</div>';
  var pane=el('cdp-overview'); if(pane) pane.innerHTML=html;
}
function renderCdChallans() {
  var list = APP.challans.filter(function(c){return c.clientId===currentClientId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var pane=el('cdp-challans'); if(!pane) return;
  pane.innerHTML = list.length ?
    '<div class="card"><div style="overflow-x:auto"><table><thead><tr><th>DC No</th><th>Date</th><th>Items</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Mode</th><th>Age</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+list.map(function(c){return challanTR(c,true);}).join('')+'</tbody></table></div></div>':
    '<div class="card"><div style="text-align:center;padding:36px;color:#94a3b8">No challans for this client</div></div>';
}
function renderCdPayments() {
  var list = APP.payments.filter(function(p){return p.clientId===currentClientId;}).sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  var pane=el('cdp-payments'); if(!pane) return;
  pane.innerHTML = '<div class="card" style="margin-bottom:12px">'+
    '<div style="display:flex;align-items:center;justify-content:flex-end;margin-bottom:10px">'+
      '<button class="btn btn-success btn-sm" onclick="openPaymentModal('+currentClientId+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Record Payment</button>'+
    '</div>'+
    (list.length ?
      '<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Note</th><th></th></tr></thead><tbody>'+
      list.map(function(p){return '<tr><td>'+fmtD(p.date)+'</td><td style="font-weight:700;color:#15803d">'+fmt(p.amount)+'</td><td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td><td style="color:#64748b;font-size:12px">'+(p.note||'—')+'</td><td><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm" onclick="openEditPaymentModal(\''+p.id+'\')"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="deletePayment(\''+p.id+'\')"><i class="fas fa-trash"></i></button></div></td></tr>';}).join('')+
      '</tbody></table></div>' :
      '<div style="text-align:center;padding:30px;color:#94a3b8">No payments recorded</div>')+
    '</div>';
}
function renderCdLedger() {
  var cId = currentClientId;
  var pane=el('cdp-ledger'); if(!pane) return;
  var cl=APP.clients.find(function(c){return c.id===cId;});
  if(!cl) return;
  var ob=cl.openingBalance||0;

  var allEvents=[];
  APP.challans.filter(function(c){return c.clientId===cId&&c.mode==='credit';}).forEach(function(c){
    allEvents.push({date:c.date,type:'sale',amount:c.total,ref:c.billNo,desc:c.items.map(function(i){return i.name;}).join(', '),items:c.items,notes:c.notes,gstEnabled:c.gstEnabled,id:c.id});
  });
  APP.payments.filter(function(p){return p.clientId===cId;}).forEach(function(p){
    allEvents.push({date:p.date,type:'payment',amount:p.amount,ref:'PMT',desc:p.note||'Payment received',mode:p.mode,upiAccountId:p.upiAccountId});
  });
  allEvents.sort(function(a,b){return new Date(a.date)-new Date(b.date)||(a.type==='payment'?1:-1);});

  // Running balance starts at opening balance, pre-advanced through anything before the from-date
  var running=ob;
  if(_ldFrom){
    allEvents.filter(function(e){return e.date<_ldFrom;}).forEach(function(e){
      if(e.type==='sale') running+=e.amount; else running-=e.amount;
    });
  }
  var filtered=allEvents.filter(function(e){
    if(_ldFrom&&e.date<_ldFrom) return false;
    if(_ldTo&&e.date>_ldTo) return false;
    return true;
  });
  var totalPages=Math.max(1,Math.ceil(filtered.length/_ldPageSize));
  _ldPage=Math.min(_ldPage,totalPages);
  var startIdx=(_ldPage-1)*_ldPageSize;

  // Grand totals over the WHOLE statement (every page), plus the true closing balance
  var openingRun=running;                 // balance entering the filtered range
  var totalDebit=0, totalCredit=0, grandClosing=openingRun;
  filtered.forEach(function(e){
    if(e.type==='sale'){ totalDebit+=e.amount; grandClosing+=e.amount; }
    else { totalCredit+=e.amount; grandClosing-=e.amount; }
  });

  // Carry the running balance FORWARD across pages: advance through every event on
  // earlier pages so page 2+ continues from the previous page's closing balance.
  for(var _i=0;_i<startIdx;_i++){ var _pe=filtered[_i]; if(_pe.type==='sale') running+=_pe.amount; else running-=_pe.amount; }
  var pageOpen=running;                    // balance brought forward into this page
  var pageEvents=filtered.slice(startIdx,startIdx+_ldPageSize);

  var bal=clientBalance(cId);

  function balLabel(v) {
    if(v===0) return {text:'NIL',color:'#475569',badge:'<span style="display:inline-block;margin-left:5px;font-size:9px;font-weight:800;padding:1px 5px;border:1px solid #94a3b8;border-radius:3px;color:#475569;letter-spacing:.04em">CLEAR</span>'};
    if(v>0)  return {text:fmt(v),color:'#b91c1c',badge:'<span style="display:inline-block;margin-left:5px;font-size:9px;font-weight:800;padding:1px 5px;border:1.5px solid #b91c1c;border-radius:3px;color:#b91c1c;letter-spacing:.04em">TO COLLECT</span>'};
    return {text:'('+fmt(Math.abs(v))+')',color:'#15803d',badge:'<span style="display:inline-block;margin-left:5px;font-size:9px;font-weight:800;padding:1px 5px;border:1.5px solid #15803d;border-radius:3px;color:#15803d;letter-spacing:.04em">ADVANCE</span>'};
  }

  var obRow='';
  if(ob!==0&&!_ldFrom&&_ldPage===1){
    var obDateStr=cl.openingBalanceDate?fmtD(cl.openingBalanceDate):'—';
    obRow='<tr style="background:rgba(245,158,11,.12)">'+
      '<td>'+obDateStr+'</td><td><strong>Opening Balance</strong></td>'+
      '<td style="color:#b91c1c;font-weight:700">'+(ob>0?fmt(ob):'—')+'</td>'+
      '<td style="color:#15803d;font-weight:700">'+(ob<0?fmt(Math.abs(ob)):'—')+'</td>'+
      '<td style="font-weight:800;color:'+(ob>0?'#b91c1c':'#15803d')+'">'+fmt(Math.abs(ob))+' '+(ob>0?'Dr':'Cr')+
        '<span style="display:inline-block;margin-left:5px;font-size:9px;font-weight:800;padding:1px 5px;border:1.5px solid currentColor;border-radius:3px;letter-spacing:.04em">OPENING</span>'+
      '</td></tr>';
  }

  // "Balance brought forward" — shown at the top of page 2+ (and when a from-date hides earlier rows)
  var bfRow='';
  if(_ldPage>1 || (_ldFrom&&openingRun!==0)){
    var bfl=balLabel(pageOpen);
    bfRow='<tr style="background:var(--surface)"><td>—</td>'+
      '<td><strong style="color:#64748b">Balance brought forward</strong></td>'+
      '<td style="color:#94a3b8">—</td><td style="color:#94a3b8">—</td>'+
      '<td style="font-weight:800;color:'+bfl.color+'">'+bfl.text+bfl.badge+'</td></tr>';
  }

  var rows=pageEvents.map(function(e){
    var bl;
    if(e.type==='sale'){
      running+=e.amount; bl=balLabel(running);
      return '<tr><td style="vertical-align:top">'+fmtD(e.date)+'</td>'+
        '<td style="vertical-align:top"><strong style="color:#1d4ed8;cursor:pointer" onclick="openChallanView(\''+e.id+'\')">'+e.ref+'</strong>'+ledgerItemsHTML(e)+'</td>'+
        '<td style="color:#b91c1c;font-weight:700;vertical-align:top">'+fmt(e.amount)+'</td>'+
        '<td style="color:#94a3b8;vertical-align:top">—</td>'+
        '<td style="font-weight:800;color:'+bl.color+';vertical-align:top">'+bl.text+bl.badge+'</td></tr>';
    } else {
      running-=e.amount; bl=balLabel(running);
      return '<tr style="background:rgba(34,197,94,.10)"><td>'+fmtD(e.date)+'</td>'+
        '<td><span style="color:#15803d;font-weight:700">Payment</span><br><span style="font-size:11px;color:#64748b">'+e.desc+(e.mode?' <span class="badge badge-'+e.mode+'" style="font-size:10px">'+e.mode.toUpperCase()+(e.mode==='upi'&&e.upiAccountId?' · '+upiAccountName(e.upiAccountId):'')+'</span>':'')+'</span></td>'+
        '<td style="color:#94a3b8">—</td>'+
        '<td style="color:#15803d;font-weight:700">'+fmt(e.amount)+'</td>'+
        '<td style="font-weight:800;color:'+bl.color+'">'+bl.text+bl.badge+'</td></tr>';
    }
  }).join('');

  var pageDebit=pageEvents.filter(function(e){return e.type==='sale';}).reduce(function(s,e){return s+e.amount;},0);
  var pageCredit=pageEvents.filter(function(e){return e.type==='payment';}).reduce(function(s,e){return s+e.amount;},0);
  function totBadge(v){ return '<span style="display:inline-block;margin-left:6px;font-size:9px;font-weight:800;padding:1px 5px;border:1.5px solid currentColor;border-radius:3px;letter-spacing:.04em">'+(v>0?'TO COLLECT':v<0?'ADVANCE':'CLEAR')+'</span>'; }
  // Page Total: this page's debit/credit and the balance carried out AT THE END OF THIS PAGE (running)
  var pageClose=balLabel(running);
  var pageTotalRow='<tr style="background:#0f172a;color:#fff;font-weight:800">'+
    '<td style="padding:11px 13px;font-size:12px;text-transform:uppercase;letter-spacing:.04em" colspan="2">Page Total</td>'+
    '<td style="padding:11px 13px;color:#fca5a5;font-size:14px">'+fmt(pageDebit)+'</td>'+
    '<td style="padding:11px 13px;color:#4ade80;font-size:14px">'+fmt(pageCredit)+'</td>'+
    '<td style="padding:11px 13px;font-size:14px;color:'+pageClose.color+'">'+pageClose.text+totBadge(running)+'</td></tr>';
  // Grand Total: total goods sold vs total collected across the WHOLE statement, with closing balance
  var gClose=balLabel(grandClosing);
  var grandTotalRow='<tr style="background:#7c2d12;color:#fff;font-weight:800">'+
    '<td style="padding:12px 13px;font-size:12px;text-transform:uppercase;letter-spacing:.04em" colspan="2"><i class="fas fa-scale-balanced" style="margin-right:6px"></i>Grand Total — Goods Sold vs Collected</td>'+
    '<td style="padding:12px 13px;color:#fdba74;font-size:14px">'+fmt(totalDebit)+'</td>'+
    '<td style="padding:12px 13px;color:#86efac;font-size:14px">'+fmt(totalCredit)+'</td>'+
    '<td style="padding:12px 13px;font-size:14px;color:'+gClose.color+'">'+gClose.text+totBadge(grandClosing)+'</td></tr>';
  // Per-page total only when paginated; grand total always shown on the last page (or the only page).
  var totalRow=(totalPages>1?pageTotalRow:'')+((_ldPage===totalPages)?grandTotalRow:'');

  var filterUI='<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">'+
    '<label style="font-size:12px;color:#64748b">From</label>'+
    '<input type="date" value="'+_ldFrom+'" onchange="_ldFrom=this.value;_ldPage=1;renderCdLedger()" style="font-size:12px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px">'+
    '<label style="font-size:12px;color:#64748b">To</label>'+
    '<input type="date" value="'+_ldTo+'" onchange="_ldTo=this.value;_ldPage=1;renderCdLedger()" style="font-size:12px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px">'+
    '<button onclick="_ldFrom=\'\';_ldTo=\'\';_ldPage=1;renderCdLedger()" class="btn btn-ghost" style="font-size:12px;padding:4px 10px">Clear</button>'+
  '</div>';

  var pagination='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px">'+
    '<span style="font-size:12px;color:#64748b">'+filtered.length+' entries · Page '+_ldPage+' of '+totalPages+'</span>'+
    '<div style="display:flex;gap:6px">'+
      '<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="_ldPage=Math.max(1,_ldPage-1);renderCdLedger()" '+((_ldPage<=1)?'disabled':'')+'>‹ Prev</button>'+
      '<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="_ldPage=Math.min('+totalPages+',_ldPage+1);renderCdLedger()" '+((_ldPage>=totalPages)?'disabled':'')+'>Next ›</button>'+
    '</div>'+
  '</div>';

  var pdfBtns='<div style="display:flex;gap:8px;flex-wrap:wrap">'+
    '<button class="btn" style="background:#dc5800;color:#fff;font-size:12px;padding:6px 12px" onclick="downloadLedgerPDF('+cId+')"><i class="fas fa-file-pdf" style="margin-right:4px"></i>Full PDF</button>'+
    ((_ldFrom||_ldTo)?'<button class="btn" style="background:#7c3aed;color:#fff;font-size:12px;padding:6px 12px" onclick="downloadLedgerPDF('+cId+',\''+_ldFrom+'\',\''+_ldTo+'\')"><i class="fas fa-filter" style="margin-right:4px"></i>Filtered PDF</button>':'')+
    '<button class="btn btn-success btn-sm" onclick="openPaymentModal('+cId+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Record Payment</button>'+
  '</div>';

  pane.innerHTML='<div class="card">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">'+
      '<div style="font-weight:700;font-size:13px;color:var(--text)">Account Statement</div>'+
      pdfBtns+
    '</div>'+
    filterUI+
    (allEvents.length?
      '<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Particulars</th><th style="color:#b91c1c">Debit (Sales)</th><th style="color:#15803d">Credit (Payments)</th><th>Balance</th></tr></thead><tbody>'+obRow+bfRow+rows+'</tbody><tfoot>'+totalRow+'</tfoot></table></div>'+
      (totalPages>1?pagination:''):
      '<div style="text-align:center;padding:30px;color:#94a3b8">No credit transactions yet.</div>')+
    '</div>';
}

// ═══ FOLLOW-UPS PAGE ═══
function renderFollowups() {
  var clients = cClients().map(function(cl){
    var s = clientStats(cl.id);
    var r = riskLevel(s.oldest, s.os);
    return {cl:cl, s:s, r:r};
  }).filter(function(x){return x.s.os>0;});

  clients.sort(function(a,b){
    var order={Critical:0,High:1,Medium:2,Low:3};
    return (order[a.r.label]||4)-(order[b.r.label]||4)||(b.s.os-a.s.os);
  });

  var totalOS = clients.reduce(function(s,x){return s+x.s.os;},0);
  var critical = clients.filter(function(x){return x.r.label==='Critical';}).length;
  var high     = clients.filter(function(x){return x.r.label==='High';}).length;

  var statsEl = el('fu-stats');
  if(statsEl) statsEl.innerHTML=
    '<div class="stat-card"><div class="icon-box" style="background:#fee2e2"><i class="fas fa-rupee-sign" style="color:#b91c1c"></i></div><div><div class="stat-label">Total Outstanding</div><div class="stat-val" style="color:#b91c1c">'+fmt(totalOS)+'</div><div class="stat-hint">'+clients.length+' clients</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#450a0a"><i class="fas fa-skull" style="color:#fca5a5"></i></div><div><div class="stat-label">Critical (90+ days)</div><div class="stat-val" style="color:#ef4444">'+critical+'</div><div class="stat-hint">Immediate action</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#fee2e2"><i class="fas fa-exclamation-triangle" style="color:#dc2626"></i></div><div><div class="stat-label">High Risk (61-90d)</div><div class="stat-val" style="color:#dc2626">'+high+'</div><div class="stat-hint">Urgent follow-up</div></div></div>';

  var fuCnt=el('nav-fu-cnt');
  if(fuCnt){fuCnt.textContent=clients.length;fuCnt.style.display=clients.length?'':'none';}

  var listEl=el('fu-list');
  if(!listEl) return;
  if(!clients.length){ listEl.innerHTML='<div class="card" style="text-align:center;padding:40px"><i class="fas fa-check-circle" style="font-size:36px;color:#22c55e;display:block;margin-bottom:10px"></i><div style="font-weight:700;color:var(--text);font-size:16px">All Clear!</div><div style="color:#94a3b8;margin-top:5px">No outstanding dues from any client.</div></div>'; return; }

  var riskCls={Critical:'rc',High:'rh',Medium:'rm',Low:'rl'};
  listEl.innerHTML = clients.map(function(x){
    var cl=x.cl, s=x.s, r=x.r;
    var laD = cl.lastAsked ? daysOld(cl.lastAsked) : null;
    return '<div class="fu-card '+riskCls[r.label]+'">'+
      '<div style="flex:1;min-width:0">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'+
          '<div style="font-weight:700;font-size:14px;cursor:pointer;color:var(--text)" onclick="openCustomerDetail('+cl.id+',\'followups\')">'+cl.name+'</div>'+
          '<span class="badge '+r.cls+'">'+r.label+'</span>'+
        '</div>'+
        '<div style="font-size:12px;color:#64748b">Outstanding: <strong style="color:#b91c1c">'+fmt(s.os)+'</strong> · Oldest: <strong>'+s.oldest+'d</strong> · Last asked: <strong>'+(laD!==null?laD+'d ago':'<span style="color:#b91c1c">Never!</span>')+'</strong></div>'+
      '</div>'+
      '<div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">'+
        '<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="openCustomerDetail('+cl.id+',\'followups\')">View</button>'+
        '<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="markAskedToday('+cl.id+')" title="Mark asked today"><i class="fas fa-phone" style="margin-right:3px"></i>Asked</button>'+
        '<button class="btn btn-success btn-sm" style="font-size:11px" onclick="openPaymentModal('+cl.id+')"><i class="fas fa-rupee-sign" style="margin-right:3px"></i>Pay</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ═══ BOTTOM NAV MOBILE ═══
function toggleMobileMore() {
  el('bn-more').classList.toggle('open');
  el('bn-ov').classList.toggle('open');
}
function closeMobileMore() {
  el('bn-more').classList.remove('open');
  el('bn-ov').classList.remove('open');
}

// ═══ REFRESH ALL ═══
function refreshAll() {
  clearAllocCache();
  populateClientSelects();
  if (typeof populateSupplierSelects === 'function') populateSupplierSelects();
  renderDashboard();
  renderDailyBook();
  renderChallans();
  renderCustomers();
  renderFollowups();
  renderProducts();
  renderCompanies();
  renderMonthly();
  renderAging();
  renderPayments();
  if (typeof renderPurchases === 'function') {
    renderPurchases();
    renderSuppliers();
    renderSupplierPayments();
    renderPurchaseFollowups();
    renderPayablesAging();
    renderUpiReport();
  }
  updateCoSwitcher();
}

// ═══════════════════════════════════════════════
//  DELIVERY CHALLAN PRINT TEMPLATE
// ═══════════════════════════════════════════════
function closeChallanPrint(){
  var ov=el('cp-ov'); if(ov) ov.classList.remove('open');
  setCpPaperSize('a5');
}

var _cpPaperSize='a5';
function setCpPaperSize(size){
  _cpPaperSize=size;
  var ov=document.getElementById('cp-pg-override');
  if(ov) ov.remove();
  if(size==='a4'){
    var s=document.createElement('style');
    s.id='cp-pg-override';
    s.textContent='@page{margin:0;size:A4 portrait}';
    document.head.appendChild(s);
  }
  var sheet=el('cp-sheet');
  if(sheet){
    if(size==='a4'){ sheet.style.maxWidth='790px'; sheet.style.minHeight='1120px'; }
    else           { sheet.style.maxWidth='';      sheet.style.minHeight='';      }
  }
  ['a5','a4'].forEach(function(sz){
    var btn=el('cp-sz-'+sz);
    if(btn) btn.style.background=sz===size?'#0f172a':'#374151';
  });
}

function _buildChallanHalf(ch, client, co){
  // Company initials (skip Pvt/Ltd)
  var words=(co.name||'').replace(/pvt\.?|ltd\.?|private|limited/gi,'').trim().split(/\s+/).filter(Boolean);
  var initials=words.slice(0,2).map(function(w){return (w[0]||'').toUpperCase();}).join('');
  if(!initials) initials='C';

  var city=co.city||'Local';
  if(!co.city&&co.address){
    var ap=co.address.split(',');
    var last=(ap[ap.length-1]||'').replace(/\d/g,'').trim();
    if(last) city=last;
  }

  // Field values
  var billNo    = ch ? esc(ch.billNo||'')     : '';
  var refBillNo = ch ? esc(ch.refBillNo||'')  : '';
  var billDate  = ch ? esc(fmtD(ch.date))     : '';
  var vehicleNo = ch ? esc(ch.vehicleNo || '') : '';
  var showDcNo  = ch ? (ch.showDcNo !== undefined && ch.showDcNo !== null ? ch.showDcNo : 1) : 1;
  var toName    = client ? esc(client.name||'')    : '';
  var toAddr    = client ? esc(client.address||'') : '';
  var toPhone   = client ? esc(client.phone||'')   : '';
  var toGst     = client ? esc(client.gstin||client.gst||'') : '';

  // Rows — stretch to fill page via flex+height:1px trick
  var items=(ch&&ch.items)?ch.items:[];
  var gstEnabled=ch&&ch.gstEnabled;   // declared here so MIN_ROWS reads the real value (was a var-hoisting bug)
  var MIN_ROWS=gstEnabled?9:12;  // 3 GST tfoot rows displace 3 filler body rows
  var rowHTML='', grandTotal=0;
  var totalRows=Math.max(MIN_ROWS, items.length);
  for(var i=0;i<totalRows;i++){
    var it=items[i]||null;
    if(it){
      grandTotal+=(it.lt||0);
      rowHTML+='<tr>'+
        '<td class="tc">'+(i+1)+'</td>'+
        '<td class="tl" contenteditable="true">'+esc(it.name)+(it.size?' — '+esc(it.size):'')+'</td>'+
        '<td class="tr" contenteditable="true">'+esc(String(it.qty))+'</td>'+
        '<td class="tc" contenteditable="true">'+esc((it.unit==='charge'?'':it.unit||''))+'</td>'+
        '<td class="tr" contenteditable="true">'+'₹'+fmtPdf(it.price)+'</td>'+
        '<td class="tr" contenteditable="true">'+'₹'+fmtPdf(it.lt)+'</td>'+
      '</tr>';
    } else {
      rowHTML+='<tr>'+
        '<td class="tc" style="height:26px"></td>'+
        '<td contenteditable="true"></td>'+
        '<td contenteditable="true"></td>'+
        '<td contenteditable="true"></td>'+
        '<td contenteditable="true"></td>'+
        '<td contenteditable="true"></td>'+
      '</tr>';
    }
  }

  // Black address bar — 2 lines: address | mobiles + GSTIN
  var addrLine1=esc(formatCompanyAddress(co)||co.address||'');
  var mob=co.mobile||co.phone||'';
  var mob2=co.mobile2||co.phone2||'';
  var gst=co.gstin||co.gst||'';
  var addrLine2='';
  if(mob) addrLine2+='M : '+esc(mob);
  if(mob2) addrLine2+=' | '+esc(mob2);
  if(gst) addrLine2+=(addrLine2?'&nbsp;&nbsp;&nbsp;&nbsp;':'')+'GSTIN : '+esc(gst);
  var addrBar=addrLine1+(addrLine2?'<br>'+addrLine2:'');

  // GST breakdown rows for tfoot (gstEnabled already declared above)

  // Address row count — fit content, cap at 3
  var addrRows=1;
  if(toAddr){
    var _addrLines=toAddr.split(/\n/);
    addrRows=_addrLines.reduce(function(acc,l){return acc+Math.ceil((l.length||1)/38);},0);
    addrRows=Math.min(2,Math.max(1,addrRows));
  }

  return '<div class="cph">'+
    // Religious text + DELIVERY CHALLAN label
    '<div class="cph-top" style="position:relative;">'+
      '<div class="cph-reli">&#2404;&#2404; &#2358;&#2381;&#2352;&#2368; &#2327;&#2339;&#2375;&#2358;&#2366;&#2351; &#2344;&#2350;&#2307; &#2404;&#2404;</div>'+
      '<div class="cph-dlabel" style="position:absolute;right:10px;top:2px">'+esc((ch&&ch.challanLabel)||'DELIVERY CHALLAN')+'</div>'+
    '</div>'+
    // Logo circle + company name + type
   '<div class="cph-logo-row">'+
  '<div style="width:90px;display:flex;justify-content:center;align-items:center;flex-shrink:0">'+
    renderCompanyLogo(co,70)+
  '</div>'+
  '<div style="flex:1;padding-right:170px">'+
    '<div class="cph-nm">'+esc(co.name)+'</div>'+
    '<div class="cph-type">'+esc(co.tagline||'')+'</div>'+
  '</div>'+
'</div>'+
    // Black address bar
    '<div class="cph-addr-bar">'+addrBar+'</div>'+
    // BORDERED To: box (Riddhi Steel style)
    '<div class="cph-billto">'+
      '<div class="cph-to">'+
        '<div class="cph-to-lbl">To,</div>'+
        '<input class="cph-to-inp" value="'+toName+'" placeholder="Party name…"/>'+
        '<div class="cph-to-meta" style="flex-direction:column;align-items:flex-start;margin-bottom:3px">'+
          '<span class="cph-to-meta-lbl" style="margin-bottom:1px">Address :</span>'+
          '<textarea class="cph-to-inp-inline cph-to-addr" rows="'+addrRows+'" placeholder="Address…">'+toAddr+'</textarea>'+
        '</div>'+
        (toGst?'<div class="cph-to-meta"><span class="cph-to-meta-lbl">GST No :</span><input class="cph-to-inp-inline" value="'+toGst+'"/></div>':'')+
        '<div class="cph-to-meta"><span class="cph-to-meta-lbl">Mobile No :</span><input class="cph-to-inp-inline" value="'+toPhone+'" placeholder="—"/></div>'+
      '</div>'+
      '<div class="cph-refs">'+
        (showDcNo?'<div class="cph-ref"><span class="cph-rl">DC No. :</span><input class="cph-rv" value="'+billNo+'"/></div>':'')+
        '<div class="cph-ref"><span class="cph-rl">Date :</span><input class="cph-rv" value="'+billDate+'"/></div>'+
        '<div class="cph-ref"><span class="cph-rl">Bill No. :</span><input class="cph-rv" value="'+refBillNo+'" placeholder="—"/></div>'+
        '<div class="cph-ref"><span class="cph-rl">Vehicle :</span><input class="cph-rv" value="'+vehicleNo+'" placeholder="GJ01AB1234"/></div>'+
      '</div>'+
    '</div>'+
    // Items table fills remaining height via flex:1
    '<div class="cph-tbl-wrap">'+
      '<div class="cph-wm">'+esc(initials)+'</div>'+
      '<table class="cph-tbl">'+
        '<colgroup>'+
          '<col style="width:5%">'+
          '<col style="width:46%">'+
          '<col style="width:13%">'+
          '<col style="width:8%">'+
          '<col style="width:10%">'+
          '<col style="width:18%">'+
        '</colgroup>'+
        '<thead><tr>'+
          '<th>NO.</th>'+
          '<th class="tl">DESCRIPTION</th>'+
          '<th>QTY</th><th>UNIT</th><th>RATE</th><th>AMOUNT</th>'+
        '</tr></thead>'+
        '<tbody>'+rowHTML+'</tbody>'+
        (function(){
          // Qty by unit (case-insensitive)
          var unitMap={};
          items.forEach(function(it){
            if(!it||!it.qty) return;
            var u=((it.unit==='charge'?'':it.unit||'')).trim().toUpperCase()||'UNIT';
            unitMap[u]=(unitMap[u]||0)+(it.qty||0);
          });
          var unitKeys=Object.keys(unitMap);
          var qtySummaryStr=unitKeys.length
            ? unitKeys.map(function(u){return u+' : '+parseFloat(unitMap[u].toFixed(4));}).join('  |  ')
            : '—';
          // GST breakdown with proper rounding
          var cgst=0,sgst=0,displayTotal=grandTotal,base=grandTotal;
          if(gstEnabled&&grandTotal>0){
            base=ch&&ch.total?+(ch.total/1.18).toFixed(2):+(grandTotal).toFixed(2);
            cgst=+(base*0.09).toFixed(2); sgst=+(base*0.09).toFixed(2);
            displayTotal=+(base+cgst+sgst).toFixed(2);
          }
          // Non-GST: single full-width row with qty + total, then notes
          if(!gstEnabled){
            return '<tfoot>'+
              '<tr>'+
                '<td colspan="6" style="padding:0;border-top:2px solid #000">'+
                  '<div style="display:flex;align-items:stretch">'+
                    '<div style="flex:1;padding:4px 8px;font-size:9pt;font-weight:800;letter-spacing:.03em">'+
                      'Total Qty : '+esc(qtySummaryStr)+
                    '</div>'+
                    '<div style="width:1.5px;background:#555;flex-shrink:0"></div>'+
                    '<div style="padding:4px 8px;font-size:10.5pt;font-weight:800;white-space:nowrap">'+
                      'TOTAL : &#8377; '+fmtPdf(displayTotal)+
                    '</div>'+
                  '</div>'+
                '</td>'+
              '</tr>'+
              '<tr>'+
                '<td colspan="6" style="padding:0;border-top:1px solid #bbb">'+
                  '<div style="padding:2px 6px 1px;font-size:7.5pt;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.07em">Notes / Remarks</div>'+
                  '<div contenteditable="true" style="padding:3px 6px;font-size:9pt;min-height:40px;outline:none">'+
                    (ch&&ch.notes?esc(ch.notes):'')+
                  '</div>'+
                '</td>'+
              '</tr>'+
            '</tfoot>';
          }
          // Right column — financials with ₹
          var bdr='border-top:1px solid #bbb;';
          var rightRows='';
          if(gstEnabled&&grandTotal>0){
            rightRows+=
              '<tr><td class="tr" style="padding:3px 6px;font-size:9pt;font-weight:600;border-top:1.5px solid #555">Sub Total</td>'+
                '<td class="tr" style="padding:3px 6px;font-size:9pt;border-top:1.5px solid #555">&#8377; '+fmtPdf(base)+'</td></tr>'+
              '<tr><td class="tr" style="padding:3px 6px;font-size:9pt;font-weight:600;'+bdr+'">CGST @ 9%</td>'+
                '<td class="tr" style="padding:3px 6px;font-size:9pt;'+bdr+'">&#8377; '+fmtPdf(cgst)+'</td></tr>'+
              '<tr><td class="tr" style="padding:3px 6px;font-size:9pt;font-weight:600;'+bdr+'">SGST @ 9%</td>'+
                '<td class="tr" style="padding:3px 6px;font-size:9pt;'+bdr+'">&#8377; '+fmtPdf(sgst)+'</td></tr>';
          }
          rightRows+=
            '<tr>'+
              '<td class="tr" style="padding:4px 6px;font-size:10pt;font-weight:800;border-top:2px solid #000">TOTAL</td>'+
              '<td class="tr" style="padding:4px 6px;font-size:10pt;font-weight:800;border-top:2px solid #000">'+
                (displayTotal>0?'&#8377; '+fmtPdf(displayTotal):'')+
              '</td>'+
            '</tr>';
          // Left column — Total Qty + NOTES/REMARKS label + editable notes
          var leftCell=
            '<div style="padding:5px 6px;font-size:8.5pt;font-weight:800;border-bottom:1.5px solid #555;letter-spacing:.03em">'+
              'Total Qty : '+esc(qtySummaryStr)+
            '</div>'+
            '<div style="padding:2px 6px 1px;font-size:7.5pt;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.07em">Notes / Remarks</div>'+
            '<div contenteditable="true" style="padding:3px 6px;font-size:9pt;min-height:40px;outline:none">'+
              (ch&&ch.notes?esc(ch.notes):'')+
            '</div>';
          return '<tfoot>'+
            '<tr>'+
              '<td colspan="3" style="vertical-align:top;padding:0;border-top:1.5px solid #555;border-right:1.5px solid #555">'+leftCell+'</td>'+
              '<td colspan="3" style="padding:0;vertical-align:top;border-top:1.5px solid #555">'+
                '<table style="width:100%;border-collapse:collapse">'+rightRows+'</table>'+
              '</td>'+
            '</tr>'+
          '</tfoot>';
        })()+
      '</table>'+
    '</div>'+
    '<div class="cph-foot">'+
      '<div class="cph-foot-l">'+
        '<div class="cph-terms">'+(co.footerText?esc(co.footerText):'&#8226; Goods once sold will not be taken back or exchanged.&nbsp;E.&amp;O.E<br>&#8226; Subject to '+esc(city)+' Jurisdiction')+'</div>'+
        '<div class="cph-rcv">Receiver\'s Signature</div>'+
      '</div>'+
      '<div class="cph-foot-r"><div class="cph-for">For, '+esc(co.name)+'</div>'+(co.authorizedSignatory||co.proprietor?'<div style="font-size:9pt;text-align:right;margin-top:4px">'+esc(co.authorizedSignatory||co.proprietor)+'</div>':'')+'</div>'+
    '</div>'+
  '</div>';
}

function printDeliveryChallan(id){
  var ch=APP.challans.find(function(c){return c.id===id;});
  if(!ch){ toast('Challan not found','t-del'); return; }
  var client=APP.clients.find(function(c){return c.id===ch.clientId;});
  var co=getCompanyForChallan(ch);
  applyCompanyTheme(co);
  el('cp-sheet').innerHTML=_buildChallanHalf(ch,client,co);
  var ref=el('cp-ref');
  if(ref) ref.textContent='DC No: '+ch.billNo+(ch.refBillNo?' | Bill: '+ch.refBillNo:'')+' — '+(client?client.name:'—');
  var ov=el('cp-ov');
  ov.classList.add('open');
  ov.scrollTop=0;
}

// ═══════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',async function(){
  if(!await checkAuth())return;
  await loadStore();
  el('cur-date').textContent=new Date(TODAY).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  populateClientSelects();
  if (typeof populateSupplierSelects === 'function') populateSupplierSelects();
  updateCoSwitcher();
  renderDashboard();
  renderDailyBook();
  renderChallans();
  renderCustomers();
  renderFollowups();
  renderProducts();
  renderCompanies();
  renderMonthly();
  renderAging();
  renderPayments();
  if (typeof renderPurchases === 'function') {
    renderPurchases();
    renderSuppliers();
    renderSupplierPayments();
    renderPurchaseFollowups();
    renderPayablesAging();
    renderUpiReport();
  }
  setupAdminUI();
  if (CURRENT_USER?.role === 'admin') {
    const bnUsers = el('bn-users');
    if (bnUsers) bnUsers.style.display = '';
  }
  nav('dashboard');
});
