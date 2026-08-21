/* ═══════════════════════════════════════════════════════════════
   BUY SIDE — Suppliers, Purchases, Supplier Payments, UPI accounts
   (mirror of the sell side; uses the same helpers: el, fmt, fmtD,
    openModal, toast, ledgerItemsHTML, pdfHeader/pdfFooter, etc.)
   ═══════════════════════════════════════════════════════════════ */

/* ---- series number helpers (PREFIX/MON/NN, monthly reset) ---- */
const MON_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function seriesPeriodOf(d){ return (d||TODAY).slice(0,7); }
function seriesMonOf(d){ const m=parseInt((d||TODAY).slice(5,7),10)||1; return MON_ABBR[Math.min(11,Math.max(0,m-1))]; }
function seriesFormatNo(prefix,dateStr,counter){ const pfx=String(prefix||'').replace(/\/+$/,''); const parts=[]; if(pfx)parts.push(pfx); parts.push(seriesMonOf(dateStr)); parts.push(String(counter).padStart(2,'0')); return parts.join('/'); }
function seriesNextCounter(startNumber,seqPeriod,nextNumber,dateStr){ const period=seriesPeriodOf(dateStr); return (seqPeriod===period)?(nextNumber||startNumber||1):(startNumber||1); }

/* ---- clear both allocation caches on any mutation ---- */
let _supAllocCache = {};
function clearAllocCache(){ _allocCache = {}; _supAllocCache = {}; }

/* ---- supplier math (mirror of client math over purchases + supplierPayments) ---- */
function computeSupplierAllocation(supplierId){
  const creditPur = APP.purchases.filter(p=>p.supplierId===supplierId && p.mode==='credit' && p.status!=='cancelled').sort((a,b)=>new Date(a.date)-new Date(b.date));
  let remaining = APP.supplierPayments.filter(p=>p.supplierId===supplierId).reduce((s,p)=>s+p.amount,0);
  const alloc={};
  for(const p of creditPur){ if(remaining<=0)break; const apply=Math.min(remaining,p.total); alloc[p.id]=apply; remaining-=apply; }
  return {alloc, advance:Math.max(0,remaining)};
}
function getSupplierAlloc(supplierId){ if(!_supAllocCache[supplierId]) _supAllocCache[supplierId]=computeSupplierAllocation(supplierId); return _supAllocCache[supplierId]; }
function supplierBalance(supplierId){
  const s=APP.suppliers.find(x=>x.id===supplierId); const ob=s?(s.openingBalance||0):0;
  const creditBuys=APP.purchases.filter(p=>p.supplierId===supplierId && p.mode==='credit' && p.status!=='cancelled').reduce((a,p)=>a+p.total,0);
  const paid=APP.supplierPayments.filter(p=>p.supplierId===supplierId).reduce((a,p)=>a+p.amount,0);
  return ob+creditBuys-paid;   // positive = we owe (payable)
}
function purchasePaidAmt(p){ if(p.mode!=='credit')return p.total; return getSupplierAlloc(p.supplierId).alloc[p.id]||0; }
function purchaseOutstanding(p){ if(p.mode!=='credit')return 0; return p.total-purchasePaidAmt(p); }
function purchaseStatus(p){ if(p.mode!=='credit')return 'paid'; const pa=purchasePaidAmt(p); if(pa>=p.total)return 'paid'; if(pa>0)return 'partial'; return 'pending'; }
function supplierStats(id){
  const pur=APP.purchases.filter(p=>p.supplierId===id && p.status!=='cancelled');
  const totalPurch=pur.reduce((s,p)=>s+p.total,0);
  const totalPaid=APP.supplierPayments.filter(p=>p.supplierId===id).reduce((s,p)=>s+p.amount,0);
  const bal=supplierBalance(id); const os=Math.max(0,bal); const advance=Math.max(0,-bal);
  const lastPur=[...pur].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const lastPmt=[...APP.supplierPayments.filter(p=>p.supplierId===id)].sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
  const pending=pur.filter(p=>p.mode==='credit'&&purchaseOutstanding(p)>0);
  const oldest=pending.length?Math.max(...pending.map(p=>daysOld(p.date))):0;
  return {totalPurch,totalPaid,os,advance,lastPur,lastPmt,oldest};
}
function payablesAgingBuckets(supplierId){
  const src=supplierId?APP.purchases.filter(p=>p.supplierId===supplierId&&p.mode==='credit'&&p.status!=='cancelled'):cPurchases().filter(p=>p.mode==='credit');
  return src.filter(p=>purchaseOutstanding(p)>0).reduce((a,p)=>{const d=daysOld(p.date),o=purchaseOutstanding(p); if(d<=30)a.b0+=o;else if(d<=60)a.b31+=o;else if(d<=90)a.b61+=o;else a.b90+=o; return a;},{b0:0,b31:0,b61:0,b90:0});
}
function supplierName(id){ const s=APP.suppliers.find(x=>x.id===id); return s?s.name:'—'; }
function nextPurchaseNo(supplierId, dateStr){
  const s=APP.suppliers.find(x=>x.id===supplierId); if(!s) return '';
  const d=dateStr||(el('pur-date')&&el('pur-date').value)||TODAY;
  const c=seriesNextCounter(s.purStartNumber, s.purSeqPeriod, s.purNextNumber, d);
  return seriesFormatNo(s.purPrefix, d, c);
}

/* ---- select population ---- */
function populateSupplierSelects(){
  const opts='<option value="">All Suppliers</option>'+cSuppliers().map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  ['pc-sup','sp-sup-filter'].forEach(id=>{ const e=el(id); if(e){ const v=e.value; e.innerHTML=opts; e.value=v; } });
}
function upiSelectHTML(id, selectedId){
  const list=cUpiAccounts();
  const opts='<option value="">— Select UPI Account —</option>'+list.map(u=>'<option value="'+u.id+'"'+(selectedId===u.id?' selected':'')+'>'+u.name+'</option>').join('');
  return '<select class="inp" id="'+id+'">'+opts+'</select>'+(list.length?'':'<div style="font-size:11px;color:#b91c1c;margin-top:4px">No UPI accounts yet — add one under UPI Accounts.</div>');
}

/* ═══════════════ SUPPLIERS LIST ═══════════════ */
function renderSuppliers(){
  const q=(el('sup-q')?.value||'').toLowerCase();
  const rf=el('sup-risk')?.value||'';
  let list=cSuppliers();
  if(q) list=list.filter(s=>s.name.toLowerCase().includes(q)||(s.phone||'').includes(q));
  if(rf) list=list.filter(s=>{const st=supplierStats(s.id); return riskLevel(st.oldest,st.os).label===rf;});

  const cardsEl=el('supplier-cards');
  if(cardsEl) cardsEl.innerHTML=cSuppliers().map(s=>{
    const st=supplierStats(s.id); const r=riskLevel(st.oldest,st.os);
    return '<div class="card">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">'+
        '<div><div style="font-weight:700;font-size:13px">'+s.name+'</div><div style="font-size:11px;color:#94a3b8">'+(s.phone||'—')+' · <span style="font-family:ui-monospace,monospace">'+(s.purPrefix||'—')+'</span></div></div>'+
        '<span class="badge '+r.cls+'">'+r.label+'</span>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'+
        '<div><div style="font-size:10px;color:#94a3b8">Total Purchases</div><div style="font-size:14px;font-weight:800">'+fmt(st.totalPurch)+'</div></div>'+
        '<div><div style="font-size:10px;color:'+(st.advance>0?'#15803d':'#b91c1c')+'">'+(st.advance>0?'Advance':'Payable')+'</div>'+
          '<div style="font-size:14px;font-weight:800;color:'+(st.advance>0?'#15803d':st.os>0?'#b91c1c':'#15803d')+'">'+(st.advance>0?fmt(st.advance):fmt(st.os))+'</div></div>'+
      '</div>'+
      '<button class="btn btn-ghost btn-sm" style="width:100%;font-size:11px" onclick="openSupplierDetail('+s.id+',\'suppliers\')"><i class="fas fa-truck" style="margin-right:4px"></i>View Details</button></div>';
  }).join('');

  el('t-suppliers').innerHTML=list.map(s=>{
    const st=supplierStats(s.id); const r=riskLevel(st.oldest,st.os);
    return '<tr>'+
      '<td><div style="font-weight:700">'+s.name+'</div><div style="font-size:10px;color:#94a3b8">'+(s.gst||'')+' · '+(s.address||'')+'</div></td>'+
      '<td>'+(s.phone||'—')+'</td>'+
      '<td><span class="badge badge-cash" style="font-family:ui-monospace,monospace">'+(s.purPrefix||'—')+'</span></td>'+
      '<td><strong>'+fmt(st.totalPurch)+'</strong></td>'+
      '<td style="color:#15803d">'+fmt(st.totalPaid)+'</td>'+
      '<td style="font-weight:800;color:'+(st.os>0?'#b91c1c':'#15803d')+'">'+(st.advance>0?fmt(st.advance)+' Adv':fmt(st.os))+'</td>'+
      '<td>'+fmtD(st.lastPur?.date)+'</td>'+
      '<td style="font-weight:700;color:'+(st.oldest>60?'#dc2626':st.oldest>30?'#d97706':'#334155')+'">'+(st.oldest>0?st.oldest+'d':'—')+'</td>'+
      '<td><span class="badge '+r.cls+'">'+r.label+'</span></td>'+
      '<td><div style="display:flex;gap:5px;flex-wrap:wrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="openSupplierDetail('+s.id+',\'suppliers\')" title="Details"><i class="fas fa-truck"></i></button>'+
        '<button class="btn btn-success btn-sm" onclick="openSupplierPaymentModal('+s.id+')" title="Record Payment"><i class="fas fa-rupee-sign"></i></button>'+
        '<button class="btn btn-ghost btn-sm" onclick="openSupplierModal('+s.id+')"><i class="fas fa-edit"></i></button>'+
        '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'supplier\','+s.id+')"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('') || '<tr><td colspan="10" style="text-align:center;color:#94a3b8;padding:26px">No suppliers yet.</td></tr>';
}

/* ═══════════════ SUPPLIER FORM ═══════════════ */
function openSupplierModal(id){
  const s=id?APP.suppliers.find(x=>x.id===id):null;
  const ob=s?(s.openingBalance||0):0;
  const html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1"><label>Supplier / Business Name *</label><input class="inp" id="sup-name" value="'+(s?s.name.replace(/"/g,'&quot;'):'')+'" placeholder="e.g. Reliance Textiles"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Address</label><input class="inp" id="sup-addr" value="'+(s?(s.address||'').replace(/"/g,'&quot;'):'')+'" placeholder="Optional"></div>'+
      '<div class="form-row"><label>Mobile No</label><input class="inp" id="sup-phone" value="'+(s?(s.phone||''):'')+'" placeholder="Optional"></div>'+
      '<div class="form-row"><label>Email</label><input class="inp" id="sup-email" type="email" value="'+(s?(s.email||''):'')+'" placeholder="Optional"></div>'+
      '<div class="form-row"><label>GST No</label><input class="inp" id="sup-gst" value="'+(s?(s.gst||''):'')+'" placeholder="Optional"></div>'+
      '<div class="form-row"><label>Last Paid / Contacted</label><input class="inp" id="sup-asked" type="date" value="'+(s?(s.lastAsked||''):'')+'"></div>'+
      '<div class="form-row"><label>Opening Balance (₹)</label><input class="inp" id="sup-ob-amt" type="number" value="'+(ob?Math.abs(ob):'')+'" placeholder="0"></div>'+
      '<div class="form-row"><label>Balance Type</label><select class="inp" id="sup-ob-type"><option value="dr"'+(ob>=0?' selected':'')+'>We owe (Payable)</option><option value="cr"'+(ob<0?' selected':'')+'>Advance paid</option></select></div>'+
      '<div class="form-row"><label>Opening Balance Date</label><input class="inp" id="sup-ob-date" type="date" value="'+(s?(s.openingBalanceDate||''):'')+'"></div>'+
    '</div>'+
    '<div style="margin:10px 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.05em">Purchase Number Series</div>'+
    '<div style="font-size:12px;color:#64748b;margin-bottom:10px">This supplier\'s purchases are numbered independently as <b>PREFIX/MON/NN</b> (resets each month). E.g. prefix <b>AP</b> → <b>AP/'+seriesMonOf(TODAY)+'/'+String((s&&s.purStartNumber)||1).padStart(2,'0')+'</b>.</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row"><label>Prefix</label><input class="inp" id="sup-pur-prefix" value="'+(s?(s.purPrefix||''):'')+'" placeholder="e.g. AP"></div>'+
      '<div class="form-row"><label>Start Value</label><input class="inp" id="sup-pur-start" type="number" value="'+(s?(s.purStartNumber||1):1)+'"'+(s&&s.purNextNumber>s.purStartNumber?' disabled title="Locked once purchases exist"':'')+'></div>'+
    '</div>';
  openModal(s?'Edit Supplier':'New Supplier', html, function(){ return saveSupplier(id); }, true);
}

/* ═══════════════ PURCHASES LIST ═══════════════ */
function purchaseTR(p){
  const pa=purchasePaidAmt(p), os=purchaseOutstanding(p), st=purchaseStatus(p), d=daysOld(p.date);
  const items=p.items.map(i=>i.name+' ('+i.qty+unitLabel(i.unit)+')').join(', ');
  return '<tr>'+
    '<td><strong style="color:#1d4ed8;font-family:ui-monospace,monospace">'+p.billNo+'</strong></td>'+
    '<td>'+fmtD(p.date)+'</td>'+
    '<td><div style="font-weight:600">'+supplierName(p.supplierId)+'</div></td>'+
    '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+items+'">'+items+'</td>'+
    '<td><strong>'+fmt(p.total)+'</strong></td>'+
    '<td style="color:#15803d">'+fmt(pa)+'</td>'+
    '<td style="font-weight:700;color:'+(os>0?'#b91c1c':'#15803d')+'">'+fmt(os)+'</td>'+
    '<td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td>'+
    '<td style="color:'+(d>60?'#dc2626':d>30?'#d97706':'#334155')+';font-weight:600">'+d+'d</td>'+
    '<td><span class="badge badge-'+st+'">'+st[0].toUpperCase()+st.slice(1)+'</span></td>'+
    '<td><div style="display:flex;gap:5px;flex-wrap:wrap">'+
      '<button class="btn btn-sm" style="background:#0369a1;color:#fff" title="View / Print" onclick="printPurchase(\''+p.id+'\')"><i class="fas fa-eye"></i></button>'+
      '<button class="btn btn-ghost btn-sm" onclick="openPurchaseModal(\''+p.id+'\')"><i class="fas fa-edit"></i></button>'+
      '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'purchase\',\''+p.id+'\')"><i class="fas fa-trash"></i></button>'+
    '</div></td>'+
  '</tr>';
}
function renderSupplierBalCards(){
  const cards=cSuppliers().map(s=>{
    const allCredit=APP.purchases.filter(p=>p.supplierId===s.id&&p.mode==='credit'&&p.status!=='cancelled').reduce((a,p)=>a+p.total,0);
    if(!allCredit) return '';
    const bal=supplierBalance(s.id); const os=Math.max(0,bal); const adv=Math.max(0,-bal);
    const shortName=s.name.length>22?s.name.slice(0,20)+'…':s.name;
    return '<div class="card" style="padding:14px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px"><div style="font-size:12px;font-weight:700;color:var(--text)">'+shortName+'</div>'+(adv>0?'<span class="badge badge-paid" style="font-size:10px">ADV ✓</span>':'')+'</div>'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:8px">'+
        '<div><div style="font-size:10px;color:#94a3b8">Credit Purchases</div><div style="font-size:13px;font-weight:700">'+fmt(allCredit)+'</div></div>'+
        '<div style="text-align:right"><div style="font-size:10px;color:'+(os>0?'#b91c1c':'#15803d')+'">'+(adv>0?'Advance':'Payable')+'</div><div style="font-size:13px;font-weight:800;color:'+(adv>0?'#15803d':os>0?'#b91c1c':'#15803d')+'">'+(adv>0?fmt(adv):fmt(os))+'</div></div>'+
      '</div>'+
      '<button class="btn btn-success btn-sm" style="width:100%;font-size:11px" onclick="openSupplierPaymentModal('+s.id+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Record Payment</button></div>';
  }).filter(Boolean).join('');
  const c=el('supplier-bal-cards'); if(c) c.innerHTML=cards||'<div style="color:#94a3b8;font-size:13px;padding:8px">No credit purchases yet.</div>';
}
function renderPurchases(){
  renderSupplierBalCards();
  buildMonthOptions('pc-mn', true, cPurchases().map(p => p.date));
  const q=(el('pc-q').value||'').toLowerCase(), sup=el('pc-sup').value, st=el('pc-st').value, mo=el('pc-mo').value, mn=el('pc-mn').value;
  let list=[...cPurchases()].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(q) list=list.filter(p=>p.billNo.toLowerCase().includes(q)||supplierName(p.supplierId).toLowerCase().includes(q)||p.items.some(i=>i.name.toLowerCase().includes(q)));
  if(sup) list=list.filter(p=>p.supplierId==sup);
  if(st) list=list.filter(p=>purchaseStatus(p)===st);
  if(mo) list=list.filter(p=>p.mode===mo);
  if(mn) list=list.filter(p=>p.date.startsWith(mn));
  el('pc-tot').textContent=list.length;
  el('pc-pa').textContent=list.filter(p=>purchaseStatus(p)==='paid').length;
  el('pc-pl').textContent=list.filter(p=>purchaseStatus(p)==='partial').length;
  el('pc-pn').textContent=list.filter(p=>purchaseStatus(p)==='pending').length;
  const tb=el('t-purchases'), em=el('pur-empty');
  if(!list.length){ tb.innerHTML=''; em.style.display='block'; return; }
  em.style.display='none';
  tb.innerHTML=list.map(purchaseTR).join('');
}
function resetPCF(){ ['pc-q','pc-sup','pc-st','pc-mo','pc-mn'].forEach(id=>{const e=el(id);if(e)e.value='';}); renderPurchases(); }

/* ═══════════════ PURCHASE FORM ═══════════════ */
function purRowHTML(item){
  item=item||{};
  const rid='pr'+Math.random().toString(36).slice(2,7);
  return '<div class="prow" id="'+rid+'">'+
    '<select class="inp prod-sel" onchange="onPurProdSel(this,\''+rid+'\')" style="font-size:12px"><option value="">— Select Product —</option>'+
      cProducts().map(p=>'<option value="'+p.id+'"'+(item.pid===p.id?' selected':'')+'>'+p.name+' ('+p.size+')</option>').join('')+
    '</select>'+
    '<input class="inp size-f" value="'+(item.size||'')+'" placeholder="Size" readonly style="font-size:12px">'+
    '<input class="inp price-f" type="number" value="'+(item.price||'')+'" placeholder="Rate" oninput="calcPurRow(\''+rid+'\')" style="font-size:12px">'+
    '<input class="inp qty-f" type="number" value="'+(item.qty||'')+'" placeholder="Qty" step="0.01" oninput="calcPurRow(\''+rid+'\')" style="font-size:12px">'+
    '<input class="inp total-f" value="'+(item.lt?fmtN(item.lt):'')+'" readonly style="font-size:12px;background:var(--surface-2)">'+
    '<button onclick="var e=document.getElementById(\''+rid+'\');e.parentNode.removeChild(e);calcPurGrand()" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;cursor:pointer;padding:6px 9px">×</button>'+
  '</div>';
}
function addPurRow(){ el('pur-rows').insertAdjacentHTML('beforeend', purRowHTML()); }
function onPurProdSel(sel,rid){ const p=cProducts().find(x=>x.id===parseInt(sel.value)); const row=el(rid); const charge=p&&p.unit==='charge'; row.querySelector('.size-f').value=(p&&!charge)?p.size:''; if(charge){ row.querySelector('.qty-f').value=1; row.querySelector('.price-f').value=''; } else if(p&&p.price&&!row.querySelector('.price-f').value)row.querySelector('.price-f').value=p.price; calcPurRow(rid); }
function calcPurRow(rid){ const row=el(rid); const rate=parseFloat(row.querySelector('.price-f').value)||0; const qty=parseFloat(row.querySelector('.qty-f').value)||0; row.querySelector('.total-f').value=rate&&qty?fmtN(rate*qty):''; calcPurGrand(); }
function calcPurGrand(){
  let base=0;
  document.querySelectorAll('#pur-rows .prow').forEach(row=>{ base+=(parseFloat(row.querySelector('.price-f').value)||0)*(parseFloat(row.querySelector('.qty-f').value)||0); });
  const gst=el('pur-gst')?.checked;
  const grand=gst?base*1.18:base;
  const info=el('pur-grand-total');
  if(info) info.innerHTML=(gst?'<span style="font-size:11px;color:#64748b;font-weight:500">Sub '+fmt(base)+' + GST 18% </span> ':'')+fmt(grand);
}
function onPurModeChange(){ const wrap=el('pur-upi-wrap'); if(wrap) wrap.style.display=(el('pur-mode').value==='upi')?'block':'none'; }
var _purIsEdit=false;
function onPurDateChange(){ if(_purIsEdit) return; const sid=parseInt(el('pur-supplier').value); if(sid) el('pur-bill').value=nextPurchaseNo(sid, el('pur-date').value); }
function updatePurSupplierWarn(sid){
  const warn=el('pur-supplier-warn'); if(!warn) return;
  if(!sid){ warn.style.display='none'; return; }
  const bal=supplierBalance(sid);
  if(bal>0){ warn.style.display='block'; warn.style.background='#fef2f2'; warn.style.color='#b91c1c'; warn.style.border='1px solid #fecaca'; warn.innerHTML='<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>You owe this supplier <b>'+fmt(bal)+'</b> — outstanding payable.'; }
  else if(bal<0){ warn.style.display='block'; warn.style.background='#f0fdf4'; warn.style.color='#15803d'; warn.style.border='1px solid #bbf7d0'; warn.innerHTML='<i class="fas fa-info-circle" style="margin-right:6px"></i>Advance with this supplier: <b>'+fmt(Math.abs(bal))+'</b>.'; }
  else warn.style.display='none';
}
function onPurchaseSupplier(){
  const sid=parseInt(el('pur-supplier').value);
  const billInp=el('pur-bill');
  if(!sid){ if(billInp)billInp.value=''; updatePurSupplierWarn(0); return; }
  // Auto-fill the purchase number from this supplier's series (PREFIX/MON/NN)
  if(billInp) billInp.value=nextPurchaseNo(sid, el('pur-date').value);
  updatePurSupplierWarn(sid);
}
function openPurchaseModal(id){
  const p=id?APP.purchases.find(x=>x.id===id):null;
  _purIsEdit=!!p;
  const supOpts='<option value="" disabled'+(p?'':' selected')+'>— Select Supplier —</option>'+cSuppliers().map(s=>'<option value="'+s.id+'"'+(p&&p.supplierId===s.id?' selected':'')+'>'+s.name+' ('+(s.purPrefix||'—')+')</option>').join('');
  const existingRows=p?p.items.map(purRowHTML).join(''):purRowHTML();
  const curLabel=(p&&p.docLabel)||'PURCHASE INVOICE';
  const html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1"><label>Supplier *</label><select class="inp" id="pur-supplier" onchange="onPurchaseSupplier()">'+supOpts+'</select>'+
        '<div id="pur-supplier-warn" style="display:none;margin-top:6px;padding:8px 10px;border-radius:7px;font-size:12px;font-weight:600"></div></div>'+
      '<div class="form-row"><label>Purchase No <span style="color:#94a3b8;font-weight:500">(PREFIX/MON/NN)</span></label><input class="inp" id="pur-bill" value="'+(p?p.billNo:'')+'" placeholder="Select a supplier first"></div>'+
      '<div class="form-row"><label>Date</label><input class="inp" id="pur-date" type="date" value="'+(p?p.date:TODAY)+'" onchange="onPurDateChange()"></div>'+
      '<div class="form-row"><label>Supplier Bill Ref</label><input class="inp" id="pur-ref-bill" value="'+(p?(p.refBillNo||''):'')+'" placeholder="Optional"></div>'+
      '<div class="form-row"><label>Payment Mode *</label><select class="inp" id="pur-mode" onchange="onPurModeChange()">'+
        '<option value="" disabled'+(p?'':' selected')+'>— Select Mode —</option>'+
        '<option value="cash"'+(p&&p.mode==='cash'?' selected':'')+'>Cash</option>'+
        '<option value="upi"'+(p&&p.mode==='upi'?' selected':'')+'>UPI</option>'+
        '<option value="credit"'+(p&&p.mode==='credit'?' selected':'')+'>Credit</option>'+
      '</select></div>'+
      '<div class="form-row" id="pur-upi-wrap" style="display:'+(p&&p.mode==='upi'?'block':'none')+'"><label>UPI Account *</label>'+upiSelectHTML('pur-upi', p?p.upiAccountId:null)+'</div>'+
      '<div class="form-row"><label>Vehicle No</label><input class="inp" id="pur-veh" value="'+(p?(p.vehicleNo||''):'')+'" placeholder="Optional"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Notes</label><input class="inp" id="pur-notes" value="'+(p?(p.notes||'').replace(/"/g,'&quot;'):'')+'" placeholder="Optional note"></div>'+
      '<input type="hidden" id="pur-recv" value="">'+
      '<div class="form-row" style="grid-column:1/-1;display:flex;align-items:center;gap:24px;flex-wrap:wrap">'+
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;font-weight:600"><input type="checkbox" id="pur-gst" onchange="calcPurGrand()"'+(p&&p.gstEnabled?' checked':'')+' style="width:16px;height:16px">Apply GST — CGST 9% + SGST 9%</label>'+
        '<div style="display:flex;align-items:center;gap:8px"><label style="margin:0">Document</label><select class="inp" id="pur-doc-label" style="width:auto"><option'+(curLabel==='PURCHASE INVOICE'?' selected':'')+'>PURCHASE INVOICE</option><option'+(curLabel==='PURCHASE ORDER'?' selected':'')+'>PURCHASE ORDER</option><option'+(curLabel==='GRN'?' selected':'')+'>GRN</option></select></div>'+
      '</div>'+
    '</div>'+
    '<div style="margin:14px 0 8px;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em">Products / Items</div>'+
    '<div style="display:grid;grid-template-columns:2fr 90px 90px 90px 100px 34px;gap:7px;margin-bottom:6px">'+['Product','Size','Rate','Qty','Total',''].map(h=>'<div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">'+h+'</div>').join('')+'</div>'+
    '<div id="pur-rows">'+existingRows+'</div>'+
    '<button onclick="addPurRow()" class="btn btn-ghost" style="font-size:12px;padding:6px 12px;margin-top:4px"><i class="fas fa-plus" style="margin-right:4px"></i>Add Row</button>'+
    '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;align-items:center;gap:12px"><div style="font-size:12px;color:#64748b">Grand Total</div><div id="pur-grand-total" style="font-size:20px;font-weight:800;color:var(--text)">₹0</div></div>';
  openModal(p?'Edit Purchase — '+p.billNo:'New Purchase', html, function(){ return savePurchase(id); }, true);
  setTimeout(function(){ calcPurGrand(); if(p) updatePurSupplierWarn(p.supplierId); }, 40);
}

/* ═══════════════ SUPPLIER DETAIL ═══════════════ */
var currentSupplierId=null, lastPageBeforeSupplierDetail='suppliers';
function openSupplierDetail(id, from){ currentSupplierId=id; lastPageBeforeSupplierDetail=from||'suppliers'; _sldFrom=''; _sldTo=''; _sldPage=1; nav('supplier-detail'); }
function goBackFromSupplierDetail(){ nav(lastPageBeforeSupplierDetail||'suppliers'); }
function renderSupplierDetail(){
  const s=APP.suppliers.find(x=>x.id===currentSupplierId); if(!s) return;
  const st=supplierStats(s.id); const r=riskLevel(st.oldest,st.os);
  el('sd-hdr-card').innerHTML='<div class="card" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">'+
    '<div><div style="font-size:18px;font-weight:800;color:var(--text)">'+s.name+'</div><div style="font-size:12px;color:#64748b">'+(s.gst||'—')+' · '+(s.phone||'—')+' · series '+(s.purPrefix||'—')+'</div></div>'+
    '<div style="display:flex;gap:22px;flex-wrap:wrap">'+
      '<div><div style="font-size:10px;color:#94a3b8">Total Purchases</div><div style="font-size:16px;font-weight:800">'+fmt(st.totalPurch)+'</div></div>'+
      '<div><div style="font-size:10px;color:#94a3b8">Paid</div><div style="font-size:16px;font-weight:800;color:#15803d">'+fmt(st.totalPaid)+'</div></div>'+
      '<div><div style="font-size:10px;color:#94a3b8">'+(st.advance>0?'Advance':'Payable')+'</div><div style="font-size:16px;font-weight:800;color:'+(st.advance>0?'#15803d':st.os>0?'#b91c1c':'#15803d')+'">'+(st.advance>0?fmt(st.advance):fmt(st.os))+'</div></div>'+
      '<div style="align-self:center"><span class="badge '+r.cls+'">'+r.label+'</span></div>'+
    '</div></div>';
  showSdTab('overview');
}
function showSdTab(tab){
  document.querySelectorAll('#sd-tabs .cd-tab').forEach((b,i)=>b.classList.toggle('active', ['overview','purchases','payments','ledger'][i]===tab));
  ['overview','purchases','payments','ledger'].forEach(t=>{ const pane=el('sdp-'+t); if(pane) pane.classList.toggle('active', t===tab); });
  if(tab==='overview') renderSdOverview();
  if(tab==='purchases') renderSdPurchases();
  if(tab==='payments') renderSdPayments();
  if(tab==='ledger') renderSdLedger();
}
function renderSdOverview(){
  const id=currentSupplierId;
  const pending=APP.purchases.filter(p=>p.supplierId===id&&p.mode==='credit'&&purchaseOutstanding(p)>0&&p.status!=='cancelled').sort((a,b)=>new Date(a.date)-new Date(b.date));
  const recent=[...APP.purchases.filter(p=>p.supplierId===id&&p.status!=='cancelled')].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  const pays=[...APP.supplierPayments.filter(p=>p.supplierId===id)].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);
  el('sdp-overview').innerHTML='<div class="grid-2" style="gap:14px">'+
    '<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:10px">Pending Payables (oldest first)</div>'+
      (pending.length?pending.map(p=>'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="font-family:ui-monospace,monospace;color:#1d4ed8;cursor:pointer" onclick="printPurchase(\''+p.id+'\')">'+p.billNo+'</span><span style="color:#94a3b8">'+daysOld(p.date)+'d</span><span style="font-weight:700;color:#b91c1c">'+fmt(purchaseOutstanding(p))+'</span></div>').join(''):'<div style="color:#94a3b8;font-size:13px">No pending payables 🎉</div>')+
    '</div>'+
    '<div class="card"><div style="font-weight:700;font-size:13px;margin-bottom:10px">Recent Payments</div>'+
      (pays.length?pays.map(p=>'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span>'+fmtD(p.date)+'</span><span class="badge badge-'+p.mode+'" style="font-size:10px">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span><span style="font-weight:700;color:#15803d">'+fmt(p.amount)+'</span></div>').join(''):'<div style="color:#94a3b8;font-size:13px">No payments yet.</div>')+
    '</div></div>';
}
function renderSdPurchases(){
  const list=[...APP.purchases.filter(p=>p.supplierId===currentSupplierId&&p.status!=='cancelled')].sort((a,b)=>new Date(b.date)-new Date(a.date));
  el('sdp-purchases').innerHTML='<div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Purchase No</th><th>Date</th><th>Supplier</th><th>Items</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Mode</th><th>Age</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+(list.length?list.map(purchaseTR).join(''):'<tr><td colspan="11" style="text-align:center;color:#94a3b8;padding:20px">No purchases.</td></tr>')+'</tbody></table></div></div>';
}
function renderSdPayments(){
  const list=[...APP.supplierPayments.filter(p=>p.supplierId===currentSupplierId)].sort((a,b)=>new Date(b.date)-new Date(a.date));
  el('sdp-payments').innerHTML='<div class="card"><div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-success btn-sm" onclick="openSupplierPaymentModal('+currentSupplierId+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Record Payment</button></div>'+
    '<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Note</th><th></th></tr></thead><tbody>'+(list.length?list.map(p=>'<tr><td>'+fmtD(p.date)+'</td><td style="font-weight:700;color:#15803d">'+fmt(p.amount)+'</td><td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td><td style="color:#64748b">'+(p.note||'—')+'</td><td><button class="btn btn-ghost btn-sm" onclick="openEditSupplierPaymentModal(\''+p.id+'\')"><i class="fas fa-edit"></i></button> <button class="btn btn-danger btn-sm" onclick="deleteSupplierPayment(\''+p.id+'\')"><i class="fas fa-trash"></i></button></td></tr>').join(''):'<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px">No payments.</td></tr>')+'</tbody></table></div></div>';
}
var _sldFrom='', _sldTo='', _sldPage=1; const _sldPageSize=20;
function renderSdLedger(){
  const id=currentSupplierId; const s=APP.suppliers.find(x=>x.id===id); if(!s) return;
  const ob=s.openingBalance||0;
  let ev=[];
  APP.purchases.filter(p=>p.supplierId===id&&p.mode==='credit'&&p.status!=='cancelled').forEach(p=>ev.push({date:p.date,type:'buy',amount:p.total,ref:p.billNo,items:p.items,notes:p.notes,gstEnabled:p.gstEnabled,id:p.id}));
  APP.supplierPayments.filter(p=>p.supplierId===id).forEach(p=>ev.push({date:p.date,type:'pay',amount:p.amount,ref:'PMT',desc:(p.note||'Payment made')+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):''),mode:p.mode}));
  ev.sort((a,b)=>new Date(a.date)-new Date(b.date)||(a.type==='pay'?1:-1));
  let running=ob;
  const obRow=(ob!==0)?'<tr style="background:rgba(245,158,11,.12)"><td>'+(s.openingBalanceDate?fmtD(s.openingBalanceDate):'—')+'</td><td><strong>Opening Balance</strong></td><td style="color:#b91c1c;font-weight:700">'+(ob>0?fmt(ob):'—')+'</td><td style="color:#15803d;font-weight:700">'+(ob<0?fmt(ob):'—')+'</td><td style="font-weight:800">'+fmt(ob)+' '+(ob>0?'Payable':'Adv')+'</td></tr>':'';
  const rows=ev.map(e=>{
    if(e.type==='buy'){ running+=e.amount; const c=running>0?'#b91c1c':running<0?'#15803d':'#475569';
      return '<tr><td style="vertical-align:top">'+fmtD(e.date)+'</td><td style="vertical-align:top"><strong style="color:#1d4ed8;cursor:pointer;font-family:ui-monospace,monospace" onclick="printPurchase(\''+e.id+'\')">'+e.ref+'</strong>'+ledgerItemsHTML(e)+'</td><td style="color:#b91c1c;font-weight:700;vertical-align:top">'+fmt(e.amount)+'</td><td style="color:#94a3b8;vertical-align:top">—</td><td style="font-weight:800;color:'+c+';vertical-align:top">'+fmt(running)+' '+(running>0?'Payable':running<0?'Adv':'Nil')+'</td></tr>';
    } else { running-=e.amount; const c=running>0?'#b91c1c':running<0?'#15803d':'#475569';
      return '<tr style="background:rgba(34,197,94,.10)"><td>'+fmtD(e.date)+'</td><td><span style="color:#15803d;font-weight:700">Payment</span> <span class="badge badge-'+e.mode+'" style="font-size:10px">'+e.mode.toUpperCase()+'</span><br><span style="font-size:11px;color:#64748b">'+e.desc+'</span></td><td style="color:#94a3b8">—</td><td style="color:#15803d;font-weight:700">'+fmt(e.amount)+'</td><td style="font-weight:800;color:'+c+'">'+fmt(running)+' '+(running>0?'Payable':running<0?'Adv':'Nil')+'</td></tr>';
    }
  }).join('');
  const bal=supplierBalance(id);
  // Grand Total — total purchased vs total paid across the whole statement, with closing balance
  const totalBuy=ev.filter(e=>e.type==='buy').reduce((s,e)=>s+e.amount,0);
  const totalPaid=ev.filter(e=>e.type==='pay').reduce((s,e)=>s+e.amount,0);
  const gcColor=bal>0?'#fca5a5':bal<0?'#86efac':'#cbd5e1';
  const gcTxt=fmt(Math.abs(bal))+' '+(bal>0?'Payable':bal<0?'Advance':'Nil');
  const grandRow='<tr style="background:#7c2d12;color:#fff;font-weight:800">'+
    '<td colspan="2" style="padding:12px 13px;font-size:12px;text-transform:uppercase;letter-spacing:.04em"><i class="fas fa-scale-balanced" style="margin-right:6px"></i>Grand Total — Purchased vs Paid</td>'+
    '<td style="padding:12px 13px;color:#fdba74;font-size:14px">'+fmt(totalBuy)+'</td>'+
    '<td style="padding:12px 13px;color:#86efac;font-size:14px">'+fmt(totalPaid)+'</td>'+
    '<td style="padding:12px 13px;font-size:14px;color:'+gcColor+'">'+gcTxt+'</td></tr>';
  el('sdp-ledger').innerHTML='<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px"><div style="font-weight:700;font-size:13px">Account Statement</div>'+
    '<div style="display:flex;gap:8px"><button class="btn" style="background:#dc5800;color:#fff;font-size:12px" onclick="downloadSupplierLedgerPDF('+id+')"><i class="fas fa-file-pdf" style="margin-right:4px"></i>PDF</button><button class="btn btn-success btn-sm" onclick="openSupplierPaymentModal('+id+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Record Payment</button></div></div>'+
    (ev.length?'<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Particulars</th><th style="color:#b91c1c">Purchases (Payable)</th><th style="color:#15803d">Payments</th><th>Balance</th></tr></thead><tbody>'+obRow+rows+'</tbody><tfoot>'+grandRow+'</tfoot></table></div>':'<div style="text-align:center;padding:30px;color:#94a3b8">No credit transactions yet.</div>')+'</div>';
}

/* ═══════════════ SUPPLIER PAYMENTS ═══════════════ */
function renderSupplierPayments(){
  populateSupplierSelects();
  const f=el('sp-sup-filter')?.value;
  let list=[...cSupplierPayments()].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(f) list=list.filter(p=>p.supplierId==f);
  const total=list.reduce((s,p)=>s+p.amount,0);
  const mn=list.filter(p=>p.date.startsWith(TODAY.slice(0,7))).reduce((s,p)=>s+p.amount,0);
  if(el('sp-tot')) el('sp-tot').textContent=fmtN(total);
  if(el('sp-mn')) el('sp-mn').textContent=fmtN(mn);
  if(el('sp-cnt')) el('sp-cnt').textContent=list.length;
  el('t-supplier-payments').innerHTML=list.length?list.map(p=>'<tr>'+
    '<td>'+fmtD(p.date)+'</td>'+
    '<td><span style="font-weight:600;color:#1d4ed8;cursor:pointer" onclick="openSupplierDetail('+p.supplierId+',\'supplier-payments\')">'+supplierName(p.supplierId)+'</span></td>'+
    '<td style="font-weight:700;color:#15803d">'+fmt(p.amount)+'</td>'+
    '<td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td>'+
    '<td style="color:#64748b">'+(p.note||'—')+'</td>'+
    '<td><button class="btn btn-ghost btn-sm" onclick="openEditSupplierPaymentModal(\''+p.id+'\')"><i class="fas fa-edit"></i></button> <button class="btn btn-danger btn-sm" onclick="deleteSupplierPayment(\''+p.id+'\')"><i class="fas fa-trash"></i></button></td>'+
  '</tr>').join(''):'<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:26px">No payments recorded.</td></tr>';
}
function _supPayFields(pfx, cur){
  return '<div class="form-row"><label>Amount (₹) *</label><input class="inp" id="'+pfx+'-amt" type="number" value="'+(cur?cur.amount:'')+'" placeholder="0"></div>'+
    '<div class="form-row"><label>Date</label><input class="inp" id="'+pfx+'-date" type="date" value="'+(cur?cur.date:TODAY)+'"></div>'+
    '<div class="form-row"><label>Mode *</label><select class="inp" id="'+pfx+'-mode" onchange="el(\''+pfx+'-upi-wrap\').style.display=this.value===\'upi\'?\'block\':\'none\'">'+
      '<option value="" disabled'+(cur?'':' selected')+'>— Select Mode —</option>'+
      '<option value="cash"'+(cur&&cur.mode==='cash'?' selected':'')+'>Cash</option>'+
      '<option value="upi"'+(cur&&cur.mode==='upi'?' selected':'')+'>UPI</option>'+
    '</select></div>'+
    '<div class="form-row" id="'+pfx+'-upi-wrap" style="display:'+(cur&&cur.mode==='upi'?'block':'none')+'"><label>UPI Account *</label>'+upiSelectHTML(pfx+'-upi', cur?cur.upiAccountId:null)+'</div>'+
    '<div class="form-row" style="grid-column:1/-1"><label>Note</label><input class="inp" id="'+pfx+'-note" value="'+(cur?(cur.note||'').replace(/"/g,'&quot;'):'')+'" placeholder="Optional"></div>';
}
function openSupplierPaymentModal(supplierId){
  const s=APP.suppliers.find(x=>x.id===supplierId); if(!s) return;
  const bal=supplierBalance(supplierId);
  const html='<div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between"><div style="font-weight:700">'+s.name+'</div><div style="font-weight:800;color:'+(bal>0?'#b91c1c':'#15803d')+'">'+(bal>0?'Payable '+fmt(bal):bal<0?'Advance '+fmt(Math.abs(bal)):'Clear')+'</div></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+_supPayFields('spm', null)+'</div>';
  openModal('Record Payment — '+s.name, html, function(){ return saveSupplierPayment(supplierId); }, false);
}
function openQuickSupplierPaymentModal(){
  const supOpts='<option value="" disabled selected>— Select Supplier —</option>'+cSuppliers().map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  const html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="form-row" style="grid-column:1/-1"><label>Supplier *</label><select class="inp" id="sqp-supplier" onchange="var b=supplierBalance(parseInt(this.value));el(\'sqp-info\').innerHTML=b>0?\'<span style=color:#b91c1c;font-weight:700>Payable: \'+fmt(b)+\'</span>\':b<0?\'<span style=color:#15803d>Advance: \'+fmt(Math.abs(b))+\'</span>\':\'\'">'+supOpts+'</select><div id="sqp-info" style="margin-top:6px;font-size:12px"></div></div>'+
    _supPayFields('sqp', null)+
    '</div>';
  openModal('Record Supplier Payment', html, function(){ return saveQuickSupplierPayment(); }, false);
}
function openEditSupplierPaymentModal(id){
  const p=APP.supplierPayments.find(x=>x.id===id); if(!p) return;
  const supOpts=cSuppliers().map(s=>'<option value="'+s.id+'"'+(s.id===p.supplierId?' selected':'')+'>'+s.name+'</option>').join('');
  const html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="form-row" style="grid-column:1/-1"><label>Supplier</label><select class="inp" id="sep-supplier">'+supOpts+'</select></div>'+
    _supPayFields('sep', p)+
    '</div>';
  openModal('Edit Payment', html, function(){ return saveEditSupplierPayment(id); }, false);
}
function deleteSupplierPayment(id){
  el('modal-title').textContent='Confirm Delete';
  el('modal-body').innerHTML='<div style="text-align:center;padding:10px 0"><i class="fas fa-trash-alt" style="font-size:36px;color:#ef4444;margin-bottom:12px;display:block"></i><div style="font-size:15px;font-weight:700;color:var(--text)">Delete this payment?</div></div>';
  el('modal-box').className='modal-box';
  el('modal').classList.add('open');
  el('modal-foot').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="doDeleteSupplierPayment(\''+id+'\')">Delete</button>';
}

/* ═══════════════ PAYABLES DUE (follow-ups) ═══════════════ */
function renderPurchaseFollowups(){
  const rows=cSuppliers().map(s=>({s,st:supplierStats(s.id)})).filter(x=>x.st.os>0).sort((a,b)=>b.st.oldest-a.st.oldest);
  const badge=el('nav-pfu-cnt'); if(badge){ badge.textContent=rows.length; badge.style.display=rows.length?'inline-block':'none'; }
  const totalPay=rows.reduce((s,x)=>s+x.st.os,0);
  const st=el('pfu-stats'); if(st) st.innerHTML=
    '<div class="card"><div class="stat-label">Suppliers to Pay</div><div class="stat-val" style="color:#b91c1c">'+rows.length+'</div></div>'+
    '<div class="card"><div class="stat-label">Total Payable</div><div class="stat-val" style="color:#b91c1c">'+fmt(totalPay)+'</div></div>'+
    '<div class="card"><div class="stat-label">Oldest</div><div class="stat-val">'+(rows.length?rows[0].st.oldest+'d':'—')+'</div></div>';
  el('pfu-list').innerHTML=rows.length?('<div class="card"><div style="overflow-x:auto"><table><thead><tr><th>Supplier</th><th>Payable</th><th>Oldest</th><th>Risk</th><th>Action</th></tr></thead><tbody>'+rows.map(x=>{const r=riskLevel(x.st.oldest,x.st.os);return '<tr><td style="font-weight:700">'+x.s.name+'<div style="font-size:11px;color:#94a3b8">'+(x.s.phone||'')+'</div></td><td style="font-weight:800;color:#b91c1c">'+fmt(x.st.os)+'</td><td>'+x.st.oldest+'d</td><td><span class="badge '+r.cls+'">'+r.label+'</span></td><td><button class="btn btn-success btn-sm" onclick="openSupplierPaymentModal('+x.s.id+')"><i class="fas fa-rupee-sign"></i></button> <button class="btn btn-ghost btn-sm" onclick="openSupplierDetail('+x.s.id+',\'purchase-followups\')"><i class="fas fa-truck"></i></button></td></tr>';}).join('')+'</tbody></table></div></div>'):'<div class="card" style="text-align:center;color:#94a3b8;padding:30px">No pending payables 🎉</div>';
}

/* ═══════════════ PAYABLES AGING ═══════════════ */
function renderPayablesAging(){
  const b=payablesAgingBuckets(null);
  if(el('pa0')) el('pa0').innerHTML=fmt(b.b0);
  if(el('pa31')) el('pa31').innerHTML=fmt(b.b31);
  if(el('pa61')) el('pa61').innerHTML=fmt(b.b61);
  if(el('pa90')) el('pa90').innerHTML=fmt(b.b90);
  el('t-payables-aging').innerHTML=cSuppliers().map(s=>{
    const bk=payablesAgingBuckets(s.id); const st=supplierStats(s.id); if(st.os<=0)return ''; const r=riskLevel(st.oldest,st.os);
    return '<tr><td style="font-weight:700">'+s.name+'</td><td>'+fmt(bk.b0)+'</td><td style="color:#d97706">'+fmt(bk.b31)+'</td><td style="color:#dc2626">'+fmt(bk.b61)+'</td><td style="color:#ef4444">'+fmt(bk.b90)+'</td><td style="font-weight:800;color:#b91c1c">'+fmt(st.os)+'</td><td>'+st.oldest+'d</td><td><span class="badge '+r.cls+'">'+r.label+'</span></td></tr>';
  }).filter(Boolean).join('')||'<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:20px">No payables.</td></tr>';
}

/* ═══════════════ UPI ACCOUNTS + REPORT ═══════════════ */
var _upiMonth = TODAY.slice(0,7);   // main UPI page period filter; '' = all data, default = current month
// Received/paid totals for an account. Pass a 'YYYY-MM' month to scope to that month; omit for lifetime.
function upiTotals(accId, month){
  const inM=d=>!month||(d||'').startsWith(month);
  const recvCh=cChallans().filter(c=>c.mode==='upi'&&c.upiAccountId===accId&&inM(c.date)).reduce((s,c)=>s+c.total,0);
  const recvPm=cPayments().filter(p=>p.mode==='upi'&&p.upiAccountId===accId&&inM(p.date)).reduce((s,p)=>s+p.amount,0);
  const paidPu=cPurchases().filter(p=>p.mode==='upi'&&p.upiAccountId===accId&&inM(p.date)).reduce((s,p)=>s+p.total,0);
  const paidSp=cSupplierPayments().filter(p=>p.mode==='upi'&&p.upiAccountId===accId&&inM(p.date)).reduce((s,p)=>s+p.amount,0);
  return {received:recvCh+recvPm, paid:paidPu+paidSp};
}
// Closing balance = opening + all received − all paid up to end of `month` (lifetime if no month)
function upiClosing(u, month){
  const upto=d=>!month||(d||'').slice(0,7)<=month;
  const recv=cChallans().filter(c=>c.mode==='upi'&&c.upiAccountId===u.id&&upto(c.date)).reduce((s,c)=>s+c.total,0)
            +cPayments().filter(p=>p.mode==='upi'&&p.upiAccountId===u.id&&upto(p.date)).reduce((s,p)=>s+p.amount,0);
  const paid=cPurchases().filter(p=>p.mode==='upi'&&p.upiAccountId===u.id&&upto(p.date)).reduce((s,p)=>s+p.total,0)
            +cSupplierPayments().filter(p=>p.mode==='upi'&&p.upiAccountId===u.id&&upto(p.date)).reduce((s,p)=>s+p.amount,0);
  return (u.openingBalance||0)+recv-paid;
}
function upiAllMonths(){
  const set={};
  cChallans().filter(c=>c.mode==='upi').forEach(c=>set[c.date.slice(0,7)]=1);
  cPayments().filter(p=>p.mode==='upi').forEach(p=>set[p.date.slice(0,7)]=1);
  cPurchases().filter(p=>p.mode==='upi').forEach(p=>set[p.date.slice(0,7)]=1);
  cSupplierPayments().filter(p=>p.mode==='upi').forEach(p=>set[p.date.slice(0,7)]=1);
  set[TODAY.slice(0,7)]=1;
  return Object.keys(set).sort().reverse();
}
// All UPI movements through an account: received (sales + client payments) and paid (purchases + supplier payments)
function upiTransactions(accId){
  const received=[], paid=[];
  cChallans().filter(c=>c.mode==='upi'&&c.upiAccountId===accId).forEach(c=>received.push({date:c.date,kind:'Sale',party:clientName(c.clientId),ref:c.billNo,amount:c.total,note:c.notes||''}));
  cPayments().filter(p=>p.mode==='upi'&&p.upiAccountId===accId).forEach(p=>received.push({date:p.date,kind:'Client Payment',party:clientName(p.clientId),ref:'—',amount:p.amount,note:p.note||''}));
  cPurchases().filter(p=>p.mode==='upi'&&p.upiAccountId===accId).forEach(p=>paid.push({date:p.date,kind:'Purchase',party:supplierName(p.supplierId),ref:p.billNo,amount:p.total,note:p.notes||''}));
  cSupplierPayments().filter(p=>p.mode==='upi'&&p.upiAccountId===accId).forEach(p=>paid.push({date:p.date,kind:'Supplier Payment',party:supplierName(p.supplierId),ref:'—',amount:p.amount,note:p.note||''}));
  received.sort((a,b)=>new Date(b.date)-new Date(a.date));
  paid.sort((a,b)=>new Date(b.date)-new Date(a.date));
  return {received, paid};
}
function renderUpiReport(){
  const accts=cUpiAccounts();
  const period=_upiMonth;
  const inM=d=>!period||(d||'').startsWith(period);
  const upto=d=>!period||(d||'').slice(0,7)<=period;
  const scopeLbl=period?new Date(period+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'All data';
  // Period selector
  const msel=el('upi-month');
  if(msel){ msel.innerHTML='<option value="">All Data</option>'+upiAllMonths().map(m=>{const d=new Date(m+'-01');return '<option value="'+m+'"'+(period===m?' selected':'')+'>'+d.toLocaleDateString('en-IN',{month:'short',year:'numeric'})+'</option>';}).join(''); msel.value=period; }

  let totRecv=0, totPaid=0, totNet=0;
  const cards=[];
  const rows=accts.map(u=>{
    const t=upiTotals(u.id, period); const net=upiClosing(u, period);
    totRecv+=t.received; totPaid+=t.paid; totNet+=net;
    cards.push('<div class="card" style="cursor:pointer" onclick="openUpiDetail('+u.id+')">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">'+
        '<div style="display:flex;align-items:center;gap:8px"><div class="icon-box" style="background:#ede9fe;color:#6d28d9"><i class="fas fa-mobile-screen-button"></i></div><div style="font-weight:700;font-size:13px">'+u.name+'</div></div>'+
        '<span class="badge" style="background:'+(net>=0?'#dcfce7':'#fee2e2')+';color:'+(net>=0?'#15803d':'#b91c1c')+'">Bal '+fmt(net)+'</span>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">'+
        '<div><div style="font-size:10px;color:#94a3b8">Opening</div><div style="font-size:13px;font-weight:700">'+fmt(u.openingBalance||0)+'</div></div>'+
        '<div><div style="font-size:10px;color:#15803d">Received</div><div style="font-size:13px;font-weight:800;color:#15803d">'+fmt(t.received)+'</div></div>'+
        '<div><div style="font-size:10px;color:#b91c1c">Paid</div><div style="font-size:13px;font-weight:800;color:#b91c1c">'+fmt(t.paid)+'</div></div>'+
      '</div>'+
      '<button class="btn btn-ghost btn-sm" style="width:100%;font-size:11px" onclick="event.stopPropagation();openUpiDetail('+u.id+')"><i class="fas fa-list" style="margin-right:4px"></i>View Transactions</button></div>');
    return '<tr><td style="font-weight:700;color:#1d4ed8;cursor:pointer" onclick="openUpiDetail('+u.id+')">'+u.name+'</td><td>'+fmt(u.openingBalance||0)+'</td><td style="color:#15803d;font-weight:700">'+fmt(t.received)+'</td><td style="color:#b91c1c;font-weight:700">'+fmt(t.paid)+'</td><td style="font-weight:800;color:'+(net>=0?'#15803d':'#b91c1c')+'">'+fmt(net)+'</td>'+
      '<td><button class="btn btn-ghost btn-sm" onclick="openUpiAccountModal('+u.id+')"><i class="fas fa-edit"></i></button> <button class="btn btn-danger btn-sm" onclick="deleteUpiAccount('+u.id+')"><i class="fas fa-trash"></i></button></td></tr>';
  }).join('');
  const cardsEl=el('upi-cards'); if(cardsEl) cardsEl.innerHTML=cards.join('')||'<div style="color:#94a3b8;font-size:13px;padding:8px">No UPI accounts yet — add one to start tracking.</div>';
  // unassigned UPI (no account picked) — received/paid scoped to period, closing cumulative
  const unRecv=cChallans().filter(c=>c.mode==='upi'&&!c.upiAccountId&&inM(c.date)).reduce((s,c)=>s+c.total,0)+cPayments().filter(p=>p.mode==='upi'&&!p.upiAccountId&&inM(p.date)).reduce((s,p)=>s+p.amount,0);
  const unPaid=cPurchases().filter(p=>p.mode==='upi'&&!p.upiAccountId&&inM(p.date)).reduce((s,p)=>s+p.total,0)+cSupplierPayments().filter(p=>p.mode==='upi'&&!p.upiAccountId&&inM(p.date)).reduce((s,p)=>s+p.amount,0);
  const unClose=(cChallans().filter(c=>c.mode==='upi'&&!c.upiAccountId&&upto(c.date)).reduce((s,c)=>s+c.total,0)+cPayments().filter(p=>p.mode==='upi'&&!p.upiAccountId&&upto(p.date)).reduce((s,p)=>s+p.amount,0))-(cPurchases().filter(p=>p.mode==='upi'&&!p.upiAccountId&&upto(p.date)).reduce((s,p)=>s+p.total,0)+cSupplierPayments().filter(p=>p.mode==='upi'&&!p.upiAccountId&&upto(p.date)).reduce((s,p)=>s+p.amount,0));
  const unRow=(unRecv||unPaid)?'<tr style="background:rgba(245,158,11,.12)"><td style="color:#92400e">Unassigned</td><td>—</td><td style="color:#15803d">'+fmt(unRecv)+'</td><td style="color:#b91c1c">'+fmt(unPaid)+'</td><td>'+fmt(unClose)+'</td><td></td></tr>':'';
  const totOpen=accts.reduce((s,u)=>s+(u.openingBalance||0),0);
  const totalRow=accts.length?'<tr style="background:#0f172a;color:#fff;font-weight:800"><td style="padding:11px 13px">TOTAL</td><td style="padding:11px 13px">'+fmt(totOpen)+'</td><td style="padding:11px 13px;color:#4ade80">'+fmt(totRecv+unRecv)+'</td><td style="padding:11px 13px;color:#fca5a5">'+fmt(totPaid+unPaid)+'</td><td style="padding:11px 13px">'+fmt(totNet+unClose)+'</td><td></td></tr>':'';
  el('t-upi').innerHTML=(rows||unRow)?(rows+unRow+totalRow):'<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">No UPI accounts yet.</td></tr>';
  const st=el('upi-stats'); if(st) st.innerHTML=
    '<div class="stat-card"><div class="icon-box" style="background:#ede9fe;color:#6d28d9"><i class="fas fa-mobile-screen-button"></i></div><div><div class="stat-label">Accounts</div><div class="stat-val">'+accts.length+'</div><div class="stat-hint">'+scopeLbl+'</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#dcfce7;color:#15803d"><i class="fas fa-arrow-down"></i></div><div><div class="stat-label">Received</div><div class="stat-val" style="color:#15803d">'+fmt(totRecv+unRecv)+'</div><div class="stat-hint">'+scopeLbl+'</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#fee2e2;color:#b91c1c"><i class="fas fa-arrow-up"></i></div><div><div class="stat-label">Paid</div><div class="stat-val" style="color:#b91c1c">'+fmt(totPaid+unPaid)+'</div><div class="stat-hint">'+scopeLbl+'</div></div></div>'+
    '<div class="stat-card"><div class="icon-box" style="background:#dbeafe;color:#1d4ed8"><i class="fas fa-scale-balanced"></i></div><div><div class="stat-label">Net Balance</div><div class="stat-val">'+fmt(totNet+unClose)+'</div><div class="stat-hint">as of '+scopeLbl+'</div></div></div>';
}
function openUpiAccountModal(id){
  const u=id?APP.upiAccounts.find(x=>x.id===id):null;
  const html='<div class="form-row"><label>Account Name *</label><input class="inp" id="upi-name" value="'+(u?u.name.replace(/"/g,'&quot;'):'')+'" placeholder="e.g. UPI-Karan"></div>'+
    '<div class="form-row"><label>Opening Balance (₹)</label><input class="inp" id="upi-ob" type="number" value="'+(u?(u.openingBalance||0):0)+'"></div>';
  openModal(u?'Edit UPI Account':'New UPI Account', html, function(){ return saveUpiAccount(id); }, false);
}

/* ═══════════════ UPI ACCOUNT DETAIL (received / paid / ledger) ═══════════════ */
var currentUpiId=null, lastPageBeforeUpiDetail='upi', _udTab='received', _udMonth=TODAY.slice(0,7);
function openUpiDetail(id){ currentUpiId=id; lastPageBeforeUpiDetail='upi'; _udTab='received'; _udMonth=TODAY.slice(0,7); nav('upi-detail'); }
function goBackFromUpiDetail(){ nav(lastPageBeforeUpiDetail||'upi'); }
function udSetMonth(v){ _udMonth=v; showUdTab(_udTab); }
function _udMonthMatch(dateStr){ return !_udMonth || (dateStr||'').startsWith(_udMonth); }
// Month dropdown built from this account's own transaction dates
function _udMonthOptions(){
  const tx=upiTransactions(currentUpiId);
  const set={}; tx.received.concat(tx.paid).forEach(x=>{ if(x.date) set[x.date.slice(0,7)]=true; });
  set[TODAY.slice(0,7)]=true;
  const months=Object.keys(set).sort().reverse();
  return '<option value="">All Months</option>'+months.map(m=>{
    const d=new Date(m+'-01'); const lbl=d.toLocaleDateString('en-IN',{month:'short',year:'numeric'});
    return '<option value="'+m+'"'+(_udMonth===m?' selected':'')+'>'+lbl+'</option>';
  }).join('');
}
// Controls bar (month filter + PDF for the current tab) shown atop each pane
function _udBar(title, color){
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">'+
    '<div style="font-weight:700;font-size:13px;color:'+(color||'#0f172a')+'">'+title+'</div>'+
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+
      '<label style="margin:0;font-size:12px;color:#64748b">Month</label>'+
      '<select class="inp" style="width:auto;padding:5px 9px;font-size:12px" onchange="udSetMonth(this.value)">'+_udMonthOptions()+'</select>'+
      '<button class="btn" style="background:#dc5800;color:#fff;font-size:12px;padding:6px 12px" onclick="downloadUpiTabPDF()"><i class="fas fa-file-pdf" style="margin-right:4px"></i>PDF</button>'+
    '</div></div>';
}
function renderUpiDetail(){
  const u=APP.upiAccounts.find(x=>x.id===currentUpiId); if(!u) return;
  const t=upiTotals(u.id); const net=(u.openingBalance||0)+t.received-t.paid;
  el('ud-hdr-card').innerHTML='<div class="card" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px">'+
    '<div style="display:flex;align-items:center;gap:10px"><div class="icon-box" style="background:#ede9fe;color:#6d28d9"><i class="fas fa-mobile-screen-button"></i></div><div><div style="font-size:18px;font-weight:800;color:var(--text)">'+u.name+'</div><div style="font-size:12px;color:#64748b">UPI account · lifetime totals</div></div></div>'+
    '<div style="display:flex;gap:22px;flex-wrap:wrap">'+
      '<div><div style="font-size:10px;color:#94a3b8">Opening</div><div style="font-size:16px;font-weight:800">'+fmt(u.openingBalance||0)+'</div></div>'+
      '<div><div style="font-size:10px;color:#94a3b8">Received</div><div style="font-size:16px;font-weight:800;color:#15803d">'+fmt(t.received)+'</div></div>'+
      '<div><div style="font-size:10px;color:#94a3b8">Paid</div><div style="font-size:16px;font-weight:800;color:#b91c1c">'+fmt(t.paid)+'</div></div>'+
      '<div><div style="font-size:10px;color:#94a3b8">Net Balance</div><div style="font-size:16px;font-weight:800;color:'+(net>=0?'#15803d':'#b91c1c')+'">'+fmt(net)+'</div></div>'+
    '</div></div>';
  showUdTab(_udTab||'received');
}
function showUdTab(tab){
  _udTab=tab;
  document.querySelectorAll('#ud-tabs .cd-tab').forEach((b,i)=>b.classList.toggle('active', ['received','paid','ledger'][i]===tab));
  ['received','paid','ledger'].forEach(t=>{ const p=el('udp-'+t); if(p) p.classList.toggle('active', t===tab); });
  if(tab==='received') renderUdReceived();
  if(tab==='paid') renderUdPaid();
  if(tab==='ledger') renderUdLedger();
}
function _udTxRows(list, color){
  return list.length?list.map(x=>'<tr><td>'+fmtD(x.date)+'</td><td><span class="badge" style="background:var(--surface-2);color:var(--text-soft)">'+x.kind+'</span></td><td style="font-weight:600">'+x.party+'</td><td style="font-family:ui-monospace,monospace;color:#64748b">'+x.ref+'</td><td style="font-weight:700;color:'+color+'">'+fmt(x.amount)+'</td><td style="color:#64748b;font-size:12px">'+(x.note||'—')+'</td></tr>').join(''):'<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:20px">Nothing in this period.</td></tr>';
}
function renderUdReceived(){
  const list=upiTransactions(currentUpiId).received.filter(x=>_udMonthMatch(x.date));
  const tot=list.reduce((s,x)=>s+x.amount,0);
  el('udp-received').innerHTML='<div class="card">'+_udBar('Received into this account — '+fmt(tot),'#15803d')+'<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Type</th><th>Client</th><th>Ref</th><th>Amount</th><th>Note</th></tr></thead><tbody>'+_udTxRows(list,'#15803d')+'</tbody></table></div></div>';
}
function renderUdPaid(){
  const list=upiTransactions(currentUpiId).paid.filter(x=>_udMonthMatch(x.date));
  const tot=list.reduce((s,x)=>s+x.amount,0);
  el('udp-paid').innerHTML='<div class="card">'+_udBar('Paid from this account — '+fmt(tot),'#b91c1c')+'<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Type</th><th>Supplier</th><th>Ref</th><th>Amount</th><th>Note</th></tr></thead><tbody>'+_udTxRows(list,'#b91c1c')+'</tbody></table></div></div>';
}
function renderUdLedger(){
  const u=APP.upiAccounts.find(x=>x.id===currentUpiId); if(!u) return;
  const tx=upiTransactions(currentUpiId);
  const ev=tx.received.map(x=>({...x,dir:'in'})).concat(tx.paid.map(x=>({...x,dir:'out'})));
  ev.sort((a,b)=>new Date(a.date)-new Date(b.date));
  // Carry-forward balance from before the selected month
  let running=u.openingBalance||0;
  const before=_udMonth?ev.filter(x=>x.date.slice(0,7)<_udMonth):[];
  before.forEach(x=>{ running += x.dir==='in'?x.amount:-x.amount; });
  const inPeriod=ev.filter(x=>_udMonthMatch(x.date));
  const bfLabel=_udMonth?'Balance b/f':'Opening Balance';
  const obRow=(running!==0||!_udMonth)?'<tr style="background:rgba(245,158,11,.12)"><td>—</td><td><strong>'+bfLabel+'</strong></td><td>—</td><td>—</td><td style="font-weight:800">'+fmt(running)+'</td></tr>':'';
  const rows=inPeriod.map(x=>{
    if(x.dir==='in') running+=x.amount; else running-=x.amount;
    return '<tr'+(x.dir==='out'?' style="background:rgba(239,68,68,.10)"':'')+'><td style="white-space:nowrap">'+fmtD(x.date)+'</td>'+
      '<td>'+x.kind+' — <span style="color:#64748b">'+x.party+'</span>'+(x.ref&&x.ref!=='—'?' <span style="font-family:ui-monospace,monospace;color:#94a3b8">'+x.ref+'</span>':'')+(x.note?'<br><span style="font-size:11px;color:#94a3b8">'+x.note+'</span>':'')+'</td>'+
      '<td style="color:#15803d;font-weight:700">'+(x.dir==='in'?fmt(x.amount):'—')+'</td>'+
      '<td style="color:#b91c1c;font-weight:700">'+(x.dir==='out'?fmt(x.amount):'—')+'</td>'+
      '<td style="font-weight:800;color:'+(running>=0?'#15803d':'#b91c1c')+'">'+fmt(running)+'</td></tr>';
  }).join('');
  el('udp-ledger').innerHTML='<div class="card">'+_udBar('Account Ledger — Received & Paid')+
    (inPeriod.length||obRow?'<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Particulars</th><th style="color:#15803d">Received</th><th style="color:#b91c1c">Paid</th><th>Balance</th></tr></thead><tbody>'+obRow+rows+'</tbody></table></div>':'<div style="text-align:center;padding:30px;color:#94a3b8">No transactions in this period.</div>')+'</div>';
}
function downloadUpiTabPDF(){
  if(!window.jspdf){alert('PDF library not loaded.');return;}
  const u=APP.upiAccounts.find(x=>x.id===currentUpiId); if(!u) return;
  const scope=_udMonth?new Date(_udMonth+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'All Months';
  const {jsPDF}=window.jspdf; const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  pdfHeader(doc,'UPI '+_udTab.charAt(0).toUpperCase()+_udTab.slice(1)+' — '+u.name+'  ·  '+scope,false,getActiveCompany());
  const tx=upiTransactions(currentUpiId);
  let head, body;
  if(_udTab==='ledger'){
    const ev=tx.received.map(x=>({...x,dir:'in'})).concat(tx.paid.map(x=>({...x,dir:'out'}))).sort((a,b)=>new Date(a.date)-new Date(b.date));
    let running=u.openingBalance||0; (_udMonth?ev.filter(x=>x.date.slice(0,7)<_udMonth):[]).forEach(x=>running+=x.dir==='in'?x.amount:-x.amount);
    body=[[ '—', _udMonth?'Balance b/f':'Opening Balance','—','—','Rs.'+fmtPdf(running)]];
    ev.filter(x=>_udMonthMatch(x.date)).forEach(x=>{ running+=x.dir==='in'?x.amount:-x.amount; body.push([fmtD(x.date), x.kind+' — '+x.party+(x.ref&&x.ref!=='—'?' ('+x.ref+')':''), x.dir==='in'?'Rs.'+fmtPdf(x.amount):'—', x.dir==='out'?'Rs.'+fmtPdf(x.amount):'—','Rs.'+fmtPdf(running)]); });
    head=[['Date','Particulars','Received','Paid','Balance']];
  } else {
    const list=(_udTab==='received'?tx.received:tx.paid).filter(x=>_udMonthMatch(x.date));
    head=[['Date','Type',_udTab==='received'?'Client':'Supplier','Ref','Amount','Note']];
    body=list.map(x=>[fmtD(x.date),x.kind,x.party,x.ref,'Rs.'+fmtPdf(x.amount),x.note||'']);
    const tot=list.reduce((s,x)=>s+x.amount,0);
    body.push([{content:'TOTAL',colSpan:4,styles:{halign:'right',fontStyle:'bold'}},'Rs.'+fmtPdf(tot),'']);
  }
  doc.autoTable({startY:43,head,body,headStyles:{fillColor:[15,23,42],fontSize:8},bodyStyles:{fontSize:8}});
  pdfFooter(doc,false,getActiveCompany());
  doc.save('UPI-'+_udTab+'-'+u.name.replace(/\s+/g,'-')+'-'+(_udMonth||'all')+'.pdf');
}

/* ═══════════════ PURCHASE PRINT (reuses #cp-ov overlay) ═══════════════ */
function printPurchase(id){
  const p=APP.purchases.find(x=>x.id===id); if(!p) return;
  const s=APP.suppliers.find(x=>x.id===p.supplierId)||{name:'—'};
  const co=getActiveCompany();
  el('cp-sheet').innerHTML=_buildPurchaseHalf(p,s,co);
  if(el('cp-ref')) el('cp-ref').textContent=p.billNo;
  el('cp-ov').classList.add('open');
  if(typeof setCpPaperSize==='function') setCpPaperSize('a5');
}
function _buildPurchaseHalf(p,s,co){
  const gst=!!p.gstEnabled;
  let base=p.items.reduce((a,i)=>a+(i.lt||0),0);
  if(gst) base=+(p.total/1.18).toFixed(2);
  const cgst=gst?+(base*0.09).toFixed(2):0, sgst=cgst;
  const grand=gst?(base+cgst+sgst):p.total;
  const rows=p.items.map((i,n)=>'<tr><td class="tc">'+(n+1)+'</td><td class="tl">'+i.name+(i.size?' — '+i.size:'')+'</td><td class="tc">'+i.qty+(unitLabel(i.unit)?' '+unitLabel(i.unit):'')+'</td><td class="tr">'+fmt(i.price)+'</td><td class="tr">'+fmt(i.lt)+'</td></tr>').join('');
  return '<div style="padding:14px 16px;font-size:12px;color:var(--text)">'+
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--co-primary,#0f172a);padding-bottom:8px;margin-bottom:8px">'+
      '<div><div style="font-size:17px;font-weight:800">'+(co.name||'')+'</div><div style="font-size:10px;color:#475569">'+(co.address||'')+'</div><div style="font-size:10px;color:#475569">'+(co.gstin||co.gst||'')+'</div></div>'+
      '<div style="text-align:right"><div style="font-weight:800;font-size:14px;letter-spacing:.04em">'+(p.docLabel||'PURCHASE INVOICE')+'</div><div style="font-size:11px">No: <b>'+p.billNo+'</b></div><div style="font-size:11px">Date: '+fmtD(p.date)+'</div></div>'+
    '</div>'+
    '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:11px">'+
      '<div><div style="color:#94a3b8;font-size:9px;text-transform:uppercase">Supplier</div><div style="font-weight:700">'+s.name+'</div><div>'+(s.address||'')+'</div><div>'+(s.gst||'')+' '+(s.phone||'')+'</div></div>'+
      '<div style="text-align:right">'+(p.refBillNo?'<div>Supplier Bill: '+p.refBillNo+'</div>':'')+'<div>Mode: '+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' ('+upiAccountName(p.upiAccountId)+')':'')+'</div></div>'+
    '</div>'+
    '<table style="width:100%;border-collapse:collapse;font-size:11px" border="0">'+
      '<thead><tr style="background:var(--co-primary,#0f172a);color:#fff"><th class="tc" style="padding:4px">#</th><th class="tl" style="padding:4px">Item</th><th class="tc" style="padding:4px">Qty</th><th class="tr" style="padding:4px">Rate</th><th class="tr" style="padding:4px">Amount</th></tr></thead>'+
      '<tbody>'+rows+'</tbody></table>'+
    '<div style="display:flex;justify-content:flex-end;margin-top:8px"><table style="font-size:11px">'+
      (gst?'<tr><td style="padding:2px 8px;text-align:right">Sub Total</td><td style="padding:2px 0;text-align:right;font-weight:700">'+fmt(base)+'</td></tr><tr><td style="padding:2px 8px;text-align:right">CGST 9%</td><td style="padding:2px 0;text-align:right">'+fmt(cgst)+'</td></tr><tr><td style="padding:2px 8px;text-align:right">SGST 9%</td><td style="padding:2px 0;text-align:right">'+fmt(sgst)+'</td></tr>':'')+
      '<tr style="border-top:1px solid #0f172a"><td style="padding:4px 8px;text-align:right;font-weight:800">Grand Total</td><td style="padding:4px 0;text-align:right;font-weight:800;font-size:13px">'+fmt(grand)+'</td></tr>'+
    '</table></div>'+
    (p.notes?'<div style="margin-top:8px;font-size:10px;color:#475569"><b>Note:</b> '+p.notes+'</div>':'')+
    '<div style="margin-top:24px;display:flex;justify-content:space-between;font-size:10px;color:#475569"><div>Received the above goods</div><div style="text-align:right">For '+(co.name||'')+'<br><br>Authorised Signatory</div></div>'+
  '</div>';
}
function downloadPurchasePDF(id){ printPurchase(id); setTimeout(function(){ window.print(); }, 350); }

/* ═══════════════ BUY-SIDE PDF EXPORTS ═══════════════ */
function _autoDoc(){ const {jsPDF}=window.jspdf; return new jsPDF({orientation:'landscape',unit:'mm',format:'a4'}); }
function downloadPurchasesListPDF(){
  if(!window.jspdf){alert('PDF library not loaded.');return;}
  const doc=_autoDoc(); pdfHeader(doc,'Purchases — '+fmtD(TODAY),true,getActiveCompany());
  const list=[...cPurchases()].sort((a,b)=>new Date(b.date)-new Date(a.date));
  doc.autoTable({startY:40,head:[['Purchase No','Date','Supplier','Total','Paid','Outstanding','Mode','Status']],
    body:list.map(p=>[p.billNo,fmtD(p.date),supplierName(p.supplierId),fmtPdf(p.total),fmtPdf(purchasePaidAmt(p)),fmtPdf(purchaseOutstanding(p)),p.mode.toUpperCase(),purchaseStatus(p)]),
    headStyles:{fillColor:[15,23,42],fontSize:8},bodyStyles:{fontSize:8}});
  pdfFooter(doc,true,getActiveCompany()); doc.save('Purchases-'+TODAY+'.pdf');
}
function downloadSuppliersPDF(){
  if(!window.jspdf){alert('PDF library not loaded.');return;}
  const doc=_autoDoc(); pdfHeader(doc,'Suppliers — '+fmtD(TODAY),true,getActiveCompany());
  doc.autoTable({startY:40,head:[['Supplier','GST','Phone','Total Purchases','Paid','Payable']],
    body:cSuppliers().map(s=>{const st=supplierStats(s.id);return [s.name,s.gst||'—',s.phone||'—',fmtPdf(st.totalPurch),fmtPdf(st.totalPaid),fmtPdf(st.os)];}),
    headStyles:{fillColor:[15,23,42],fontSize:8},bodyStyles:{fontSize:8}});
  pdfFooter(doc,true,getActiveCompany()); doc.save('Suppliers-'+TODAY+'.pdf');
}
function downloadSupplierPaymentsPDF(){
  if(!window.jspdf){alert('PDF library not loaded.');return;}
  const doc=_autoDoc(); pdfHeader(doc,'Supplier Payments — '+fmtD(TODAY),true,getActiveCompany());
  const list=[...cSupplierPayments()].sort((a,b)=>new Date(b.date)-new Date(a.date));
  doc.autoTable({startY:40,head:[['Date','Supplier','Amount','Mode','UPI Account','Note']],
    body:list.map(p=>[fmtD(p.date),supplierName(p.supplierId),fmtPdf(p.amount),p.mode.toUpperCase(),p.upiAccountId?upiAccountName(p.upiAccountId):'—',p.note||'']),
    headStyles:{fillColor:[15,23,42],fontSize:8},bodyStyles:{fontSize:8}});
  pdfFooter(doc,true,getActiveCompany()); doc.save('Supplier-Payments-'+TODAY+'.pdf');
}
function downloadUpiReportPDF(){
  if(!window.jspdf){alert('PDF library not loaded.');return;}
  const scope=_upiMonth?new Date(_upiMonth+'-01').toLocaleDateString('en-IN',{month:'short',year:'numeric'}):'All data';
  const doc=_autoDoc(); pdfHeader(doc,'UPI Report ('+scope+') — '+fmtD(TODAY),true,getActiveCompany());
  doc.autoTable({startY:40,head:[['UPI Account','Opening','Received','Paid','Net Balance']],
    body:cUpiAccounts().map(u=>{const t=upiTotals(u.id,_upiMonth);return [u.name,fmtPdf(u.openingBalance||0),fmtPdf(t.received),fmtPdf(t.paid),fmtPdf(upiClosing(u,_upiMonth))];}),
    headStyles:{fillColor:[15,23,42],fontSize:8},bodyStyles:{fontSize:8}});
  pdfFooter(doc,true,getActiveCompany()); doc.save('UPI-Report-'+(_upiMonth||'all')+'-'+TODAY+'.pdf');
}
function downloadSupplierLedgerPDF(id){
  if(!window.jspdf){alert('PDF library not loaded.');return;}
  const s=APP.suppliers.find(x=>x.id===id); if(!s)return;
  const {jsPDF}=window.jspdf; const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  pdfHeader(doc,'Supplier Ledger — '+s.name,false,getActiveCompany());
  let ev=[]; APP.purchases.filter(p=>p.supplierId===id&&p.mode==='credit'&&p.status!=='cancelled').forEach(p=>ev.push({date:p.date,type:'buy',amount:p.total,ref:p.billNo}));
  APP.supplierPayments.filter(p=>p.supplierId===id).forEach(p=>ev.push({date:p.date,type:'pay',amount:p.amount,ref:'PMT',mode:p.mode,upiAccountId:p.upiAccountId,note:p.note||''}));
  ev.sort((a,b)=>new Date(a.date)-new Date(b.date));
  let running=s.openingBalance||0; const body=[];
  if(running!==0) body.push(['—','Opening Balance',running>0?'Rs.'+fmtPdf(running):'—',running<0?'Rs.'+fmtPdf(running):'—','Rs.'+fmtPdf(running)]);
  ev.forEach(e=>{ if(e.type==='buy'){running+=e.amount;body.push([fmtD(e.date),e.ref,'Rs.'+fmtPdf(e.amount),'—','Rs.'+fmtPdf(running)]);}else{running-=e.amount;var pt='Payment ('+e.mode.toUpperCase()+')';if(e.mode==='upi'&&e.upiAccountId)pt+=' — '+upiAccountName(e.upiAccountId);if(e.note)pt+='\n  Note: '+e.note;body.push([fmtD(e.date),pt,'—','Rs.'+fmtPdf(e.amount),'Rs.'+fmtPdf(running)]);} });
  doc.autoTable({startY:43,margin:{left:14,right:14},
    head:[['Date','Particulars','Purchases (Rs.)','Payments (Rs.)','Balance']],body,
    headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
    bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85]},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{0:{cellWidth:24},2:{halign:'right',textColor:[185,28,28]},3:{halign:'right',textColor:[21,128,61]},4:{halign:'right',fontStyle:'bold'}}});
  // Statement totals panel — total purchased vs total paid, with closing balance
  let sy=doc.lastAutoTable.finalY+8;
  if(sy>250){doc.addPage();sy=20;}
  const totBuy=ev.filter(e=>e.type==='buy').reduce((a,e)=>a+e.amount,0);
  const totPaid=ev.filter(e=>e.type==='pay').reduce((a,e)=>a+e.amount,0);
  const rgb=hexToRgb((getActiveCompany().primaryColor)||'#0f172a'); const ph=20;
  doc.setFillColor(248,250,252);doc.setDrawColor(226,232,240);doc.setLineWidth(0.3);
  doc.roundedRect(14,sy,210-28-70,ph,2,2,'FD');
  doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(100,116,139);
  doc.text('TOTAL PURCHASED',20,sy+7); doc.text('TOTAL PAID',80,sy+7);
  doc.setFontSize(11);doc.setTextColor(30,41,59);doc.text('Rs.'+fmtPdf(totBuy),20,sy+15);
  doc.setTextColor(21,128,61);doc.text('Rs.'+fmtPdf(totPaid),80,sy+15);
  const bx=210-14-64;
  doc.setFillColor(rgb[0],rgb[1],rgb[2]);doc.roundedRect(bx,sy,64,ph,2,2,'F');
  doc.setFontSize(7.5);doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);
  doc.text('CLOSING BALANCE',bx+5,sy+7);
  doc.setFontSize(13);doc.setTextColor(255,255,255);
  doc.text(fmtPdf(Math.abs(running))+' '+(running>0?'Payable':running<0?'Adv':'NIL'),bx+5,sy+15.5);
  pdfFooter(doc,false,getActiveCompany()); doc.save('Supplier-Ledger-'+s.name.replace(/\s+/g,'-')+'-'+TODAY+'.pdf');
}
