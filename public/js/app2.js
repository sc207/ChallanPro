function renderWeeklyChart(){
  const days=[],labels=[];
  for(let i=6;i>=0;i--){const d=new Date(TODAY);d.setDate(d.getDate()-i);const s=d.toISOString().split('T')[0];days.push(s);labels.push(d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric'}));}
  const g=(t,d)=>cChallans().filter(c=>c.date===d&&c.mode===t).reduce((s,c)=>s+c.total,0);
  mkChart('ch-weekly',{type:'bar',data:{labels,datasets:[
    {label:'Cash',  data:days.map(d=>g('cash',d)), backgroundColor:'#4ade80',borderRadius:4},
    {label:'UPI',   data:days.map(d=>g('upi',d)),  backgroundColor:'#a78bfa',borderRadius:4},
    {label:'Credit',data:days.map(d=>g('credit',d)),backgroundColor:'#fb923c',borderRadius:4}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},
    scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:10}}},y:{stacked:true,grid:{color:'rgba(148,163,184,.2)'},ticks:{callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v),font:{size:10}}}}}});
}
function renderMixChart(){
  const m=cChallans().filter(c=>c.date.startsWith(TODAY.slice(0,7)));
  const cash=m.filter(c=>c.mode==='cash').reduce((s,c)=>s+c.total,0);
  const upi=m.filter(c=>c.mode==='upi').reduce((s,c)=>s+c.total,0);
  const cred=m.filter(c=>c.mode==='credit').reduce((s,c)=>s+c.total,0);
  const tot=cash+upi+cred;
  mkChart('ch-mix',{type:'doughnut',data:{labels:['Cash','UPI','Credit'],datasets:[{data:[cash,upi,cred],backgroundColor:['#4ade80','#a78bfa','#fb923c'],borderWidth:0,hoverOffset:4}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtN(ctx.raw)}}}}});
  el('mix-leg').innerHTML=[{l:'Cash',v:cash,c:'#4ade80'},{l:'UPI',v:upi,c:'#a78bfa'},{l:'Credit',v:cred,c:'#fb923c'}]
    .map(x=>'<div style="display:flex;align-items:center;justify-content:space-between;font-size:11px"><div style="display:flex;align-items:center;gap:5px"><div style="width:7px;height:7px;border-radius:50%;background:'+x.c+'"></div><span style="color:#64748b">'+x.l+'</span></div><span style="font-weight:700">'+fmt(x.v)+' <span style="color:#94a3b8;font-weight:400">('+(tot>0?((x.v/tot)*100).toFixed(0):0)+'%)</span></span></div>').join('');
}
function renderAgingBarChart(){
  const b=agingBuckets(null);
  mkChart('ch-age',{type:'bar',indexAxis:'y',data:{labels:['0–30d','31–60d','61–90d','90+d'],
    datasets:[{data:[b.b0,b.b31,b.b61,b.b90],backgroundColor:['#4ade80','#fbbf24','#f87171','#7f1d1d'],borderRadius:5}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' '+fmtN(ctx.raw)}}},
      scales:{x:{grid:{color:'rgba(148,163,184,.2)'},ticks:{callback:v=>'₹'+(v>=1000?(v/1000).toFixed(0)+'k':v),font:{size:10}}},y:{grid:{display:false},ticks:{font:{size:12}}}}}});
}

// ═══════════════════════════════════════════════
//  CHALLANS
// ═══════════════════════════════════════════════
function challanTR(c, actions=false) {
  const pa=paidAmt(c), os=outstanding(c), st=challanStatus(c), d=daysOld(c.date);
  const items = c.items.map(i=>i.name+' ('+i.qty+(unitLabel(i.unit))+')').join(', ');
  let actionsHTML = '';
  if(actions){
    actionsHTML = '<td><div style="display:flex;gap:5px;flex-wrap:wrap">'+
      '<button class="btn btn-sm" style="background:#0369a1;color:#fff" title="View / Print Delivery Challan" onclick="printDeliveryChallan(\''+c.id+'\')"><i class="fas fa-eye"></i></button>'+
      '<button class="btn btn-ghost btn-sm" onclick="openChallanModal(\''+c.id+'\')"><i class="fas fa-edit"></i></button>'+
      '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'challan\',\''+c.id+'\')"><i class="fas fa-trash"></i></button>'+
      '<button class="btn btn-sm" style="background:#dc5800;color:#fff" title="Download PDF" onclick="downloadChallanPDF(\''+c.id+'\')"><i class="fas fa-file-pdf"></i></button>'+
    '</div></td>';
  }
  return '<tr>'+
    '<td><strong style="color:#1d4ed8">'+c.billNo+'</strong></td>'+
    '<td>'+fmtD(c.date)+'</td>'+
    '<td><div style="font-weight:600">'+clientName(c.clientId)+'</div></td>'+
    '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+items+'">'+items+'</td>'+
    '<td><strong>'+fmt(c.total)+'</strong></td>'+
    '<td style="color:#15803d">'+fmt(pa)+'</td>'+
    '<td style="font-weight:700;color:'+(os>0?'#b91c1c':'#15803d')+'">'+fmt(os)+'</td>'+
    '<td><span class="badge badge-'+c.mode+'">'+c.mode.toUpperCase()+(c.mode==='upi'&&c.upiAccountId?' · '+upiAccountName(c.upiAccountId):'')+'</span></td>'+
    '<td style="color:'+(d>60?'#dc2626':d>30?'#d97706':'#334155')+';font-weight:600">'+d+'d</td>'+
    '<td><span class="badge badge-'+st+'">'+st[0].toUpperCase()+st.slice(1)+'</span></td>'+
    actionsHTML+
  '</tr>';
}

function renderClientBalanceCards() {
  const cards = cClients().map(cl => {
    const allCredit = cChallans().filter(c => c.clientId === cl.id && c.mode === 'credit').reduce((s,c)=>s+c.total,0);
    if (!allCredit) return '';
    const bal = clientBalance(cl.id);
    const os  = Math.max(0, bal);
    const adv = Math.max(0, -bal);
    const pct = allCredit > 0 ? Math.min(100, ((allCredit - os) / allCredit) * 100) : 100;
    const shortName = cl.name.length > 22 ? cl.name.slice(0,20)+'…' : cl.name;
    return '<div class="card" style="padding:14px">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px">'+
        '<div style="font-size:12px;font-weight:700;color:var(--text)">'+shortName+'</div>'+
        (adv > 0 ? '<span class="badge badge-paid" style="font-size:10px">ADV ✓</span>' : '')+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;margin-bottom:6px">'+
        '<div><div style="font-size:10px;color:#94a3b8">Credit Sales</div><div style="font-size:13px;font-weight:700">'+fmt(allCredit)+'</div></div>'+
        '<div style="text-align:right"><div style="font-size:10px;color:'+(os>0?'#b91c1c':'#15803d')+'">'+(adv>0?'Advance':'Outstanding')+'</div>'+
          '<div style="font-size:13px;font-weight:800;color:'+(adv>0?'#15803d':os>0?'#b91c1c':'#15803d')+'">'+(adv>0?fmt(adv):fmt(os))+'</div></div>'+
      '</div>'+
      (os > 0 ? '<div style="margin-bottom:8px"><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:'+(pct<50?'#ef4444':pct<80?'#f59e0b':'#22c55e')+'"></div></div></div>' : '')+
      '<button class="btn btn-success btn-sm" style="width:100%;font-size:11px;margin-top:2px" onclick="openPaymentModal('+cl.id+')">'+
        '<i class="fas fa-rupee-sign" style="margin-right:4px"></i>'+(adv>0?'View Ledger / Pay Again':'Record Payment')+
      '</button></div>';
  }).filter(Boolean).join('');
  const c = el('client-bal-cards');
  if (c) c.innerHTML = cards || '<div style="color:#94a3b8;font-size:13px;padding:8px">No credit clients yet.</div>';
}

function renderChallans() {
  renderClientBalanceCards();
  buildMonthOptions('fc-mn', true);
  const q   = (el('fc-q').value||'').toLowerCase();
  const cl  = el('fc-cl').value;
  const st  = el('fc-st').value;
  const mo  = el('fc-mo').value;
  const mn  = el('fc-mn').value;
  let list  = [...cChallans()].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(q)  list=list.filter(c=>c.billNo.toLowerCase().includes(q)||clientName(c.clientId).toLowerCase().includes(q)||c.items.some(i=>i.name.toLowerCase().includes(q)));
  if(cl) list=list.filter(c=>c.clientId==cl);
  if(st) list=list.filter(c=>challanStatus(c)===st);
  if(mo) list=list.filter(c=>c.mode===mo);
  if(mn) list=list.filter(c=>c.date.startsWith(mn));
  el('fc-tot').textContent = list.length;
  el('fc-pa').textContent  = list.filter(c=>challanStatus(c)==='paid').length;
  el('fc-pl').textContent  = list.filter(c=>challanStatus(c)==='partial').length;
  el('fc-pn').textContent  = list.filter(c=>challanStatus(c)==='pending').length;
  const tb=el('t-challans'), cards=el('challan-cards'), em=el('ch-empty');
  if(!list.length){tb.innerHTML='';if(cards)cards.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=list.map(c=>challanTR(c,true)).join('');
  if(cards) cards.innerHTML=list.map(c=>{
    const os=outstanding(c), st=challanStatus(c);
    return '<div class="data-card"><div class="data-card-head"><div><div style="font-weight:700">'+c.billNo+'</div><div style="font-size:11px;color:#64748b">'+fmtD(c.date)+' · '+clientName(c.clientId)+'</div></div><span class="badge badge-'+st+'">'+st+'</span></div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px"><div><span style="color:#94a3b8;font-size:10px">Total</span><div style="font-weight:700">'+fmt(c.total)+'</div></div>'+
      '<div><span style="color:#94a3b8;font-size:10px">Outstanding</span><div style="font-weight:700;color:'+(os>0?'#b91c1c':'#15803d')+'">'+fmt(os)+'</div></div></div>'+
      '<div class="data-card-actions">'+
        '<button class="btn btn-sm" style="background:#0369a1;color:#fff" onclick="printDeliveryChallan(\''+c.id+'\')" title="View"><i class="fas fa-eye"></i></button>'+
        '<button class="btn btn-ghost btn-sm" onclick="openChallanModal(\''+c.id+'\')" title="Edit"><i class="fas fa-edit"></i></button>'+
        '<button class="btn btn-sm" style="background:#dc5800;color:#fff" onclick="downloadChallanPDF(\''+c.id+'\')" title="PDF"><i class="fas fa-file-pdf"></i></button>'+
        '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'challan\',\''+c.id+'\')" title="Delete"><i class="fas fa-trash"></i></button>'+
      '</div></div>';
  }).join('');
}
function resetCF(){['fc-q','fc-cl','fc-st','fc-mo','fc-mn'].forEach(id=>{const e=el(id);e.value='';});renderChallans();}

// ═══════════════════════════════════════════════
//  CLIENTS
// ═══════════════════════════════════════════════
function renderClients() {
  const q  = (el('cl-q').value||'').toLowerCase();
  const rf = el('cl-risk')?.value || '';
  let list = cClients();
  if(q)  list = list.filter(c=>c.name.toLowerCase().includes(q)||c.phone.includes(q));
  if(rf) list = list.filter(c=>{ const s=clientStats(c.id); return riskLevel(s.oldest,s.os).label===rf; });

  el('client-cards').innerHTML = cClients().map(cl=>{
    const s=clientStats(cl.id); const r=riskLevel(s.oldest,s.os);
    const allCredit = cChallans().filter(c=>c.clientId===cl.id&&c.mode==='credit').reduce((s,c)=>s+c.total,0);
    const pct = allCredit>0?Math.min(100,((allCredit-s.os)/allCredit)*100):100;
    return '<div class="card">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">'+
        '<div><div style="font-weight:700;font-size:13px">'+cl.name+'</div><div style="font-size:11px;color:#94a3b8">'+cl.phone+'</div></div>'+
        '<span class="badge '+r.cls+'">'+r.label+'</span>'+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'+
        '<div><div style="font-size:10px;color:#94a3b8">Total Sales</div><div style="font-size:14px;font-weight:800">'+fmt(s.totalSales)+'</div></div>'+
        '<div><div style="font-size:10px;color:'+(s.advance>0?'#15803d':'#b91c1c')+'">'+(s.advance>0?'Advance Balance':'Outstanding')+'</div>'+
          '<div style="font-size:14px;font-weight:800;color:'+(s.advance>0?'#15803d':s.os>0?'#b91c1c':'#15803d')+'">'+(s.advance>0?fmt(s.advance):fmt(s.os))+'</div></div>'+
      '</div>'+
      (s.os>0?'<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:3px"><span style="color:#64748b">Recovery</span><span style="color:#64748b">'+pct.toFixed(0)+'%</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%;background:'+(pct<50?'#ef4444':pct<80?'#f59e0b':'#22c55e')+'"></div></div></div>':'')+
      '<button class="btn btn-ghost btn-sm" style="width:100%;font-size:11px" onclick="openCustomerDetail('+cl.id+',\'customers\')"><i class="fas fa-user" style="margin-right:4px"></i>View Details</button></div>';
  }).join('');

  el('t-clients').innerHTML = list.map(cl=>{
    const s=clientStats(cl.id); const r=riskLevel(s.oldest,s.os);
    const laD=cl.lastAsked?daysOld(cl.lastAsked):null;
    return '<tr>'+
      '<td><div style="font-weight:700">'+cl.name+'</div><div style="font-size:10px;color:#94a3b8">'+cl.gst+' · '+cl.address+'</div></td>'+
      '<td>'+cl.phone+'</td>'+
      '<td><strong>'+fmt(s.totalSales)+'</strong></td>'+
      '<td style="color:#15803d">'+fmt(s.totalPaid)+'</td>'+
      '<td style="font-weight:800;color:'+(s.os>0?'#b91c1c':'#15803d')+'">'+fmt(s.os)+'</td>'+
      '<td>'+fmtD(s.lastCh?.date)+'</td>'+
      '<td style="font-weight:700;color:'+(s.oldest>60?'#dc2626':s.oldest>30?'#d97706':'#334155')+'">'+(s.oldest>0?s.oldest+'d':'—')+'</td>'+
      '<td>'+(laD!==null?'<span style="color:'+(laD>14?'#b91c1c':'#64748b')+'">'+laD+'d ago ('+fmtD(cl.lastAsked)+')</span>':'<span style="color:#b91c1c;font-weight:700">Never asked!</span>')+'</td>'+
      '<td><span class="badge '+r.cls+'">'+r.label+'</span></td>'+
      '<td><div style="display:flex;gap:5px;flex-wrap:wrap">'+
        '<button class="btn btn-ghost btn-sm" onclick="openCustomerDetail('+cl.id+',\'customers\')" title="Party Details"><i class="fas fa-user"></i></button>'+
        '<button class="btn btn-success btn-sm" onclick="openPaymentModal('+cl.id+')" title="Record Payment"><i class="fas fa-rupee-sign"></i></button>'+
        '<button class="btn btn-ghost btn-sm" onclick="markAskedToday('+cl.id+')" title="Mark Asked Today"><i class="fas fa-phone"></i></button>'+
        '<button class="btn btn-ghost btn-sm" onclick="openClientModal('+cl.id+')"><i class="fas fa-edit"></i></button>'+
        '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'client\','+cl.id+')"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('');
}
function renderCustomers(){ renderClients(); }

// ═══════════════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════════════
function renderProducts() {
  el('t-products').innerHTML = cProducts().map((p,i)=>'<tr>'+
    '<td style="color:#94a3b8;font-weight:600">'+(i+1)+'</td>'+
    '<td><strong>'+p.name+'</strong></td>'+
    '<td style="color:#64748b">'+p.desc+'</td>'+
    '<td>'+p.size+' / '+p.unit+'</td>'+
    '<td><strong>'+fmt(p.price)+'</strong> / '+p.unit+'</td>'+
    '<td><div style="display:flex;gap:5px">'+
      '<button class="btn btn-ghost btn-sm" onclick="openProductModal('+p.id+')"><i class="fas fa-edit"></i></button>'+
      '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'product\','+p.id+')"><i class="fas fa-trash"></i></button>'+
    '</div></td></tr>').join('');
}

// ═══════════════════════════════════════════════
//  COMPANY
// ═══════════════════════════════════════════════
function renderCompany() { renderCompanies(); }

// ═══════════════════════════════════════════════
//  MONTHLY REPORT
// ═══════════════════════════════════════════════
function renderMonthly() {
  buildMonthOptions('r-mn', false);
  const cId = el('r-cl').value;
  const mn  = el('r-mn').value;
  let list  = cChallans().filter(c=>c.date.startsWith(mn));
  if(cId) list=list.filter(c=>c.clientId==cId);
  list.sort((a,b)=>new Date(a.date)-new Date(b.date));

  const tS=list.reduce((s,c)=>s+c.total,0);
  const tP=list.reduce((s,c)=>s+paidAmt(c),0);
  const tO=list.reduce((s,c)=>s+outstanding(c),0);
  const tCash=list.filter(c=>c.mode==='cash').reduce((s,c)=>s+c.total,0);
  const tUPI=list.filter(c=>c.mode==='upi').reduce((s,c)=>s+c.total,0);
  const tCred=list.filter(c=>c.mode==='credit').reduce((s,c)=>s+c.total,0);
  const bName=cId?clientName(parseInt(cId)):'All Clients';
  const mLabel=new Date(mn+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'});

  el('r-title').textContent=mLabel+' — '+bName;
  el('r-cnt').textContent=list.length+' challans';
  el('r-ph-co').textContent=getActiveCompany().name;
  el('r-ph-sub').textContent='Monthly Report · '+mLabel+' · '+bName;

  el('r-stats').innerHTML=
    '<div class="card" style="padding:13px"><div class="stat-label">Total Sales</div><div style="font-size:20px;font-weight:800">'+fmt(tS)+'</div><div class="stat-hint">'+list.length+' challans</div></div>'+
    '<div class="card" style="padding:13px"><div class="stat-label" style="color:#15803d">Collected</div><div style="font-size:20px;font-weight:800;color:#15803d">'+fmt(tP)+'</div><div class="stat-hint">Cash: '+fmt(tCash)+' · UPI: '+fmt(tUPI)+'</div></div>'+
    '<div class="card" style="padding:13px"><div class="stat-label" style="color:#b91c1c">Outstanding</div><div style="font-size:20px;font-weight:800;color:'+(tO>0?'#b91c1c':'#15803d')+'">'+fmt(tO)+'</div><div class="stat-hint">From credit</div></div>'+
    '<div class="card" style="padding:13px"><div class="stat-label" style="color:#92400e">Credit Sales</div><div style="font-size:20px;font-weight:800;color:#92400e">'+fmt(tCred)+'</div><div class="stat-hint">'+list.filter(c=>c.mode==='credit').length+' challans</div></div>';

  let monthPmts = cPayments().filter(p => p.date.startsWith(mn));
  if (cId) monthPmts = monthPmts.filter(p => p.clientId == cId);
  monthPmts.sort((a,b) => new Date(a.date)-new Date(b.date));
  const totalPmtRcvd = monthPmts.reduce((s,p)=>s+p.amount,0);

  const payBtn = el('r-pay-btn');
  if (payBtn) payBtn.style.display = cId ? '' : 'none';

  el('r-payments-section').innerHTML = monthPmts.length ?
    '<div class="card no-print"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-weight:700;font-size:13px;color:var(--text)"><i class="fas fa-hand-holding-usd" style="color:#15803d;margin-right:6px"></i>Payments Received — '+mLabel+'</div><div style="font-size:14px;font-weight:800;color:#15803d">'+fmt(totalPmtRcvd)+'</div></div><div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Client</th><th>Amount</th><th>Mode</th><th>Note</th></tr></thead><tbody>'+monthPmts.map(function(p){return '<tr><td>'+fmtD(p.date)+'</td><td><strong>'+clientName(p.clientId)+'</strong></td><td style="font-weight:700;color:#15803d">'+fmt(p.amount)+'</td><td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td><td style="color:#64748b;font-size:12px">'+(p.note||'—')+'</td></tr>';}).join('')+'</tbody></table></div></div>' : '';

  // Monthly purchases (buy side) — all suppliers for the selected month
  const psEl = el('r-purchases-section');
  if (psEl && typeof cPurchases==='function') {
    const monthPur = cPurchases().filter(p=>p.date.startsWith(mn)).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const monthOut = cSupplierPayments().filter(p=>p.date.startsWith(mn)).reduce((s,p)=>s+p.amount,0);
    const tBuy = monthPur.reduce((s,p)=>s+p.total,0);
    psEl.innerHTML = (monthPur.length || monthOut) ?
      '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">'+
        '<div style="font-weight:700;font-size:13px;color:var(--text)"><i class="fas fa-file-invoice" style="color:#0369a1;margin-right:6px"></i>Purchases — '+mLabel+'</div>'+
        '<div style="font-size:13px"><span style="color:#64748b">Purchased</span> <b>'+fmt(tBuy)+'</b> &nbsp;·&nbsp; <span style="color:#64748b">Paid out</span> <b style="color:#b91c1c">'+fmt(monthOut)+'</b></div>'+
      '</div>'+
      (monthPur.length?'<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>No</th><th>Supplier</th><th>Total</th><th>Mode</th><th>Status</th></tr></thead><tbody>'+
        monthPur.map(function(p){return '<tr><td>'+fmtD(p.date)+'</td><td><strong style="color:#1d4ed8;cursor:pointer" onclick="printPurchase(\''+p.id+'\')">'+p.billNo+'</strong></td><td>'+supplierName(p.supplierId)+'</td><td><strong>'+fmt(p.total)+'</strong></td><td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td><td><span class="badge badge-'+purchaseStatus(p)+'">'+purchaseStatus(p)+'</span></td></tr>';}).join('')+
        '</tbody></table></div>':'<div style="color:#94a3b8;font-size:13px">No purchases this month.</div>')+
      '</div>' : '';
  }

  el('t-report').innerHTML=list.map(function(c){
    const pa=paidAmt(c),os=outstanding(c),st=challanStatus(c);
    const items=c.items.map(function(i){return i.name+'('+i.qty+(unitLabel(i.unit))+')';}).join(', ');
    return '<tr><td>'+fmtD(c.date)+'</td><td><strong style="color:#1d4ed8;cursor:pointer" onclick="openChallanView(\''+c.id+'\')">'+c.billNo+'</strong></td><td>'+clientName(c.clientId)+'</td><td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+items+'</td><td><strong>'+fmt(c.total)+'</strong></td><td style="color:#15803d">'+fmt(pa)+'</td><td style="font-weight:700;color:'+(os>0?'#b91c1c':'#15803d')+'">'+fmt(os)+'</td><td><span class="badge badge-'+c.mode+'">'+c.mode.toUpperCase()+(c.mode==='upi'&&c.upiAccountId?' · '+upiAccountName(c.upiAccountId):'')+'</span></td><td><span class="badge badge-'+st+'">'+st[0].toUpperCase()+st.slice(1)+'</span></td><td class="no-print"><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm" onclick="openChallanView(\''+c.id+'\')" title="View Bill"><i class="fas fa-eye"></i></button>'+(c.mode==='credit'?'<button class="btn btn-success btn-sm" onclick="openPaymentModal('+c.clientId+')" title="Record Payment"><i class="fas fa-rupee-sign"></i></button>':'')+'</div></td></tr>';
  }).join('');

  el('t-report-foot').innerHTML='<tr style="background:var(--surface-2);font-weight:800"><td colspan="4" style="padding:10px 13px;border-top:2px solid #e2e8f0;text-align:right;font-size:11px;color:#475569">TOTAL</td><td style="padding:10px 13px;border-top:2px solid #e2e8f0">'+fmt(tS)+'</td><td style="padding:10px 13px;border-top:2px solid #e2e8f0;color:#15803d">'+fmt(tP)+'</td><td style="padding:10px 13px;border-top:2px solid #e2e8f0;color:'+(tO>0?'#b91c1c':'#15803d')+'">'+fmt(tO)+'</td><td colspan="3" style="border-top:2px solid #e2e8f0"></td></tr>';

  renderTrendChart();
}
function renderTrendChart(){
  const months=(function(){var r=[];for(var i=2;i>=0;i--){var d=new Date(TODAY);d.setMonth(d.getMonth()-i);r.push(d.toISOString().slice(0,7));}return r;})();
  const labels=months.map(function(m){return new Date(m+'-01').toLocaleDateString('en-IN',{month:'short'});});
  const g=function(t,m){return cChallans().filter(function(c){return c.date.startsWith(m)&&c.mode===t;}).reduce(function(s,c){return s+c.total;},0);};
  mkChart('ch-trend',{type:'bar',data:{labels,datasets:[
    {label:'Cash',  data:months.map(function(m){return g('cash',m);}), backgroundColor:'#4ade80',borderRadius:4},
    {label:'UPI',   data:months.map(function(m){return g('upi',m);}),  backgroundColor:'#a78bfa',borderRadius:4},
    {label:'Credit',data:months.map(function(m){return g('credit',m);}),backgroundColor:'#fb923c',borderRadius:4}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},
    scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:'rgba(148,163,184,.2)'},ticks:{callback:function(v){return '₹'+(v>=1000?(v/1000).toFixed(0)+'k':v);},font:{size:10}}}}}});
}
function viewClientReport(id){el('r-cl').value=id;nav('monthly');}
function recordPaymentFromReport(){var cId=el('r-cl').value;if(cId)openPaymentModal(parseInt(cId));}
function doPrint(){document.querySelectorAll('.print-head').forEach(function(e){e.style.display='block';});window.print();setTimeout(function(){document.querySelectorAll('.print-head').forEach(function(e){e.style.display='none';});},800);}

// ═══════════════════════════════════════════════
//  AGING
// ═══════════════════════════════════════════════
function renderAging(){
  const b=agingBuckets(null);
  el('a0').innerHTML=fmt(b.b0); el('a31').innerHTML=fmt(b.b31);
  el('a61').innerHTML=fmt(b.b61); el('a90').innerHTML=fmt(b.b90);

  el('t-aging').innerHTML=cClients().map(function(cl){
    const s=clientStats(cl.id); const bk=agingBuckets(cl.id); const r=riskLevel(s.oldest,s.os);
    const laD=cl.lastAsked?daysOld(cl.lastAsked):null;
    if(s.os===0) return '<tr><td><strong>'+cl.name+'</strong></td><td colspan="4" style="color:#15803d;text-align:center;font-size:12px">✓ All cleared</td><td style="color:#15803d;font-weight:700">₹0</td><td>—</td><td>—</td><td><span class="badge badge-clear">Clear</span></td></tr>';
    return '<tr>'+
      '<td><div style="font-weight:700">'+cl.name+'</div><div style="font-size:10px;color:#94a3b8">'+cl.phone+'</div></td>'+
      '<td style="font-weight:'+(bk.b0>0?700:400)+';color:'+(bk.b0>0?'#15803d':'#94a3b8')+'">'+(bk.b0>0?fmt(bk.b0):'—')+'</td>'+
      '<td style="font-weight:'+(bk.b31>0?700:400)+';color:'+(bk.b31>0?'#d97706':'#94a3b8')+'">'+(bk.b31>0?fmt(bk.b31):'—')+'</td>'+
      '<td style="font-weight:'+(bk.b61>0?700:400)+';color:'+(bk.b61>0?'#dc2626':'#94a3b8')+'">'+(bk.b61>0?fmt(bk.b61):'—')+'</td>'+
      '<td style="font-weight:'+(bk.b90>0?800:400)+';color:'+(bk.b90>0?'#7f1d1d':'#94a3b8')+'">'+(bk.b90>0?fmt(bk.b90):'—')+'</td>'+
      '<td style="font-weight:800;color:#b91c1c">'+fmt(s.os)+'</td>'+
      '<td style="font-weight:700;color:'+(s.oldest>60?'#dc2626':s.oldest>30?'#d97706':'#334155')+'">'+s.oldest+'d</td>'+
      '<td><div style="display:flex;align-items:center;gap:6px">'+(laD!==null?'<span style="color:'+(laD>14?'#b91c1c':'#64748b')+'">'+laD+'d ago</span>':'<span style="color:#b91c1c;font-weight:700">Never!</span>')+
        '<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="markAskedToday('+cl.id+')" title="Mark asked today"><i class="fas fa-phone"></i></button></div></td>'+
      '<td><span class="badge '+r.cls+'">'+r.label+'</span></td></tr>';
  }).join('');

  const pending=[...cChallans()].filter(c=>outstanding(c)>0).sort((a,b)=>daysOld(b.date)-daysOld(a.date));
  el('t-aging-ch').innerHTML=pending.map(function(c){
    const os=outstanding(c),st=challanStatus(c),d=daysOld(c.date),cl=APP.clients.find(function(x){return x.id===c.clientId;});
    const laD=cl?.lastAsked?daysOld(cl.lastAsked):null;
    const dc=d>90?'#7f1d1d':d>60?'#b91c1c':d>30?'#d97706':'#334155';
    return '<tr><td><strong style="color:#1d4ed8">'+c.billNo+'</strong></td><td>'+fmtD(c.date)+'</td>'+
      '<td><strong>'+clientName(c.clientId)+'</strong></td><td>'+fmt(c.total)+'</td>'+
      '<td style="font-weight:800;color:#b91c1c">'+fmt(os)+'</td>'+
      '<td><span style="color:'+dc+';font-size:15px;font-weight:800">'+d+'</span><span style="color:#94a3b8;font-size:11px"> days</span></td>'+
      '<td>'+(laD!==null?laD+'d ago':'<span style="color:#b91c1c;font-weight:700">Never</span>')+'</td>'+
      '<td><span class="badge badge-'+st+'">'+st[0].toUpperCase()+st.slice(1)+'</span></td>'+
      '<td><button class="btn btn-success btn-sm" onclick="openPaymentModal('+c.clientId+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Pay</button></td></tr>';
  }).join('');
}

// ═══════════════════════════════════════════════
//  PAYMENTS
// ═══════════════════════════════════════════════
function renderPayments(){
  const cIdFilter = el('p-cl-filter')?.value;
  let all=[...cPayments()];
  if(cIdFilter) all=all.filter(p=>p.clientId==cIdFilter);
  all.sort((a,b)=>new Date(b.date)-new Date(a.date));
  const allTot=[...cPayments()];
  const tot=allTot.reduce((s,p)=>s+p.amount,0);
  const curMonth=new Date(TODAY).toISOString().slice(0,7);
  const mTot=allTot.filter(p=>p.date.startsWith(curMonth)).reduce((s,p)=>s+p.amount,0);
  el('p-tot').textContent=fmtN(tot); el('p-mn').textContent=fmtN(mTot); el('p-cnt').textContent=allTot.length;
  el('t-payments').innerHTML=all.map(function(p){
    return '<tr><td>'+fmtD(p.date)+'</td>'+
      '<td><strong style="cursor:pointer;color:#1d4ed8" onclick="openCustomerDetail('+p.clientId+',\'payments\')">'+clientName(p.clientId)+'</strong></td>'+
      '<td style="font-weight:700;color:#15803d">'+fmt(p.amount)+'</td>'+
      '<td><span class="badge badge-'+p.mode+'">'+p.mode.toUpperCase()+(p.mode==='upi'&&p.upiAccountId?' · '+upiAccountName(p.upiAccountId):'')+'</span></td>'+
      '<td style="color:#64748b;font-size:12px">'+(p.note||'—')+'</td>'+
      '<td><div style="display:flex;gap:4px">'+
        '<button class="btn btn-ghost btn-sm" onclick="openEditPaymentModal(\''+p.id+'\')" title="Edit"><i class="fas fa-edit"></i></button>'+
        '<button class="btn btn-danger btn-sm" onclick="deletePayment(\''+p.id+'\')" title="Delete"><i class="fas fa-trash"></i></button>'+
      '</div></td></tr>';
  }).join('');
}
function deletePayment(id){
  el('modal-title').textContent='Delete Payment?';
  el('modal-body').innerHTML='<div style="text-align:center;padding:10px 0"><i class="fas fa-trash-alt" style="font-size:36px;color:#ef4444;margin-bottom:12px;display:block"></i><div style="font-size:15px;font-weight:700;margin-bottom:6px">Delete this payment record?</div><div style="color:#64748b;font-size:13px">This will recalculate outstanding balances for the client.</div></div>';
  el('modal-box').className='modal-box';
  el('modal').classList.add('open');
  el('modal-foot').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="doDeletePayment(\''+id+'\')">Delete</button>';
}
function doDeletePayment(id){
  APP.payments=APP.payments.filter(function(p){return p.id!==id;});
  clearAllocCache(); saveStore(); closeModal();
  el('modal-foot').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save" onclick="handleSave()">Save</button>';
  toast('Payment deleted','t-del'); refreshAfterPayment();
}

function openEditPaymentModal(id) {
  var p = APP.payments.find(function(x){return x.id===id;}); if(!p) return;
  var clOpts = APP.clients.map(function(c){return '<option value="'+c.id+'" '+(c.id===p.clientId?'selected':'')+'>'+c.name+'</option>';}).join('');
  var html =
    '<div class="form-row"><label>Client</label><select class="inp" id="ep-client">'+clOpts+'</select></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row"><label>Amount *</label><input class="inp" id="ep-amt" type="number" value="'+p.amount+'" min="0.01" step="0.01"></div>'+
      '<div class="form-row"><label>Date *</label><input class="inp" id="ep-date" type="date" value="'+p.date+'"></div>'+
      '<div class="form-row"><label>Mode</label><select class="inp" id="ep-mode" onchange="el(\'ep-upi-wrap\').style.display=this.value===\'upi\'?\'block\':\'none\'">'+
        '<option value="cash" '+(p.mode==='cash'?'selected':'')+'>Cash</option>'+
        '<option value="upi"  '+(p.mode==='upi'?'selected':'')+'>UPI</option>'+
      '</select></div>'+
      '<div class="form-row" id="ep-upi-wrap" style="display:'+(p.mode==='upi'?'block':'none')+'"><label>UPI Account *</label>'+upiSelectHTML('ep-upi', p.upiAccountId)+'</div>'+
      '<div class="form-row"><label>Note</label><input class="inp" id="ep-note" value="'+(p.note||'')+'" placeholder="Optional note"></div>'+
    '</div>';
  openModal('Edit Payment', html, function(){return saveEditPayment(id);});
}
function saveEditPayment(id) {
  var amt = parseFloat(el('ep-amt')?.value)||0;
  if(!amt||amt<=0){alert('Enter a valid amount.');return;}
  var idx = APP.payments.findIndex(function(p){return p.id===id;});
  if(idx<0) return;
  var origCompanyId = APP.payments[idx].companyId || APP.activeCompanyId;
  APP.payments[idx] = {id:id, companyId:origCompanyId, clientId:parseInt(el('ep-client').value), amount:amt, date:el('ep-date').value, mode:el('ep-mode').value, note:el('ep-note').value};
  clearAllocCache(); saveStore(); closeModal();
  toast('Payment updated'); refreshAfterPayment();
}

// ═══════════════════════════════════════════════
//  MODAL SYSTEM
// ═══════════════════════════════════════════════
let modalSaveHandler = null;
function openModal(title, bodyHTML, saveHandler, wide){
  el('modal-title').textContent=title;
  el('modal-body').innerHTML=bodyHTML;
  el('modal-box').className='modal-box'+(wide?' wide':'');
  modalSaveHandler=saveHandler;
  el('modal').classList.add('open');
  const sf=el('modal-foot').querySelector('#modal-save');
  if(sf) sf.style.display=saveHandler?'':'none';
}
function openModal2(title, bodyHTML) {
  el('modal2-title').textContent = title;
  el('modal2-body').innerHTML = bodyHTML;
  el('modal2').classList.add('open');
}
function closeModal2() {
  el('modal2').classList.remove('open');
}

var _ldFrom = '', _ldTo = '', _ldPage = 1;
var _ldPageSize = 20;
function closeModal(){ el('modal').classList.remove('open'); modalSaveHandler=null; _isSaving=false; }
let _isSaving=false;
async function handleSave(){
  if(_isSaving || !modalSaveHandler) return;        // block double-click / re-entry
  _isSaving=true;
  var btn=el('modal-save'), orig=btn?btn.innerHTML:'';
  if(btn){ btn.disabled=true; btn.style.opacity='0.65'; btn.style.pointerEvents='none'; btn.innerHTML='<i class="fas fa-spinner fa-spin" style="margin-right:5px"></i>Saving…'; }
  try {
    await modalSaveHandler();                        // wait for the full save (incl. API) before allowing another
  } catch(e){
    if(typeof toast==='function') toast(e&&e.message?e.message:'Save failed','t-del');
  } finally {
    _isSaving=false;
    var b=el('modal-save');                          // still present only if the modal stayed open (e.g. validation failed)
    if(b){ b.disabled=false; b.style.opacity=''; b.style.pointerEvents=''; b.innerHTML=orig||'Save'; }
  }
}

// ═══ CHALLAN MODAL ═══
function openChallanModal(id){
  var ch = id ? APP.challans.find(function(c){return c.id===id;}) : null;
  window._chalIsEdit = !!ch;   // don't auto-renumber when editing an existing challan
  var defSeries = APP.dcSeries.length ? APP.dcSeries[0].id : 0;
  var curSeriesId = ch ? (ch.seriesId || 0) : defSeries;
  var bill = ch ? ch.billNo : nextBillNo(curSeriesId);
  var showDcNo = ch ? (ch.showDcNo !== undefined ? ch.showDcNo : 1) : 1;
  var seriesOpts = (APP.dcSeries.length ? '' : '<option value="">— No Series —</option>') +
    APP.dcSeries.map(function(s){
      var typ = s.seriesType||'normal';
      var tLbl = typ==='gst'?'GST':typ==='hide'?'Hidden':'Non-GST';
      var preview = typ==='normal' ? 'client-wise' : ((s.prefix||'')+String(s.nextNumber).padStart(3,'0'));
      return '<option value="'+s.id+'"'+(curSeriesId===s.id?' selected':'')+'>'+s.name+' — '+tLbl+' (next: '+preview+')</option>';
    }).join('') +
    '<option value=""'+(curSeriesId?'':' selected')+'>— Manual / No Series —</option>';
  var clOpts = '<option value="" disabled'+(ch?'':' selected')+'>— Select Client —</option>'+
    APP.clients.map(function(c){return '<option value="'+c.id+'" '+(ch&&ch.clientId===c.id?'selected':'')+'>'+c.name+'</option>';}).join('');

  var rowHTML = function(item) {
    item = item || {};
    var rowId='r'+Date.now()+Math.random().toString(36).substr(2,4);
    return '<div class="prow" id="'+rowId+'">'+
      '<select class="inp prod-sel" onchange="onProdSel(this,\''+rowId+'\')" style="font-size:12px">'+
        '<option value="">— Select Product —</option>'+
        cProducts().map(function(p){return '<option value="'+p.id+'" '+(item.pid===p.id?'selected':'')+'>'+p.name+' ('+p.size+')</option>';}).join('')+
      '</select>'+
      '<input class="inp size-f" value="'+(item.size||'')+'" placeholder="Size" readonly style="font-size:12px">'+
      '<input class="inp price-f" type="number" value="'+(item.price||'')+'" placeholder="Rate" oninput="calcRow(\''+rowId+'\')" style="font-size:12px">'+
      '<input class="inp qty-f" type="number" value="'+(item.qty||'')+'" placeholder="Qty" step="0.01" oninput="calcRow(\''+rowId+'\')" style="font-size:12px">'+
      '<input class="inp total-f" value="'+(item.lt?fmtN(item.lt):'')+'" readonly style="font-size:12px;background:var(--surface-2)">'+
      '<button onclick="document.getElementById(\''+rowId+'\').remove();calcGrandTotal()" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;cursor:pointer;padding:6px 9px">×</button>'+
    '</div>';
  };

  var existingRows = ch ? ch.items.map(function(it){return rowHTML(it);}).join('') : rowHTML();

  var html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1;display:flex;align-items:flex-end;gap:8px">'+
        '<div style="flex:1"><label>DC Series</label><select class="inp" id="ch-series" onchange="onSeriesChange()">'+seriesOpts+'</select></div>'+
        '<button type="button" onclick="openSeriesManagerModal()" style="height:38px;padding:0 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:7px;font-size:12px;font-weight:600;color:var(--text-soft);cursor:pointer;white-space:nowrap">Manage</button>'+
      '</div>'+
      '<div class="form-row"><label>DC No</label><input class="inp" id="ch-bill" value="'+bill+'" oninput="validateBillNo(this,\''+(id||'')+'\')"><div id="ch-bill-err" style="color:#b91c1c;font-size:11px;margin-top:3px;display:none">DC No. already exists</div></div>'+
      '<div class="form-row"><label>Date</label><input class="inp" id="ch-date" type="date" value="'+(ch?ch.date:TODAY)+'"></div>'+
      '<div class="form-row"><label>Bill No (Ref)</label><input class="inp" id="ch-ref-bill" value="'+(ch?ch.refBillNo||'':'')+'" placeholder="Optional bill reference"></div>'+
      '<div class="form-row"><label>Payment Mode</label><select class="inp" id="ch-mode" onchange="el(\'ch-upi-wrap\').style.display=this.value===\'upi\'?\'block\':\'none\'">'+
        '<option value="" disabled'+(ch?'':' selected')+'>— Select Mode —</option>'+
        '<option value="cash"   '+(ch&&ch.mode==='cash'?'selected':'')+'>Cash</option>'+
        '<option value="upi"    '+(ch&&ch.mode==='upi'?'selected':'')+'>UPI</option>'+
        '<option value="credit" '+(ch&&ch.mode==='credit'?'selected':'')+'>Credit</option>'+
      '</select></div>'+
      '<div class="form-row" id="ch-upi-wrap" style="display:'+(ch&&ch.mode==='upi'?'block':'none')+'"><label>UPI Account *</label>'+upiSelectHTML('ch-upi', ch?ch.upiAccountId:null)+'</div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Client</label><select class="inp" id="ch-client" onchange="onChallanClientChange()">'+clOpts+'</select>'+
        '<div id="ch-client-warn" style="display:none;margin-top:6px;padding:8px 10px;border-radius:7px;font-size:12px;font-weight:600"></div>'+
      '</div>'+
      '<div class="form-row"><label>Vehicle No</label><input class="inp" id="ch-veh" value="'+(ch?ch.vehicleNo:'')+'" placeholder="GJ-05-AB-1234"></div>'+
      '<div class="form-row"><label>Receiver Name</label><input class="inp" id="ch-recv" value="'+(ch?ch.receiver:'')+'" placeholder="Name"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Notes</label><input class="inp" id="ch-notes" value="'+(ch?ch.notes:'')+'" placeholder="Optional note"></div>'+
      '<div class="form-row" style="grid-column:1/-1;display:flex;align-items:center;gap:24px;flex-wrap:wrap">'+
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;font-weight:600">'+
          '<input type="checkbox" id="ch-gst" onchange="calcGrandTotal()"'+(ch&&ch.gstEnabled?' checked':'')+' style="width:16px;height:16px;cursor:pointer">'+
          'Apply GST &nbsp;&mdash;&nbsp; CGST 9% + SGST 9%'+
        '</label>'+
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:#334155;font-weight:600">'+
          '<input type="checkbox" id="ch-show-dcno"'+(showDcNo?' checked':'')+' style="width:16px;height:16px;cursor:pointer">'+
          'Show DC No. on print'+
        '</label>'+
      '</div>'+
      (function(){var cur=(ch&&ch.challanLabel)||'DELIVERY CHALLAN';return'<div class="form-row" style="grid-column:1/-1"><label>Document Label</label><select class="inp" id="ch-doc-label"><option value="DELIVERY CHALLAN"'+(cur==='DELIVERY CHALLAN'?' selected':'')+'>DELIVERY CHALLAN</option><option value="TAX INVOICE"'+(cur==='TAX INVOICE'?' selected':'')+'>TAX INVOICE</option></select></div>';})()
    +'</div>'+
    '<div style="margin:14px 0 8px;font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em">Products / Items</div>'+
    '<div style="display:grid;grid-template-columns:2fr 90px 90px 90px 100px 34px;gap:7px;margin-bottom:6px">'+
      '<div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Product</div>'+
      '<div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Size</div>'+
      '<div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Rate</div>'+
      '<div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Qty</div>'+
      '<div style="font-size:10px;color:#94a3b8;font-weight:700;text-transform:uppercase">Total</div>'+
      '<div></div>'+
    '</div>'+
    '<div id="prod-rows">'+existingRows+'</div>'+
    '<button onclick="addProdRow()" class="btn btn-ghost" style="font-size:12px;padding:6px 12px;margin-top:4px"><i class="fas fa-plus" style="margin-right:4px"></i>Add Row</button>'+
    '<div id="qty-summary" style="margin-top:8px;min-height:20px;font-size:11px;color:#475569;background:var(--surface-2);border-radius:6px;padding:6px 10px;display:none"></div>'+
    '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;align-items:center;gap:12px">'+
      '<div style="font-size:12px;color:#64748b">Grand Total</div>'+
      '<div id="grand-total" style="font-size:20px;font-weight:800;color:var(--text)">₹0</div>'+
    '</div>';

  openModal(ch?'Edit Challan — '+ch.billNo:'New Challan', html, function(){return saveChallan(id);}, true);
  var _initSeries = curSeriesId ? APP.dcSeries.find(function(x){return x.id===curSeriesId;}) : null;
  applySeriesTypeToModal(_initSeries);
  setTimeout(calcGrandTotal, 50);
  setTimeout(onChallanClientChange, 60);
}

// Warn (inline) when the selected challan client has an outstanding / advance balance
function onChallanClientChange(){
  var warn=el('ch-client-warn'); if(!warn) return;
  var cId=parseInt(el('ch-client').value);
  var billInp=el('ch-bill');
  // Determine series type (non-GST 'normal' = client-wise numbering)
  var sid=parseInt(el('ch-series')?.value)||0;
  var s=sid?APP.dcSeries.find(function(x){return x.id===sid;}):APP.dcSeries.find(function(x){return x.companyId===APP.activeCompanyId;});
  var type=s?(s.seriesType||'normal'):'normal';
  var cl=cId?APP.clients.find(function(c){return c.id===cId;}):null;
  // Non-GST needs the client to have a challan series prefix — if missing, prompt to add it
  if(!window._chalIsEdit && type==='normal' && cl && !(cl.chalPrefix&&String(cl.chalPrefix).trim())){
    if(billInp && !billInp.readOnly) billInp.value='';
    warn.style.display='block'; warn.style.background='#fff7ed'; warn.style.color='#92400e'; warn.style.border='1px solid #fed7aa';
    warn.innerHTML='<i class="fas fa-triangle-exclamation" style="margin-right:6px"></i><b>'+cl.name+'</b> has no non-GST challan series. Add a <b>Prefix</b> for this client first — '+
      '<a href="#" onclick="closeModal();openClientModal('+cId+');return false;" style="color:#1d4ed8;font-weight:700">Add series now</a>.';
    return;
  }
  // For a NEW challan, fill/refresh the DC No from the selected client's series (non-GST).
  // When editing, leave the existing number alone (field stays editable for manual changes).
  if(billInp && !billInp.readOnly && !window._chalIsEdit) billInp.value=nextBillNo(sid);
  if(!cId){ warn.style.display='none'; return; }
  var bal=clientBalance(cId);
  if(bal>0){
    warn.style.display='block';
    warn.style.background='#fef2f2'; warn.style.color='#b91c1c'; warn.style.border='1px solid #fecaca';
    warn.innerHTML='<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Outstanding pending: <strong>'+fmt(bal)+' Dr</strong> — this client has unpaid dues.';
  } else if(bal<0){
    warn.style.display='block';
    warn.style.background='#f0fdf4'; warn.style.color='#15803d'; warn.style.border='1px solid #bbf7d0';
    warn.innerHTML='<i class="fas fa-info-circle" style="margin-right:6px"></i>Advance balance available: <strong>'+fmt(Math.abs(bal))+' Cr</strong>.';
  } else {
    warn.style.display='none';
  }
}

function addProdRow(){
  var rowId='r'+Date.now()+Math.random().toString(36).substr(2,4);
  el('prod-rows').insertAdjacentHTML('beforeend','<div class="prow" id="'+rowId+'">'+
    '<select class="inp prod-sel" onchange="onProdSel(this,\''+rowId+'\')" style="font-size:12px">'+
      '<option value="">— Select Product —</option>'+
      cProducts().map(function(p){return '<option value="'+p.id+'">'+p.name+' ('+p.size+')</option>';}).join('')+
    '</select>'+
    '<input class="inp size-f" placeholder="Size" readonly style="font-size:12px">'+
    '<input class="inp price-f" type="number" placeholder="Rate" oninput="calcRow(\''+rowId+'\')" style="font-size:12px">'+
    '<input class="inp qty-f" type="number" placeholder="Qty" step="0.01" oninput="calcRow(\''+rowId+'\')" style="font-size:12px">'+
    '<input class="inp total-f" readonly style="font-size:12px;background:var(--surface-2)">'+
    '<button onclick="document.getElementById(\''+rowId+'\').remove();calcGrandTotal()" style="background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;cursor:pointer;padding:6px 9px">×</button>'+
  '</div>');
}
function onProdSel(sel,rowId){
  var p=APP.products.find(function(x){return x.id===parseInt(sel.value);});
  if(!p) return;
  var row=el(rowId);
  var charge=p.unit==='charge';
  row.querySelector('.size-f').value=charge?'':p.size;
  // Extra charge: leave the amount blank (no prefilled value) and default qty to 1
  row.querySelector('.price-f').value=charge?'':p.price;
  if(charge) row.querySelector('.qty-f').value=1;
  calcRow(rowId);
}
function calcRow(rowId){
  var row=el(rowId);
  var price=parseFloat(row.querySelector('.price-f').value)||0;
  var qty=parseFloat(row.querySelector('.qty-f').value)||0;
  var tot=price*qty;
  row.querySelector('.total-f').value=tot>0?fmtN(tot):'';
  calcGrandTotal();
}
function calcGrandTotal(){
  var tot=0;
  var qtyMap={};
  document.querySelectorAll('#prod-rows .prow').forEach(function(row){
    var price=parseFloat(row.querySelector('.price-f').value)||0;
    var qty=parseFloat(row.querySelector('.qty-f').value)||0;
    tot+=price*qty;
    if(qty>0){
      var sel=row.querySelector('.prod-sel');
      var pid=parseInt(sel&&sel.value)||0;
      var prod=pid?APP.products.find(function(p){return p.id===pid;}):null;
      var unit=(prod&&prod.unit?prod.unit:'unit').trim().toUpperCase();
      qtyMap[unit]=(qtyMap[unit]||0)+qty;
    }
  });
  var gstOn=el('ch-gst')&&el('ch-gst').checked;
  var ge=el('grand-total');
  if(!ge) return;
  if(gstOn){
    var cgst=+(tot*0.09).toFixed(2), sgst=+(tot*0.09).toFixed(2), grand=tot+cgst+sgst;
    ge.innerHTML=
      '<div style="font-size:12px;color:#64748b;margin-bottom:3px">Sub-total: <strong>'+fmt(tot)+'</strong></div>'+
      '<div style="font-size:12px;color:#64748b;margin-bottom:3px">CGST 9%: <strong>'+fmt(cgst)+'</strong></div>'+
      '<div style="font-size:12px;color:#64748b;margin-bottom:6px">SGST 9%: <strong>'+fmt(sgst)+'</strong></div>'+
      '<div style="font-size:20px;font-weight:800;color:var(--text)">'+fmt(grand)+'</div>';
  } else {
    ge.textContent=fmtN(tot);
  }
  var qs=el('qty-summary');
  if(qs){
    var keys=Object.keys(qtyMap);
    if(keys.length){
      var parts=keys.map(function(u){
        return '<span style="font-weight:700;color:#1d4ed8">'+u+'</span>: '+parseFloat(qtyMap[u].toFixed(4));
      });
      qs.innerHTML='<span style="color:#64748b;font-weight:600;margin-right:6px">Total Qty:</span>'+
        parts.join('<span style="color:#cbd5e1;margin:0 8px">|</span>');
      qs.style.display='';
    } else {
      qs.style.display='none';
    }
  }
}

function saveChallan(existingId){
  var rows=[...document.querySelectorAll('#prod-rows .prow')];
  var items=[];
  for(var i=0;i<rows.length;i++){
    var row=rows[i];
    var pid=parseInt(row.querySelector('.prod-sel').value)||0;
    var price=parseFloat(row.querySelector('.price-f').value)||0;
    var qty=parseFloat(row.querySelector('.qty-f').value)||0;
    if(!pid||!qty) continue;
    var p=APP.products.find(function(x){return x.id===pid;});
    items.push({pid:pid,name:p.name,size:row.querySelector('.size-f').value,price:price,qty:qty,unit:p.unit,lt:price*qty});
  }
  if(!items.length){alert('Add at least one product row with qty.');return;}
  var clId=parseInt(el('ch-client').value);
  if(!clId){alert('Select a client.');return;}
  if(!el('ch-mode').value){alert('Select a payment mode.');return;}
  var total=items.reduce(function(s,it){return s+it.lt;},0);
  var ch={
    id: existingId||uid(),
    companyId: APP.activeCompanyId,
    billNo:el('ch-bill').value,
    date:el('ch-date').value,
    clientId:clId,
    mode:el('ch-mode').value,
    items:items, total:total,
    vehicleNo:el('ch-veh').value,
    receiver:el('ch-recv').value,
    notes:el('ch-notes').value
  };
  if(existingId){ var idx=APP.challans.findIndex(function(c){return c.id===existingId;}); APP.challans[idx]=ch; }
  else APP.challans.unshift(ch);
  clearAllocCache(); saveStore(); closeModal(); renderChallans(); renderDashboard();
  toast(existingId ? 'Challan updated' : 'Challan saved');
}

// ═══ CLIENT MODAL ═══
function openClientModal(id){
  var cl=id?APP.clients.find(function(c){return c.id===id;}):null;
  var html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1"><label>Client / Business Name *</label><input class="inp" id="cl-name" value="'+(cl?cl.name:'')+'" placeholder="e.g. Rajesh Kumar Textiles"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Address</label><input class="inp" id="cl-addr" value="'+(cl?cl.address:'')+'" placeholder="Full address"></div>'+
      '<div class="form-row"><label>Phone *</label><input class="inp" id="cl-phone" value="'+(cl?cl.phone:'')+'" placeholder="98765 43210"></div>'+
      '<div class="form-row"><label>Email</label><input class="inp" id="cl-email" type="email" value="'+(cl?cl.email:'')+'" placeholder="email@example.com"></div>'+
      '<div class="form-row"><label>GST No</label><input class="inp" id="cl-gst" value="'+(cl?cl.gst:'')+'" placeholder="24AABCC1234F1Z5"></div>'+
      '<div class="form-row"><label>Last Asked for Payment</label><input class="inp" id="cl-asked" type="date" value="'+(cl&&cl.lastAsked?cl.lastAsked:'')+'"></div>'+
      '<div class="form-row"><label>Opening Balance (₹)</label><input class="inp" id="cl-ob-amt" type="number" min="0" step="0.01" value="'+Math.abs(cl&&cl.openingBalance?cl.openingBalance:0)+'" placeholder="0.00"></div>'+
      '<div class="form-row"><label>Balance Type</label><select class="inp" id="cl-ob-type"><option value="dr"'+((!cl||!cl.openingBalance||cl.openingBalance>=0)?' selected':'')+'>Dr — To Collect (client owes)</option><option value="cr"'+(cl&&cl.openingBalance<0?' selected':'')+'>Cr — Advance (client paid)</option></select></div>'+
      '<div class="form-row"><label>Opening Balance Date</label><input class="inp" id="cl-ob-date" type="date" value="'+(cl&&cl.openingBalanceDate?cl.openingBalanceDate:'')+'" placeholder="e.g. 01 Apr 2025"></div>'+
    '</div>'+
    '<div style="margin:10px 0 6px;font-size:12px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.05em">Client Challan Number Series (Non-GST)</div>'+
    '<div style="font-size:12px;color:#64748b;margin-bottom:10px">Non-GST challans for this client are numbered <b>PREFIX/MON/NN</b> (resets each month). E.g. prefix <b>RK</b> &rarr; <b>RK/'+seriesMonOf(TODAY)+'/'+String((cl&&cl.chalStartNumber)||1).toString().padStart(2,'0')+'</b>. GST/Hidden series are unaffected.</div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row"><label>Prefix *</label><input class="inp" id="cl-chal-prefix" value="'+(cl?(cl.chalPrefix||''):'')+'" placeholder="e.g. RK (required)"></div>'+
      '<div class="form-row"><label>Start Value</label><input class="inp" id="cl-chal-start" type="number" value="'+(cl?(cl.chalStartNumber||1):1)+'"'+(cl&&cl.chalNextNumber>cl.chalStartNumber?' disabled title="Locked once challans exist"':'')+'></div>'+
    '</div>';
  openModal(cl?'Edit — '+cl.name:'Add New Client', html, function(){return saveClient(id);});
}
function saveClient(existingId){
  var name=el('cl-name').value.trim();
  var phone=el('cl-phone').value.trim();
  if(!name||!phone){alert('Name and Phone are required.');return;}
  var obAmt=parseFloat(el('cl-ob-amt')&&el('cl-ob-amt').value)||0;
  var obType=el('cl-ob-type')&&el('cl-ob-type').value;
  var obj={
    id: existingId||(APP.clients.length?Math.max.apply(null,APP.clients.map(function(c){return c.id;}))+1:1),
    companyId: APP.activeCompanyId,
    name:name, phone:phone,
    address:el('cl-addr').value.trim(),
    email:el('cl-email').value.trim(),
    gst:el('cl-gst').value.trim(),
    openingBalance:obType==='cr'?-obAmt:obAmt,
    lastAsked:el('cl-asked').value||null
  };
  if(existingId){var idx=APP.clients.findIndex(function(c){return c.id===existingId;});APP.clients[idx]=obj;}
  else APP.clients.push(obj);
  saveStore(); closeModal(); renderClients(); populateClientSelects();
  toast(existingId ? 'Client updated' : 'Client added');
}

// ═══ PRODUCT MODAL ═══
function openProductModal(id){
  var p=id?APP.products.find(function(x){return x.id===id;}):null;
  var html=
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row" style="grid-column:1/-1"><label>Product Name *</label><input class="inp" id="pr-name" value="'+(p?p.name:'')+'" placeholder="e.g. Cotton Fabric"></div>'+
      '<div class="form-row" style="grid-column:1/-1"><label>Description</label><input class="inp" id="pr-desc" value="'+(p?p.desc:'')+'" placeholder="Short description"></div>'+
      '<div class="form-row"><label>Size / Specification</label><input class="inp" id="pr-size" value="'+(p?p.size:'')+'" placeholder="e.g. 44" or M/L"></div>'+
      '<div class="form-row"><label>Unit</label><select class="inp" id="pr-unit">'+
        '<option value="meter" '+(!p||p.unit==='meter'?'selected':'')+'>meter</option>'+
        '<option value="kg"    '+(p&&p.unit==='kg'?'selected':'')+'>kg</option>'+
        '<option value="piece" '+(p&&p.unit==='piece'?'selected':'')+'>piece</option>'+
        '<option value="charge" '+(p&&p.unit==='charge'?'selected':'')+'>Charge / Extra (no unit)</option>'+
      '</select></div>'+
      '<div class="form-row"><label>Rate per Unit (₹) *</label><input class="inp" id="pr-price" type="number" value="'+(p?p.price:'')+'" placeholder="250"></div>'+
    '</div>';
  openModal(p?'Edit — '+p.name:'Add New Product', html, function(){return saveProduct(id);});
}
function saveProduct(existingId){
  var name=el('pr-name').value.trim();
  var price=parseFloat(el('pr-price').value)||0;
  if(!name||!price){alert('Name and Rate are required.');return;}
  var obj={
    id:existingId||(APP.products.length?Math.max.apply(null,APP.products.map(function(p){return p.id;}))+1:1),
    companyId: APP.activeCompanyId,
    name:name,desc:el('pr-desc').value.trim(),size:el('pr-size').value.trim(),
    unit:el('pr-unit').value,price:price
  };
  if(existingId){var idx=APP.products.findIndex(function(p){return p.id===existingId;});APP.products[idx]=obj;}
  else APP.products.push(obj);
  saveStore(); closeModal(); renderProducts();
  toast(existingId ? 'Product updated' : 'Product saved');
}

// ═══ COMPANY MODAL ═══
function openCompanyModal(){ openEditCompanyModal(APP.activeCompanyId); }
function saveCompany(){ saveCompanyEdit(APP.activeCompanyId); }

// ═══ PAYMENT MODAL ═══
