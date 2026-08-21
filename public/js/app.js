// ═══════════════════════════════════════════════
//  SIDEBAR TOGGLE (mobile)
// ═══════════════════════════════════════════════
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.toggle('mobile-open');
  ov.classList.toggle('active');
  document.body.classList.toggle('sidebar-open');
}
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebar-overlay');
  sb.classList.remove('mobile-open');
  ov.classList.remove('active');
  document.body.classList.remove('sidebar-open');
}

// ═══════════════════════════════════════════════
//  SEED DATA
// ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════
//  STORE
// ═══════════════════════════════════════════════
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ═══════════════════════════════════════════════
//  COMPUTED  — client-level FIFO payment model
// ═══════════════════════════════════════════════
let _allocCache = {};
function clearAllocCache() { _allocCache = {}; }

function computeAllocation(clientId) {
  const creditChs = APP.challans
    .filter(c => c.clientId === clientId && c.mode === 'credit')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  let remaining = APP.payments
    .filter(p => p.clientId === clientId)
    .reduce((s, p) => s + p.amount, 0);
  const alloc = {};
  for (const ch of creditChs) {
    if (remaining <= 0) break;
    const apply = Math.min(remaining, ch.total);
    alloc[ch.id] = apply;
    remaining -= apply;
  }
  return { alloc, advance: Math.max(0, remaining) };
}

function getClientAlloc(clientId) {
  if (!_allocCache[clientId]) _allocCache[clientId] = computeAllocation(clientId);
  return _allocCache[clientId];
}

function clientBalance(clientId) {
  const cl = APP.clients.find(c => c.id === clientId);
  const ob = cl ? (cl.openingBalance || 0) : 0;
  const creditSales = APP.challans
    .filter(c => c.clientId === clientId && c.mode === 'credit')
    .reduce((s, c) => s + c.total, 0);
  const totalPaid = APP.payments
    .filter(p => p.clientId === clientId)
    .reduce((s, p) => s + p.amount, 0);
  return ob + creditSales - totalPaid;
}

function paidAmt(ch) {
  if (ch.mode !== 'credit') return ch.total;
  return getClientAlloc(ch.clientId).alloc[ch.id] || 0;
}
function outstanding(ch) {
  if (ch.mode !== 'credit') return 0;
  return ch.total - paidAmt(ch);
}
function challanStatus(ch) {
  if (ch.mode !== 'credit') return 'paid';
  const pa = paidAmt(ch);
  if (pa >= ch.total) return 'paid';
  if (pa > 0) return 'partial';
  return 'pending';
}
function daysOld(date) { return Math.floor((new Date(TODAY) - new Date(date)) / 86400000); }

function clientStats(id) {
  const chs = APP.challans.filter(c => c.clientId === id);
  const totalSales = chs.reduce((s, c) => s + c.total, 0);
  const totalPaid  = APP.payments.filter(p => p.clientId === id).reduce((s, p) => s + p.amount, 0);
  const bal = clientBalance(id);
  const os      = Math.max(0, bal);
  const advance = Math.max(0, -bal);
  const sorted  = [...chs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const lastCh  = sorted[0];
  const lastPmt = [...APP.payments.filter(p => p.clientId === id)].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const pending = chs.filter(c => c.mode === 'credit' && outstanding(c) > 0);
  const oldest  = pending.length ? Math.max(...pending.map(c => daysOld(c.date))) : 0;
  return { totalSales, totalPaid, os, advance, lastCh, lastPmt, oldest };
}
function agingBuckets(clientId) {
  const src = clientId
    ? APP.challans.filter(c => c.clientId === clientId && c.mode === 'credit')
    : cChallans().filter(c => c.mode === 'credit');
  return src.filter(c => outstanding(c) > 0).reduce((a, c) => {
    const d = daysOld(c.date), o = outstanding(c);
    if (d <= 30) a.b0 += o; else if (d <= 60) a.b31 += o; else if (d <= 90) a.b61 += o; else a.b90 += o;
    return a;
  }, {b0:0, b31:0, b61:0, b90:0});
}
function riskLevel(oldest, os) {
  if (os <= 0)     return {label:'Clear',    cls:'badge-clear'};
  if (oldest > 90) return {label:'Critical', cls:'badge-critical'};
  if (oldest > 60) return {label:'High',     cls:'badge-high'};
  if (oldest > 30) return {label:'Medium',   cls:'badge-medium'};
  return                  {label:'Low',      cls:'badge-low'};
}
function markAskedToday(clientId) {
  const cl = APP.clients.find(c => c.id === clientId);
  if (!cl) return;
  cl.lastAsked = TODAY;
  saveStore();
  renderAging(); renderClients(); renderDashboard();
  if(el('page-followups')&&el('page-followups').classList.contains('active')) renderFollowups();
  if(el('page-customer-detail')&&el('page-customer-detail').classList.contains('active')) renderCustomerDetail();
}

// ═══════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════
function fmtN(n) { return '₹'+Math.abs(n).toLocaleString('en-IN'); }
/* fmt() wraps the amount in a .amt span so Privacy mode can blur it in any HTML context.
   Use fmtN() where the result goes into textContent / input value / chart labels / PDFs. */
function fmt(n) { return '<span class="amt">'+fmtN(n)+'</span>'; }
function fmtPdf(n) {
  return Math.abs(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function fmtD(d) { return d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }
// Short unit label for line items (kg was previously mis-shown as 'm'); charge => blank
function unitLabel(u){ var m={piece:'pcs',kg:'kg',meter:'m',charge:''}; return (u in m)?m[u]:'m'; }
function clientName(id) { return APP.clients.find(c=>c.id===id)?.name || '—'; }
function nextBillNo(seriesId, dateStr) {
  // Non-GST (normal series) numbers from the SELECTED CLIENT's own series (PREFIX/MON/NN);
  // GST/Hide keep the legacy per-series prefix+NNN.
  const d = dateStr || (el('ch-date') && el('ch-date').value) || TODAY;
  let s = seriesId ? APP.dcSeries.find(x => x.id === seriesId) : null;
  if (!s) s = APP.dcSeries.find(x => x.companyId === APP.activeCompanyId);
  const type = s ? (s.seriesType || 'normal') : 'normal';
  if (type === 'normal') {
    const cid = parseInt(el('ch-client') && el('ch-client').value) || 0;
    const cl = cid ? APP.clients.find(c => c.id === cid) : null;
    if (!cl) return '';   // no client selected yet → filled once a client is chosen
    const c = seriesNextCounter(cl.chalStartNumber, cl.chalSeqPeriod, cl.chalNextNumber, d);
    return seriesFormatNo(cl.chalPrefix, d, c);
  }
  return (s.prefix || '') + String(s.nextNumber || s.startNumber || 1).padStart(3, '0');
}
function onSeriesChange() {
  var sid = parseInt(el('ch-series')?.value) || 0;
  var s = sid ? APP.dcSeries.find(function(x){return x.id===sid;}) : null;
  var billInp = el('ch-bill');
  if (billInp) billInp.value = nextBillNo(sid);
  applySeriesTypeToModal(s);
  // Re-run the client guard so switching series also surfaces the non-GST
  // "no prefix" warning (and refreshes the number from the selected client).
  if (typeof onChallanClientChange === 'function') onChallanClientChange();
}
function applySeriesTypeToModal(s) {
  var billInp = el('ch-bill');
  var showDcnoCheck = el('ch-show-dcno');
  if (!billInp) return;
  var sType = s ? (s.seriesType || 'normal') : 'normal';
  if (sType === 'gst') {
    // GST: auto-assigned, user must not change it
    billInp.readOnly = true;
    billInp.style.cssText = 'background:var(--surface-2);color:#64748b;border-color:#e2e8f0';
    if (showDcnoCheck) { showDcnoCheck.checked = true; showDcnoCheck.disabled = false; }
  } else if (sType === 'hide') {
    // Hide: DC No hidden from print, no point editing
    billInp.readOnly = true;
    billInp.style.cssText = 'background:var(--surface-2);color:#64748b;border-color:#e2e8f0';
    if (showDcnoCheck) { showDcnoCheck.checked = false; showDcnoCheck.disabled = true; }
  } else {
    // Normal: fully editable
    billInp.readOnly = false;
    billInp.style.cssText = '';
    if (showDcnoCheck) { showDcnoCheck.disabled = false; }
  }
}
function _smTypeOpts(cur) {
  return [{v:'normal',l:'Normal'},{v:'gst',l:'GST'},{v:'hide',l:'Hide'}].map(function(t){
    return '<option value="'+t.v+'"'+(cur===t.v?' selected':'')+'>'+t.l+'</option>';
  }).join('');
}
function _smRowHtml(s) {
  return '<tr>'+
    '<td><input class="inp" id="sm-name-'+s.id+'" value="'+s.name+'" style="font-size:12px"></td>'+
    '<td><input class="inp" id="sm-prefix-'+s.id+'" value="'+s.prefix+'" style="font-size:12px;width:90px" placeholder="e.g. 2526/"></td>'+
    '<td><select class="inp" id="sm-type-'+s.id+'" style="font-size:12px;padding:3px 5px">'+_smTypeOpts(s.seriesType)+'</select></td>'+
    '<td style="text-align:center"><input class="inp" id="sm-start-'+s.id+'" type="number" min="1" value="'+(s.startNumber||1)+'" style="font-size:12px;width:64px;text-align:center"></td>'+
    '<td style="text-align:center">'+
      '<button onclick="saveSeriesRow('+s.id+')" style="background:#dbeafe;color:#1d4ed8;border:none;border-radius:5px;padding:3px 9px;font-size:12px;cursor:pointer;margin-right:4px">Save</button>'+
      '<button onclick="deleteSeriesRow('+s.id+')" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:5px;padding:3px 9px;font-size:12px;cursor:pointer">Del</button>'+
    '</td>'+
  '</tr>';
}
function openSeriesManagerModal() {
  function seriesRows() {
    if (!APP.dcSeries.length) return '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px">No series yet</td></tr>';
    return APP.dcSeries.map(_smRowHtml).join('');
  }
  var html =
    '<table style="width:100%;border-collapse:collapse;margin-bottom:14px">'+
      '<thead><tr style="font-size:11px;color:#475569;font-weight:700;text-transform:uppercase">'+
        '<th style="text-align:left;padding:6px 4px">Name</th>'+
        '<th style="text-align:left;padding:6px 4px">Prefix</th>'+
        '<th style="text-align:left;padding:6px 4px">Type</th>'+
        '<th style="text-align:center;padding:6px 4px">Start#</th>'+
        '<th></th>'+
      '</tr></thead>'+
      '<tbody id="sm-rows">'+seriesRows()+'</tbody>'+
    '</table>'+
    '<div style="font-size:11px;color:#64748b;margin-bottom:10px"><b>Normal</b> type &rarr; <b>PREFIX/MON/NN</b>, resets each month (e.g. <b>AP/'+seriesMonOf(TODAY)+'/01</b>). <b>GST</b> &amp; <b>Hide</b> keep <b>PREFIX+number</b> (continuous, e.g. <b>GST001</b>).</div>'+
    '<div style="border-top:1px solid #e2e8f0;padding-top:12px;display:grid;grid-template-columns:1fr 100px 100px 70px auto;gap:8px;align-items:flex-end">'+
      '<div><label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">New Series Name</label><input class="inp" id="sm-new-name" placeholder="e.g. GST Series" style="margin-top:4px"></div>'+
      '<div><label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Prefix</label><input class="inp" id="sm-new-prefix" placeholder="2526/" style="margin-top:4px"></div>'+
      '<div><label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Type</label><select class="inp" id="sm-new-type" style="margin-top:4px">'+_smTypeOpts('normal')+'</select></div>'+
      '<div><label style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase">Start#</label><input class="inp" id="sm-new-start" type="number" value="1" min="1" style="margin-top:4px"></div>'+
      '<button onclick="addSeriesRow()" style="height:38px;background:#1d4ed8;color:#fff;border:none;border-radius:7px;padding:0 14px;font-weight:600;font-size:13px;cursor:pointer">+ Add</button>'+
    '</div>';
  openModal2('Manage DC Series', html);
  el('modal2-foot').innerHTML = '<button class="btn btn-ghost" onclick="refreshSeriesAndClose()">Done</button>';
}
async function addSeriesRow() {
  var name = (el('sm-new-name')?.value||'').trim();
  var prefix = (el('sm-new-prefix')?.value||'').trim();
  var seriesType = el('sm-new-type')?.value || 'normal';
  var start = parseInt(el('sm-new-start')?.value)||1;
  if (!name) { alert('Series name is required.'); return; }
  var s = await API.post('/dc-series?companyId='+APP.activeCompanyId, {name, prefix, seriesType, startNumber:start, nextNumber:start});
  APP.dcSeries.push(s);
  el('sm-rows').innerHTML = APP.dcSeries.map(_smRowHtml).join('');
  if(el('sm-new-name')) el('sm-new-name').value='';
  if(el('sm-new-prefix')) el('sm-new-prefix').value='';
  toast('Series added');
}
async function saveSeriesRow(id) {
  var name = (el('sm-name-'+id)?.value||'').trim();
  var prefix = (el('sm-prefix-'+id)?.value||'');
  var seriesType = el('sm-type-'+id)?.value || 'normal';
  var startNumber = parseInt(el('sm-start-'+id)?.value)||1;
  if (!name) { alert('Name required.'); return; }
  var s = await API.put('/dc-series/'+id, {name, prefix, seriesType, startNumber});
  var idx = APP.dcSeries.findIndex(function(x){return x.id===id;});
  if (idx >= 0) APP.dcSeries[idx] = s;
  toast('Series saved');
}
async function deleteSeriesRow(id) {
  if (!confirm('Delete this series?')) return;
  await API.del('/dc-series/'+id);
  APP.dcSeries = APP.dcSeries.filter(function(x){return x.id!==id;});
  el('sm-rows').innerHTML = APP.dcSeries.length
    ? APP.dcSeries.map(_smRowHtml).join('')
    : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:12px">No series yet</td></tr>';
  toast('Series deleted','t-del');
}
function refreshSeriesAndClose() { closeModal2(); }

function validateBillNo(input, selfId){
  var val=(input.value||'').trim();
  var err=el('ch-bill-err');
  var exists=APP.challans.some(function(c){return c.billNo===val&&c.id!==selfId;});
  if(err) err.style.display=exists?'':'none';
  input.style.borderColor=exists?'#dc2626':'';
  return !exists;
}
const CHARTS = {};
function mkChart(id, cfg) { if(CHARTS[id]) CHARTS[id].destroy(); const c = document.getElementById(id); if(!c) return; CHARTS[id]=new Chart(c,cfg); }
function el(id){ return document.getElementById(id); }
function toast(msg, type='t-ok') {
  const t = document.createElement('div');
  t.className = 'toast '+type;
  t.textContent = msg;
  el('toast-wrap').appendChild(t);
  requestAnimationFrame(()=>requestAnimationFrame(()=>t.classList.add('show')));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),220);},2600);
}
function buildMonthOptions(selId, withAll, sourceDates) {
  const sel = el(selId); if(!sel) return;
  const prev = sel.value;
  // Default month set = sales dates; callers (e.g. Purchases) may pass their own date list
  const dates = sourceDates || cChallans().map(c=>c.date);
  const mSet = new Set(dates.filter(Boolean).map(d=>d.slice(0,7)));
  mSet.add(TODAY.slice(0,7));
  const months = [...mSet].sort().reverse().slice(0,18);
  let html = withAll ? '<option value="">All</option>' : '';
  html += months.map(m=>{
    const lbl = new Date(m+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    return `<option value="${m}">${lbl}</option>`;
  }).join('');
  sel.innerHTML = html;
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value=prev;
  else if(!withAll && sel.options.length) sel.value=sel.options[0].value;
}

// ═══════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════
const PAGE_CFG = {
  dashboard:       {title:'Dashboard',         sub:"Today's business overview"},
  dailybook:       {title:'Daily Book',        sub:'All transactions for a selected date'},
  challans:        {title:'Challans',          sub:'All billing records — create, edit, view'},
  customers:       {title:'Customers',         sub:'Manage buyers & view party ledger'},
  'customer-detail':{title:'Customer Detail',  sub:'Account overview, challans, payments & ledger'},
  followups:       {title:'Follow-ups',        sub:'Clients with outstanding dues — sorted by risk'},
  products:        {title:'Products',          sub:'Manage product catalog'},
  companies:       {title:'Companies',         sub:'Manage your companies & data'},
  company:         {title:'Companies',         sub:'Manage your companies & data'},
  monthly:         {title:'Monthly Report',    sub:'Challan-wise monthly statement with payments'},
  aging:           {title:'Aging Analysis',    sub:'Outstanding credit by age — follow up tracker'},
  payments:        {title:'Payments In',       sub:'All payment collections — record & manage'},
  purchases:       {title:'Purchases',         sub:'All purchase records — create, edit, view'},
  suppliers:       {title:'Suppliers',         sub:'Manage vendors & view payable ledger'},
  'supplier-detail':{title:'Supplier Detail',  sub:'Account overview, purchases, payments & ledger'},
  'supplier-payments':{title:'Payments Out',   sub:'All payments made to suppliers — record & manage'},
  'purchase-followups':{title:'Payables Due',  sub:'Suppliers you owe — sorted by risk'},
  'payables-aging':{title:'Payables Aging',    sub:'Outstanding payables by age'},
  upi:             {title:'UPI Accounts',      sub:'Accounts, opening balances & received/paid report'},
  'upi-detail':    {title:'UPI Account',        sub:'Received & paid through this account'},
  users:           {title:'Manage Users',      sub:'Add staff, control access via OTP login'},
};

function nav(name) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('page-'+name); if(pg) pg.classList.add('active');
  const ni = document.getElementById('nav-'+name); if(ni) ni.classList.add('active');
  const cfg = PAGE_CFG[name];
  if(cfg){ document.getElementById('page-title').textContent=cfg.title; document.getElementById('page-sub').textContent=cfg.sub; }
  const renderMap={dailybook:renderDailyBook,challans:renderChallans,customers:renderCustomers,clients:renderClients,'customer-detail':renderCustomerDetail,followups:renderFollowups,products:renderProducts,company:renderCompanies,companies:renderCompanies,monthly:renderMonthly,aging:renderAging,payments:renderPayments,users:function(){ if(typeof renderUsers==='function')renderUsers(); if(typeof renderSessions==='function')renderSessions(); },
    purchases:renderPurchases,suppliers:renderSuppliers,'supplier-detail':renderSupplierDetail,'supplier-payments':renderSupplierPayments,'purchase-followups':renderPurchaseFollowups,'payables-aging':renderPayablesAging,upi:renderUpiReport,'upi-detail':renderUpiDetail};
  (renderMap[name]||function(){})();
  if(name==='dashboard') renderDashboard();
  // Bottom nav sync
  const BN_MAP={dashboard:'bn-dashboard',challans:'bn-challans',customers:'bn-customers',payments:'bn-payments'};
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  const bnId=BN_MAP[name]; if(bnId&&el(bnId)) el(bnId).classList.add('active');
  closeSidebar();
}

// ═══════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════
function renderDashboard() {
  const todayChs  = cChallans().filter(c=>c.date===TODAY);
  const ydayD=new Date(TODAY);ydayD.setDate(ydayD.getDate()-1);
  const ydayChs   = cChallans().filter(c=>c.date===ydayD.toISOString().split('T')[0]);
  const tTotal    = todayChs.reduce((s,c)=>s+c.total,0);
  const yTotal    = ydayChs.reduce((s,c)=>s+c.total,0);
  const tCash     = todayChs.filter(c=>c.mode==='cash').reduce((s,c)=>s+c.total,0);
  const tUPI      = todayChs.filter(c=>c.mode==='upi').reduce((s,c)=>s+c.total,0);
  const tCredit   = todayChs.filter(c=>c.mode==='credit').reduce((s,c)=>s+c.total,0);
  const totalOS   = cChallans().filter(c=>outstanding(c)>0).reduce((s,c)=>s+outstanding(c),0);
  const nOSC      = cClients().filter(cl=>clientStats(cl.id).os>0).length;

  el('d-total').textContent  = fmtN(tTotal);
  el('d-cash').textContent   = fmtN(tCash);
  el('d-upi').textContent    = fmtN(tUPI);
  el('d-credit').textContent = fmtN(tCredit);
  el('d-cashc').textContent  = todayChs.length+' challans today';
  el('d-os').innerHTML       = 'Total outstanding: <span class="amt">'+fmtN(totalOS)+'</span>';
  el('sb-os').textContent    = fmtN(totalOS);
  el('sb-cl').textContent    = nOSC+' clients with credit';
  const chg = yTotal>0 ? (((tTotal-yTotal)/yTotal)*100).toFixed(1) : 0;
  el('d-vs').innerHTML = chg>=0 ? '<span style="color:#15803d">↑'+chg+'%</span> vs yesterday' : '<span style="color:#b91c1c">↓'+Math.abs(chg)+'%</span> vs yesterday';

  const topAl = cClients().map(cl=>({cl,...clientStats(cl.id)})).filter(x=>x.os>0).sort((a,b)=>b.oldest-a.oldest).slice(0,4);
  el('d-alerts').innerHTML = topAl.length ? topAl.map(a=>{
    const r=riskLevel(a.oldest,a.os);
    const laD=a.cl.lastAsked ? daysOld(a.cl.lastAsked) : null;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9"><div><div style="font-size:13px;font-weight:700">'+a.cl.name+'</div><div style="font-size:11px;color:#64748b">Oldest: '+a.oldest+'d · Last asked: '+(laD!==null?laD+'d ago':'<span style=color:#b91c1c>Never!</span>')+'</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:800;color:#b91c1c">'+fmt(a.os)+'</div><span class="badge '+r.cls+'" style="margin-top:2px">'+r.label+'</span></div></div>';
  }).join('') : '<div style="color:#94a3b8;font-size:13px;padding:12px 0">No outstanding credits 🎉</div>';

  const recent = [...cChallans()].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,8);
  el('d-recent').innerHTML = recent.map(function(c){
    const os=outstanding(c),st=challanStatus(c);
    return '<tr>'+
      '<td><strong style="color:#1d4ed8;cursor:pointer" onclick="printDeliveryChallan(\''+c.id+'\')">'+c.billNo+'</strong></td>'+
      '<td>'+fmtD(c.date)+'</td>'+
      '<td>'+clientName(c.clientId)+'</td>'+
      '<td><strong>'+fmt(c.total)+'</strong></td>'+
      '<td style="font-weight:700;color:'+(os>0?'#b91c1c':'#15803d')+'">'+fmt(os)+'</td>'+
      '<td><span class="badge badge-'+st+'">'+st[0].toUpperCase()+st.slice(1)+'</span></td>'+
    '</tr>';
  }).join('');

  // ---- Purchasing snapshot ----
  if (el('d-pur-month')) {
    const mPur = cPurchases().filter(p=>p.date.startsWith(TODAY.slice(0,7)));
    const purMonth = mPur.reduce((s,p)=>s+p.total,0);
    const payable = cSuppliers().reduce((s,x)=>s+Math.max(0,supplierBalance(x.id)),0);
    const supCount = cSuppliers().filter(x=>supplierBalance(x.id)>0).length;
    const paidOut = cSupplierPayments().filter(p=>p.date.startsWith(TODAY.slice(0,7))).reduce((s,p)=>s+p.amount,0);
    let upiNet = 0;
    cUpiAccounts().forEach(u=>{ const t=upiTotals(u.id); upiNet += (u.openingBalance||0)+t.received-t.paid; });
    el('d-pur-month').textContent = fmtN(purMonth);
    el('d-pur-cnt').textContent = mPur.length + ' purchases';
    el('d-payable').textContent = fmtN(payable);
    el('d-sup-cnt').textContent = supCount + ' supplier' + (supCount===1?'':'s') + ' to pay';
    el('d-paidout').textContent = fmtN(paidOut);
    el('d-upi-net').textContent = fmtN(upiNet);
  }

  renderWeeklyChart();
  renderMixChart();
  renderAgingBarChart();
  if (typeof renderActivityFeed === 'function') renderActivityFeed();
}

// ═══════════════════════════════════════════════
//  DAILY BOOK
// ═══════════════════════════════════════════════
function renderDailyBook() {
  const dateEl = el('db-date');
  const date = dateEl.value || TODAY;
  if (!dateEl.value) dateEl.value = TODAY;

  const dayChs  = cChallans().filter(c => c.date === date);
  const dayPmts = cPayments().filter(p => p.date === date);

  const tSales  = dayChs.reduce((s,c) => s+c.total, 0);
  const tCashCh = dayChs.filter(c => c.mode==='cash').reduce((s,c) => s+c.total, 0);
  const tUPICh  = dayChs.filter(c => c.mode==='upi').reduce((s,c) => s+c.total, 0);
  const tCred   = dayChs.filter(c => c.mode==='credit').reduce((s,c) => s+c.total, 0);
  const tCashPmt= dayPmts.filter(p => p.mode==='cash').reduce((s,p) => s+p.amount, 0);
  const tUPIPmt = dayPmts.filter(p => p.mode==='upi').reduce((s,p) => s+p.amount, 0);
  const tPmts   = dayPmts.reduce((s,p) => s+p.amount, 0);
  const cashInHand = tCashCh + tCashPmt;

  // Stat cards
  el('db-stats').innerHTML = `
    <div class="stat-card"><div class="icon-box" style="background:#dbeafe"><i class="fas fa-rupee-sign" style="color:#1d4ed8"></i></div>
      <div><div class="stat-label">Total Sales</div><div class="stat-val">${fmt(tSales)}</div>
      <div class="stat-hint">${dayChs.length} challan${dayChs.length!==1?'s':''}</div></div></div>
    <div class="stat-card"><div class="icon-box" style="background:#dcfce7"><i class="fas fa-money-bill-wave" style="color:#15803d"></i></div>
      <div><div class="stat-label">Cash Collected</div><div class="stat-val" style="color:#15803d">${fmt(cashInHand)}</div>
      <div class="stat-hint">Sales ${fmt(tCashCh)} + Pmts ${fmt(tCashPmt)}</div></div></div>
    <div class="stat-card"><div class="icon-box" style="background:#ede9fe"><i class="fas fa-mobile-alt" style="color:#6d28d9"></i></div>
      <div><div class="stat-label">UPI (Sales + Received)</div><div class="stat-val" style="color:#6d28d9">${fmt(tUPICh+tUPIPmt)}</div>
      <div class="stat-hint">Sales ${fmt(tUPICh)} + Pmts ${fmt(tUPIPmt)}</div></div></div>
    <div class="stat-card"><div class="icon-box" style="background:#fee2e2"><i class="fas fa-credit-card" style="color:#b91c1c"></i></div>
      <div><div class="stat-label">Credit Given</div><div class="stat-val" style="color:#b91c1c">${fmt(tCred)}</div>
      <div class="stat-hint">Pmts received: ${fmt(tPmts)}</div></div></div>`;

  // Cash position banner
  el('db-cash-banner').innerHTML = `
    <div class="card" style="background:#0f172a;color:#fff;padding:14px 20px">
      <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center">
        <div style="flex:1">
          <div style="font-size:11px;opacity:.7;text-transform:uppercase;letter-spacing:.07em">Day's Cash Position</div>
          <div style="font-size:22px;font-weight:800;margin-top:2px">${fmt(cashInHand)}</div>
          <div style="font-size:11px;opacity:.6;margin-top:2px">Cash sales ${fmt(tCashCh)} + Cash payments received ${fmt(tCashPmt)}</div>
        </div>
        <div style="display:flex;gap:24px;flex-wrap:wrap">
          <div><div style="font-size:10px;opacity:.6">UPI Received</div><div style="font-size:16px;font-weight:700;color:#a78bfa">${fmt(tUPICh+tUPIPmt)}</div></div>
          <div><div style="font-size:10px;opacity:.6">Credit Pending</div><div style="font-size:16px;font-weight:700;color:#f87171">${fmt(tCred)}</div></div>
          <div><div style="font-size:10px;opacity:.6">Total Activity</div><div style="font-size:16px;font-weight:700;color:#60a5fa">${fmt(tSales+tPmts)}</div></div>
        </div>
      </div>
    </div>`;

  // Challans list
  el('db-ch-cnt').textContent = dayChs.length + ' challan' + (dayChs.length!==1?'s':'');
  el('db-challans-list').innerHTML = dayChs.length ? `
    <table><thead><tr><th>DC No</th><th>Client</th><th>Total</th><th>Mode</th><th></th></tr></thead>
    <tbody>${dayChs.sort((a,b)=>a.billNo.localeCompare(b.billNo)).map(c=>`<tr>
      <td><strong style="color:#1d4ed8;cursor:pointer" onclick="openChallanView('${c.id}')">${c.billNo}</strong></td>
      <td>${clientName(c.clientId)}</td>
      <td><strong>${fmt(c.total)}</strong></td>
      <td><span class="badge badge-${c.mode}">${c.mode.toUpperCase()}${c.mode==='upi'&&c.upiAccountId?' · '+upiAccountName(c.upiAccountId):''}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="openChallanView('${c.id}')"><i class="fas fa-eye"></i></button></td>
    </tr>`).join('')}</tbody></table>` :
    '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px"><i class="fas fa-file-alt" style="display:block;font-size:20px;margin-bottom:6px"></i>No challans on this date</div>';

  // Payments list
  el('db-pm-cnt').innerHTML = dayPmts.length + ' payment' + (dayPmts.length!==1?'s':'') + (tPmts?` · <span class="amt">${fmtN(tPmts)}</span>`:'');
  el('db-payments-list').innerHTML = dayPmts.length ? `
    <table><thead><tr><th>Client</th><th>Amount</th><th>Mode</th><th>Note</th></tr></thead>
    <tbody>${dayPmts.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(p=>`<tr>
      <td><strong>${clientName(p.clientId)}</strong></td>
      <td style="font-weight:700;color:#15803d">${fmt(p.amount)}</td>
      <td><span class="badge badge-${p.mode}">${p.mode.toUpperCase()}${p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):''}</span></td>
      <td style="color:#64748b;font-size:12px">${p.note||'—'}</td>
    </tr>`).join('')}</tbody></table>` :
    '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px"><i class="fas fa-hand-holding-usd" style="display:block;font-size:20px;margin-bottom:6px"></i>No payments recorded this date</div>';

  // Purchases + Payments Out for the day (buy side) — rendered independently of sales
  const dayPur = (typeof cPurchases==='function') ? cPurchases().filter(p=>p.date===date) : [];
  const daySupPay = (typeof cSupplierPayments==='function') ? cSupplierPayments().filter(p=>p.date===date) : [];
  const tPur = dayPur.reduce((s,p)=>s+p.total,0);
  const tSupPay = daySupPay.reduce((s,p)=>s+p.amount,0);
  if (el('db-pur-cnt')) el('db-pur-cnt').innerHTML = dayPur.length + ' purchase' + (dayPur.length!==1?'s':'') + (tPur?` · <span class="amt">${fmtN(tPur)}</span>`:'');
  if (el('db-purchases-list')) el('db-purchases-list').innerHTML = dayPur.length ? `
    <table><thead><tr><th>No</th><th>Supplier</th><th>Total</th><th>Mode</th></tr></thead>
    <tbody>${dayPur.map(p=>`<tr>
      <td><strong style="color:#1d4ed8;cursor:pointer" onclick="printPurchase('${p.id}')">${p.billNo}</strong></td>
      <td>${supplierName(p.supplierId)}</td>
      <td><strong>${fmt(p.total)}</strong></td>
      <td><span class="badge badge-${p.mode}">${p.mode.toUpperCase()}${p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):''}</span></td>
    </tr>`).join('')}</tbody></table>` :
    '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px"><i class="fas fa-file-invoice" style="display:block;font-size:20px;margin-bottom:6px"></i>No purchases on this date</div>';
  if (el('db-supout-cnt')) el('db-supout-cnt').innerHTML = daySupPay.length + ' payment' + (daySupPay.length!==1?'s':'') + (tSupPay?` · <span class="amt">${fmtN(tSupPay)}</span>`:'');
  if (el('db-suppay-list')) el('db-suppay-list').innerHTML = daySupPay.length ? `
    <table><thead><tr><th>Supplier</th><th>Amount</th><th>Mode</th><th>Note</th></tr></thead>
    <tbody>${daySupPay.map(p=>`<tr>
      <td><strong>${supplierName(p.supplierId)}</strong></td>
      <td style="font-weight:700;color:#b91c1c">${fmt(p.amount)}</td>
      <td><span class="badge badge-${p.mode}">${p.mode.toUpperCase()}${p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):''}</span></td>
      <td style="color:#64748b;font-size:12px">${p.note||'—'}</td>
    </tr>`).join('')}</tbody></table>` :
    '<div style="text-align:center;padding:20px;color:#94a3b8;font-size:13px"><i class="fas fa-money-bill-wave" style="display:block;font-size:20px;margin-bottom:6px"></i>No payments made this date</div>';

  // All transactions table
  const allTx = [];
  dayChs.forEach((c,i) => allTx.push({order:i+1, type:'challan', ref:c.billNo, party:clientName(c.clientId), desc:c.items.map(i=>i.name).join(', '), debit:c.total, credit:0, mode:c.mode, upiAccountId:c.upiAccountId, id:c.id}));
  dayPmts.forEach((p,i) => allTx.push({order:1000+i, type:'payment', ref:'PMT', party:clientName(p.clientId), desc:p.note||'Payment received', debit:0, credit:p.amount, mode:p.mode, upiAccountId:p.upiAccountId}));
  allTx.sort((a,b)=>a.order-b.order);

  const txBody = el('db-all-tx'), noTx = el('db-no-tx');
  if (!allTx.length) { txBody.innerHTML=''; noTx.style.display='block'; return; }
  noTx.style.display = 'none';
  txBody.innerHTML = allTx.map((tx,i) => `<tr style="${tx.type==='payment'?'background:rgba(34,197,94,.10)':''}">
    <td style="color:#94a3b8;font-size:12px">${i+1}</td>
    <td><span class="badge" style="${tx.type==='challan'?'background:#dbeafe;color:#1d4ed8':'background:#dcfce7;color:#15803d'}">${tx.type==='challan'?'CHALLAN':'PAYMENT'}</span></td>
    <td><strong style="${tx.type==='challan'?'color:#1d4ed8;cursor:pointer':'color:#15803d'}" ${tx.type==='challan'?`onclick="openChallanView('${tx.id}')"`:''}>${tx.ref}</strong></td>
    <td>${tx.party}</td>
    <td style="font-size:12px;color:#64748b;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${tx.desc}</td>
    <td style="font-weight:700;color:${tx.debit>0?'#b91c1c':'#94a3b8'}">${tx.debit>0?fmt(tx.debit):'—'}</td>
    <td style="font-weight:700;color:${tx.credit>0?'#15803d':'#94a3b8'}">${tx.credit>0?fmt(tx.credit):'—'}</td>
    <td><span class="badge badge-${tx.mode}">${tx.mode.toUpperCase()}${tx.mode==='upi'&&tx.upiAccountId?' · '+upiAccountName(tx.upiAccountId):''}</span></td>
  </tr>`).join('');
}

function openQuickPaymentModal() {
  // Quick pay: select client first, then amount
  const clOpts = cClients().map(c => {
    const bal = clientBalance(c.id);
    const os = Math.max(0, bal);
    const adv = Math.max(0, -bal);
    const hint = adv > 0 ? ` (Advance: ${fmt(adv)})` : os > 0 ? ` (Owes: ${fmt(os)})` : ' (Clear)';
    return `<option value="${c.id}">${c.name}${hint}</option>`;
  }).join('');
  const html = `
    <div class="form-row"><label>Select Client *</label>
      <select class="inp" id="qp-client" onchange="updateQuickPayInfo()">${clOpts}</select>
    </div>
    <div id="qp-info" style="background:var(--surface-2);border-radius:8px;padding:10px;margin-bottom:12px;font-size:12px;color:#64748b"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-row"><label>Amount (₹) *</label><input class="inp" id="qp-amt" type="number" min="0.01" step="0.01"></div>
      <div class="form-row"><label>Date *</label><input class="inp" id="qp-date" type="date" value="${TODAY}"></div>
      <div class="form-row"><label>Mode *</label><select class="inp" id="qp-mode" onchange="el('qp-upi-wrap').style.display=this.value==='upi'?'block':'none'"><option value="" disabled selected>— Select Mode —</option><option value="cash">Cash</option><option value="upi">UPI</option></select></div>
      <div class="form-row" id="qp-upi-wrap" style="display:none"><label>UPI Account *</label>${upiSelectHTML('qp-upi', null)}</div>
      <div class="form-row"><label>Note</label><input class="inp" id="qp-note" placeholder="e.g. against March bills"></div>
    </div>`;
  openModal('Record Payment', html, saveQuickPayment);
  setTimeout(updateQuickPayInfo, 50);
}
function updateQuickPayInfo() {
  const cId = parseInt(el('qp-client')?.value);
  if (!cId) return;
  const bal = clientBalance(cId);
  const os = Math.max(0, bal), adv = Math.max(0, -bal);
  const info = el('qp-info');
  if (info) info.innerHTML = os > 0
    ? `<span style="color:#b91c1c;font-weight:700">Outstanding: ${fmt(os)}</span>`
    : adv > 0
      ? `<span style="color:#15803d;font-weight:700">Advance Balance: ${fmt(adv)} — new payment adds to advance</span>`
      : '<span style="color:#15803d">Balance clear ✓</span>';
}
function saveQuickPayment() {
  const clientId = parseInt(el('qp-client')?.value);
  const amt = parseFloat(el('qp-amt')?.value) || 0;
  if (!clientId) { alert('Select a client.'); return; }
  if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }
  APP.payments.push({id:'p'+uid(), companyId:APP.activeCompanyId, clientId, date:el('qp-date').value, amount:amt, mode:el('qp-mode').value, note:el('qp-note').value});
  saveStore(); closeModal();
  toast('Payment recorded'); refreshAfterPayment();
}

function refreshAfterPayment() {
  clearAllocCache();
  // Always refresh dashboard (also updates sidebar stats)
  renderDashboard();
  // Refresh follow-ups badge + page if active
  var fuPage=el('page-followups');
  if(fuPage&&fuPage.classList.contains('active')){
    renderFollowups();
  } else {
    var fuCount=cClients().filter(function(cl){return clientStats(cl.id).os>0;}).length;
    var fuCnt=el('nav-fu-cnt');
    if(fuCnt){fuCnt.textContent=fuCount;fuCnt.style.display=fuCount?'':'none';}
  }
  // Refresh whichever page is currently visible
  var pageMap=[
    ['page-challans',       renderChallans],
    ['page-customers',      renderCustomers],
    ['page-customer-detail',renderCustomerDetail],
    ['page-monthly',        renderMonthly],
    ['page-aging',          renderAging],
    ['page-payments',       renderPayments],
    ['page-dailybook',      renderDailyBook],
    ['page-companies',      renderCompanies],
    ['page-upi',            typeof renderUpiReport==='function'?renderUpiReport:function(){}]
  ];
  pageMap.forEach(function(pair){
    var pg=el(pair[0]);
    if(pg&&pg.classList.contains('active')) pair[1]();
  });
}

function downloadDailyBookPDF() {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W=210, mg=14, date=el('db-date').value||TODAY;
  const dayChs  = cChallans().filter(c=>c.date===date);
  const dayPmts = cPayments().filter(p=>p.date===date);
  const tCashCh = dayChs.filter(c=>c.mode==='cash').reduce((s,c)=>s+c.total,0);
  const tCashPmt= dayPmts.filter(p=>p.mode==='cash').reduce((s,p)=>s+p.amount,0);
  const tUPI    = dayChs.filter(c=>c.mode==='upi').reduce((s,c)=>s+c.total,0)+dayPmts.filter(p=>p.mode==='upi').reduce((s,p)=>s+p.amount,0);
  const tCred   = dayChs.filter(c=>c.mode==='credit').reduce((s,c)=>s+c.total,0);
  const tPmts   = dayPmts.reduce((s,p)=>s+p.amount,0);
  const tSales  = dayChs.reduce((s,c)=>s+c.total,0);

  pdfHeader(doc, 'Daily Book  ·  ' + fmtD(date) + '  ·  Generated: ' + fmtD(TODAY), false);

  let y=43;
  const boxes=[
  {l:'Total Sales', v:'Rs.'+fmtPdf(tSales), c:[29,78,216]},
  {l:'Cash In Hand',v:'Rs.'+fmtPdf(tCashCh+tCashPmt),c:[21,128,61]},
  {l:'UPI Received', v:'Rs.'+fmtPdf(tUPI),c:[109,40,217]},
  {l:'Credit Given', v:'Rs.'+fmtPdf(tCred),c:[185,28,28]},
];
  boxes.forEach((b,i)=>{
    const x=mg+i*45;
    doc.setFillColor(248,250,252); doc.rect(x,y,43,16,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(100,116,139);doc.text(b.l,x+2,y+7);
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor(...b.c);doc.text(b.v,x+2,y+14);
  });
  y+=22;

  if(dayChs.length){
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);doc.text('Challans — '+dayChs.length+' bills',mg,y);y+=4;
    doc.autoTable({startY:y,margin:{left:mg,right:mg},
      head:[['DC No','Client','Items','Total (Rs.)','Mode']],
      body:dayChs.map(c=>[c.billNo,clientName(c.clientId),c.items.map(i=>i.name+'('+i.qty+(unitLabel(i.unit))+')').join(', '),c.total.toLocaleString('en-IN'),c.mode.toUpperCase()]),
      headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
      bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85]},alternateRowStyles:{fillColor:[248,250,252]},
      columnStyles:{3:{halign:'right',fontStyle:'bold'}}
    });
    y=doc.lastAutoTable.finalY+8;
  }
  if(dayPmts.length){
    doc.setFontSize(10);doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);doc.text('Payments Received — ₹'+fmtPdf(tPmts),mg,y);y+=4;
    doc.autoTable({startY:y,margin:{left:mg,right:mg},
      head:[['Client','Amount (Rs.)','Mode','Note']],
      body:dayPmts.map(p=>[clientName(p.clientId),p.amount.toLocaleString('en-IN'),p.mode.toUpperCase(),p.note||'—']),
      headStyles:{fillColor:[21,128,61],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
      bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85]},alternateRowStyles:{fillColor:[240,253,244]},
      columnStyles:{1:{halign:'right',fontStyle:'bold',textColor:[21,128,61]}}
    });
    y=doc.lastAutoTable.finalY+8;
  }
  if(!dayChs.length&&!dayPmts.length){
    doc.setFontSize(10);doc.setFont('helvetica','normal');doc.setTextColor(148,163,184);doc.text('No transactions recorded on this date.',mg,y);
  }
  pdfFooter(doc, false);
  doc.save('DailyBook-'+date+'.pdf');
}

function downloadLedgerPDF(clientId, fromDate, toDate) {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const W=210, mg=14;
  const cl = APP.clients.find(c=>c.id===clientId);
  if (!cl) return;
  const bal = clientBalance(clientId);

  const filterLabel = (fromDate || toDate)
    ? '  ·  ' + (fromDate ? fmtD(fromDate) : 'Start') + ' to ' + (toDate ? fmtD(toDate) : 'Today')
    : '';
  pdfHeader(doc, 'Party Ledger  ·  ' + cl.name + filterLabel + '  ·  Generated: ' + fmtD(TODAY), false);

  let y=43;
  doc.setFillColor(248,250,252); doc.rect(mg,y,W-2*mg,18,'F');
  doc.setFontSize(8);doc.setFont('helvetica','bold');doc.setTextColor(100,116,139);
  doc.text('CLIENT',mg+3,y+6);doc.text('GST',mg+90,y+6);doc.text('PHONE',mg+150,y+6);
  doc.setFontSize(9);doc.setFont('helvetica','bold');doc.setTextColor(15,23,42);
  doc.text(cl.name,mg+3,y+14);doc.text(cl.gst||'—',mg+90,y+14);doc.text(cl.phone||'—',mg+150,y+14);
  y+=24;

  let allEvents=[];
  APP.challans.filter(c=>c.clientId===clientId&&c.mode==='credit').forEach(c=>{
    allEvents.push({date:c.date,type:'sale',amount:c.total,ref:c.billNo,items:c.items,notes:c.notes,gstEnabled:c.gstEnabled});
  });
  APP.payments.filter(p=>p.clientId===clientId).forEach(p=>{
    allEvents.push({date:p.date,type:'payment',amount:p.amount,ref:'PMT',desc:p.note||'Payment received',note:p.note||'',mode:p.mode,upiAccountId:p.upiAccountId});
  });
  allEvents.sort((a,b)=>new Date(a.date)-new Date(b.date)||(a.type==='payment'?1:-1));

  const cl_ob = cl.openingBalance || 0;
  const cl_ob_date = cl.openingBalanceDate || null;
  let running = cl_ob;
  const obRows = [];
  if (cl_ob !== 0) {
    obRows.push([cl_ob_date ? fmtD(cl_ob_date) : '—','Opening Balance',
      cl_ob > 0 ? 'Rs.'+fmtPdf(cl_ob) : '—',
      cl_ob < 0 ? 'Rs.'+fmtPdf(Math.abs(cl_ob)) : '—',
      'Rs.'+fmtPdf(Math.abs(cl_ob))+' '+(cl_ob > 0 ? 'Dr' : 'Cr')
    ]);
  }

  // Advance running balance to account for events before the from-date filter
  if (fromDate) {
    allEvents.filter(e => e.date < fromDate).forEach(e => {
      if (e.type==='sale') running+=e.amount; else running-=e.amount;
    });
  }
  const events = allEvents.filter(e => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate && e.date > toDate) return false;
    return true;
  });

  const txRows=events.map(e=>{
    if(e.type==='sale'){
      running+=e.amount;
      let particulars=e.ref;
      if(e.items&&e.items.length){
        particulars+='\n'+e.items.map(i=>'  - '+i.name+(i.size?' ('+i.size+')':'')+'  '+i.qty+(unitLabel(i.unit))+' x '+fmtPdf(i.price)+' = '+fmtPdf(i.lt)).join('\n');
        const sub=e.items.reduce((s,i)=>s+(i.lt||0),0);
        if(e.gstEnabled) particulars+='\n  Subtotal: '+fmtPdf(sub)+'   GST 18%: '+fmtPdf(+(sub*0.18).toFixed(2));
        particulars+='\n  Grand Total: Rs.'+fmtPdf(e.amount);
      }
      if(e.notes) particulars+='\n  Note: '+e.notes;
      return[fmtD(e.date),particulars,'Rs.'+fmtPdf(e.amount),'—',running===0?'NIL':'Rs.'+fmtPdf(Math.abs(running))+' '+(running>0?'Dr':'Cr')];
    }
    else{
      running-=e.amount;
      var pt='Payment ('+e.mode.toUpperCase()+')';
      if(e.mode==='upi'&&e.upiAccountId) pt+=' — '+upiAccountName(e.upiAccountId);
      if(e.note) pt+='\n  Note: '+e.note;
      return[fmtD(e.date),pt,'—','Rs.'+fmtPdf(e.amount),running===0?'NIL':'Rs.'+fmtPdf(Math.abs(running))+' '+(running>0?'Dr':'Cr')];
    }
  });
  const rows = (fromDate ? [] : obRows).concat(txRows);

  doc.autoTable({startY:y,margin:{left:mg,right:mg},
    head:[['Date','Particulars','Debit (Sales Rs.)','Credit (Payments Rs.)','Balance']],
    body:rows,
    headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
    bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85],overflow:'linebreak'},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{
      0:{cellWidth:22},
      1:{cellWidth:78,overflow:'linebreak'},
      2:{cellWidth:28,halign:'right',textColor:[185,28,28]},
      3:{cellWidth:28,halign:'right',textColor:[21,128,61]},
      4:{cellWidth:26,halign:'right',fontStyle:'bold'}
    }
  });

  y=doc.lastAutoTable.finalY+8;
  if (y > 250) { doc.addPage(); y = 20; }   // keep the summary panel off the footer
  // Statement totals — total goods sold vs total collected (matches the on-screen grand total)
  const totDebit=events.filter(e=>e.type==='sale').reduce((s,e)=>s+e.amount,0);
  const totCredit=events.filter(e=>e.type==='payment').reduce((s,e)=>s+e.amount,0);
  const rgb=hexToRgb((getActiveCompany().primaryColor)||'#0f172a');
  const panelH=20;
  // Left panel — the two running totals
  doc.setFillColor(248,250,252);doc.setDrawColor(226,232,240);doc.setLineWidth(0.3);
  doc.roundedRect(mg,y,W-2*mg-70,panelH,2,2,'FD');
  doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(100,116,139);
  doc.text('TOTAL GOODS SOLD',mg+6,y+7);
  doc.text('TOTAL COLLECTED',mg+66,y+7);
  doc.setFontSize(11);doc.setTextColor(30,41,59);
  doc.text('Rs.'+fmtPdf(totDebit),mg+6,y+15);
  doc.setTextColor(21,128,61);
  doc.text('Rs.'+fmtPdf(totCredit),mg+66,y+15);
  // Right panel — closing balance in the brand colour
  const bx=W-mg-64;
  doc.setFillColor(rgb[0],rgb[1],rgb[2]);doc.roundedRect(bx,y,64,panelH,2,2,'F');
  doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  doc.text('CLOSING BALANCE',bx+5,y+7);
  doc.setFontSize(13);
  doc.text(fmtPdf(Math.abs(bal))+' '+(bal>0?'Dr':bal<0?'Cr':'NIL'),bx+5,y+15.5);

  pdfFooter(doc, false);
  var suffix = (fromDate||toDate) ? '-'+( fromDate||'start')+'-to-'+(toDate||'today') : '';
  doc.save('Ledger-'+cl.name.replace(/\s+/g,'-')+suffix+'-'+TODAY+'.pdf');
}

