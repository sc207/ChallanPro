function openPaymentModal(clientId){
  var cl=APP.clients.find(function(c){return c.id===clientId;});
  if(!cl) return;
  var bal=clientBalance(clientId);
  var os=Math.max(0,bal);
  var adv=Math.max(0,-bal);
  var alloc=getClientAlloc(clientId);
  var creditChs=APP.challans.filter(function(c){return c.clientId===clientId&&c.mode==='credit';}).sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var totalCreditSales=creditChs.reduce(function(s,c){return s+c.total;},0);
  var totalPaidSoFar=APP.payments.filter(function(p){return p.clientId===clientId;}).reduce(function(s,p){return s+p.amount;},0);

  var challanRows=creditChs.map(function(c){
    var paid=alloc.alloc[c.id]||0, oos=c.total-paid;
    var st=oos<=0?'paid':(paid>0?'partial':'pending');
    return '<tr style="font-size:12px"><td style="padding:5px 8px"><strong style="color:#1d4ed8">'+c.billNo+'</strong></td><td style="padding:5px 8px">'+fmtD(c.date)+'</td><td style="padding:5px 8px">'+fmt(c.total)+'</td><td style="padding:5px 8px;color:#15803d">'+fmt(paid)+'</td><td style="padding:5px 8px;font-weight:700;color:'+(oos>0?'#b91c1c':'#15803d')+'">'+fmt(oos)+'</td><td style="padding:5px 8px"><span class="badge badge-'+st+'">'+st[0].toUpperCase()+st.slice(1)+'</span></td></tr>';
  }).join('');

  var html=
    '<div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:14px">'+
      '<div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:8px">'+cl.name+'</div>'+
      '<div style="display:flex;gap:18px;flex-wrap:wrap">'+
        '<div><div style="font-size:11px;color:#94a3b8">Credit Sales</div><div style="font-weight:700">'+fmt(totalCreditSales)+'</div></div>'+
        '<div><div style="font-size:11px;color:#94a3b8">Total Paid</div><div style="font-weight:700;color:#15803d">'+fmt(totalPaidSoFar)+'</div></div>'+
        '<div><div style="font-size:11px;color:'+(os>0?'#b91c1c':'#94a3b8')+'">Outstanding</div><div style="font-weight:800;color:'+(os>0?'#b91c1c':'#15803d')+'">'+fmt(os)+'</div></div>'+
        (adv>0?'<div><div style="font-size:11px;color:#15803d">Advance Balance</div><div style="font-weight:800;color:#15803d">'+fmt(adv)+'</div></div>':'')+
      '</div></div>'+
    (creditChs.length?'<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">FIFO Status (oldest paid first)</div><div style="overflow-x:auto;max-height:150px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:7px"><table><thead><tr><th>DC No</th><th>Date</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead><tbody>'+challanRows+'</tbody></table></div></div>':'')+
    (os<=0&&adv>0?'<div style="background:#dcfce7;border-radius:7px;padding:10px 12px;font-size:12px;color:#15803d;margin-bottom:12px"><strong>Note:</strong> This client has an advance balance of '+fmt(adv)+'. Any new payment will increase the advance.</div>':'')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      '<div class="form-row"><label>Amount (₹) *</label><input class="inp" id="pm-amt" type="number" placeholder="'+(os>0?os:'')+'" min="0.01" step="0.01"></div>'+
      '<div class="form-row"><label>Date *</label><input class="inp" id="pm-date" type="date" value="'+TODAY+'"></div>'+
      '<div class="form-row"><label>Mode *</label><select class="inp" id="pm-mode" onchange="el(\'pm-upi-wrap\').style.display=this.value===\'upi\'?\'block\':\'none\'"><option value="" disabled selected>— Select Mode —</option><option value="cash">Cash</option><option value="upi">UPI</option></select></div>'+
      '<div class="form-row" id="pm-upi-wrap" style="display:none"><label>UPI Account *</label>'+upiSelectHTML('pm-upi', null)+'</div>'+
      '<div class="form-row"><label>Note</label><input class="inp" id="pm-note" placeholder="e.g. 2nd instalment"></div>'+
    '</div>';
  openModal('Record Payment — '+cl.name, html, function(){return savePayment(clientId);}, true);
}

function savePayment(clientId){
  var amt=parseFloat(el('pm-amt').value)||0;
  if(!amt||amt<=0){alert('Enter a valid amount.');return;}
  APP.payments.push({id:'p'+uid(),companyId:APP.activeCompanyId,clientId:clientId,date:el('pm-date').value,amount:amt,mode:el('pm-mode').value,note:el('pm-note').value});
  clearAllocCache(); saveStore(); closeModal();
  toast('Payment recorded');
  refreshAfterPayment();
}

// ═══ CHALLAN VIEW — redirects to delivery challan template ═══
function openChallanView(id){ printDeliveryChallan(id); }
function _openChallanViewOld(id){
  var ch=APP.challans.find(function(c){return c.id===id;});
  if(!ch) return;
  var client=APP.clients.find(function(c){return c.id===ch.clientId;});
  var pa=paidAmt(ch), os=outstanding(ch), st=challanStatus(ch), co=getActiveCompany();
  var html=
    '<div style="border:2px solid #0f172a;border-radius:8px;overflow:hidden">'+
      '<div style="background:#0f172a;color:#fff;padding:14px 18px">'+
        '<div style="font-size:15px;font-weight:800">'+co.name+'</div>'+
        '<div style="font-size:11px;opacity:.7;margin-top:2px">'+co.address+'</div>'+
        '<div style="font-size:11px;opacity:.7">GST: '+co.gst+' · '+co.phone+'</div>'+
      '</div>'+
      '<div style="background:#dbeafe;padding:7px 18px;display:flex;justify-content:space-between;align-items:center">'+
        '<div style="font-size:13px;font-weight:800;color:#1d4ed8">CHALLAN</div>'+
        '<div style="font-size:12px;color:#1e40af;font-weight:700">'+ch.billNo+'</div>'+
      '</div>'+
      '<div style="padding:14px 18px">'+
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:var(--surface-2);border-radius:7px;padding:10px;margin-bottom:12px">'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">BILL NO</div><div style="font-weight:700">'+ch.billNo+'</div></div>'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">DATE</div><div style="font-weight:700">'+fmtD(ch.date)+'</div></div>'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">VEHICLE</div><div style="font-weight:600">'+(ch.vehicleNo||'—')+'</div></div>'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">RECEIVER</div><div style="font-weight:600">'+(ch.receiver||'—')+'</div></div>'+
        '</div>'+
        '<div style="margin-bottom:12px">'+
          '<div style="font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:4px">BILL TO</div>'+
          '<div style="font-weight:700;font-size:14px">'+(client?.name||'—')+'</div>'+
          (client?.address?'<div style="font-size:12px;color:#475569">'+client.address+'</div>':'')+
          (client?.gst?'<div style="font-size:12px;color:#475569">GST: '+client.gst+'</div>':'')+
          (client?.phone?'<div style="font-size:12px;color:#475569">Phone: '+client.phone+'</div>':'')+
        '</div>'+
        '<table style="margin-bottom:10px"><thead><tr>'+
          '<th style="background:#0f172a;color:#fff">#</th>'+
          '<th style="background:#0f172a;color:#fff">Product</th>'+
          '<th style="background:#0f172a;color:#fff">Size</th>'+
          '<th style="background:#0f172a;color:#fff">Rate</th>'+
          '<th style="background:#0f172a;color:#fff">Qty</th>'+
          '<th style="background:#0f172a;color:#fff">Unit</th>'+
          '<th style="background:#0f172a;color:#fff;text-align:right">Amount</th>'+
        '</tr></thead><tbody>'+ch.items.map(function(item,i){return '<tr><td style="color:#94a3b8">'+(i+1)+'</td><td><strong>'+item.name+'</strong></td><td>'+item.size+'</td><td>₹'+item.price.toLocaleString('en-IN')+'</td><td style="font-weight:700">'+item.qty+'</td><td>'+item.unit+'</td><td style="text-align:right;font-weight:700">₹'+item.lt.toLocaleString('en-IN')+'</td></tr>';}).join('')+'</tbody>'+
        '<tfoot><tr><td colspan="6" style="text-align:right;padding:10px 13px;background:#0f172a;color:#fff;font-weight:700">GRAND TOTAL</td><td style="padding:10px 13px;background:#0f172a;color:#fff;font-weight:800;text-align:right">₹'+ch.total.toLocaleString('en-IN')+'</td></tr></tfoot></table>'+
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:var(--surface-2);border-radius:7px;padding:10px">'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">MODE</div><span class="badge badge-'+ch.mode+'">'+ch.mode.toUpperCase()+(ch.mode==='upi'&&ch.upiAccountId?' · '+upiAccountName(ch.upiAccountId):'')+'</span></div>'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">PAID</div><div style="font-weight:700;color:#15803d">₹'+pa.toLocaleString('en-IN')+'</div></div>'+
          '<div><div style="font-size:10px;color:'+(os>0?'#b91c1c':'#94a3b8')+';font-weight:700">OUTSTANDING</div><div style="font-weight:700;color:'+(os>0?'#b91c1c':'#15803d')+'">₹'+os.toLocaleString('en-IN')+'</div></div>'+
          '<div><div style="font-size:10px;color:#94a3b8;font-weight:700">STATUS</div><span class="badge badge-'+st+'">'+st.toUpperCase()+'</span></div>'+
        '</div>'+
        (ch.notes?'<div style="margin-top:10px;padding:8px 12px;background:rgba(245,158,11,.12);border-radius:7px;font-size:12px;color:#92400e"><strong>Notes:</strong> '+ch.notes+'</div>':'')+
      '</div></div>'+
    '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">'+
      (ch.mode==='credit'?'<button class="btn btn-success" onclick="closeModal();openPaymentModal('+ch.clientId+')"><i class="fas fa-rupee-sign" style="margin-right:5px"></i>Record Payment</button>':'<div></div>')+
      '<div style="display:flex;gap:7px">'+
        '<button class="btn" style="background:#0369a1;color:#fff" onclick="closeModal();printDeliveryChallan(\''+id+'\')"><i class="fas fa-print" style="margin-right:5px"></i>Print Delivery</button>'+
        '<button class="btn" style="background:#dc5800;color:#fff" onclick="downloadChallanPDF(\''+id+'\')"><i class="fas fa-file-pdf" style="margin-right:5px"></i>Download PDF</button>'+
      '</div></div>';
  openModal('Challan — '+ch.billNo, html, null, true);
  setTimeout(function(){ var sf=el('modal-foot').querySelector('#modal-save'); if(sf) sf.style.display='none'; },0);
}

// ═══ CLIENT LEDGER MODAL ═══
// Inline itemized breakdown (product / qty / rate / total + grand total + notes) for a ledger sale row
function ledgerItemsHTML(e){
  if(!e.items||!e.items.length) return e.desc?'<div style="font-size:11px;color:#94a3b8">'+e.desc+'</div>':'';
  var rows=e.items.map(function(i){
    return '<tr>'+
      '<td style="padding:1px 6px 1px 0;color:#475569">'+i.name+(i.size?' <span style="color:#94a3b8">('+i.size+')</span>':'')+'</td>'+
      '<td style="padding:1px 6px;text-align:right;color:#64748b;white-space:nowrap">'+i.qty+(unitLabel(i.unit)?' '+unitLabel(i.unit):'')+'</td>'+
      '<td style="padding:1px 6px;text-align:right;color:#64748b;white-space:nowrap">'+fmt(i.price)+'</td>'+
      '<td style="padding:1px 0 1px 6px;text-align:right;font-weight:600;color:#334155;white-space:nowrap">'+fmt(i.lt)+'</td>'+
    '</tr>';
  }).join('');
  var sub=e.items.reduce(function(s,i){return s+(i.lt||0);},0);
  var gstRow='';
  if(e.gstEnabled){ var g=+(sub*0.18).toFixed(2); gstRow='<tr><td colspan="3" style="text-align:right;padding:1px 6px 0 0;color:#64748b">GST 18%</td><td style="text-align:right;padding:1px 0 0 6px;color:#64748b;white-space:nowrap">'+fmt(g)+'</td></tr>'; }
  var html='<table style="width:100%;max-width:340px;font-size:10.5px;margin-top:5px;border-collapse:collapse">'+
    '<thead><tr style="color:#94a3b8;font-size:9px;text-transform:uppercase;letter-spacing:.03em">'+
      '<th style="text-align:left;font-weight:700;padding:0 6px 2px 0">Item</th>'+
      '<th style="text-align:right;font-weight:700;padding:0 6px 2px">Qty</th>'+
      '<th style="text-align:right;font-weight:700;padding:0 6px 2px">Rate</th>'+
      '<th style="text-align:right;font-weight:700;padding:0 0 2px 6px">Total</th>'+
    '</tr></thead><tbody>'+rows+'</tbody>'+
    '<tfoot>'+gstRow+'<tr style="border-top:1px solid #e2e8f0"><td colspan="3" style="text-align:right;padding:2px 6px 0 0;font-weight:700;color:#475569">Grand Total</td><td style="text-align:right;padding:2px 0 0 6px;font-weight:800;color:var(--text);white-space:nowrap">'+fmt(e.amount)+'</td></tr></tfoot>'+
  '</table>';
  if(e.notes) html+='<div style="font-size:10.5px;color:#64748b;margin-top:3px;font-style:italic"><i class="fas fa-sticky-note" style="margin-right:4px;color:#cbd5e1"></i>'+e.notes+'</div>';
  return html;
}

function openClientLedger(clientId){
  var cl=APP.clients.find(function(c){return c.id===clientId;});
  if(!cl) return;
  _ldPage=1;

  function buildAllEvents(){
    var ev=[];
    APP.challans.filter(function(c){return c.clientId===clientId&&c.mode==='credit';}).forEach(function(c){
      ev.push({date:c.date,type:'sale',amount:c.total,ref:c.billNo,desc:c.items.map(function(i){return i.name;}).join(', '),items:c.items,notes:c.notes,gstEnabled:c.gstEnabled,id:c.id});
    });
    APP.payments.filter(function(p){return p.clientId===clientId;}).forEach(function(p){
      ev.push({date:p.date,type:'payment',amount:p.amount,ref:'—',desc:p.note||'Payment received',mode:p.mode,upiAccountId:p.upiAccountId});
    });
    ev.sort(function(a,b){return new Date(a.date)-new Date(b.date)||(a.type==='payment'?1:-1);});
    return ev;
  }

  function renderModalBody(){
    var allEvents=buildAllEvents();
    var ob=cl.openingBalance||0;
    // Pre-advance running for pre-filter events
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
    var pageEvents=filtered.slice((_ldPage-1)*_ldPageSize,_ldPage*_ldPageSize);

    var obRow='';
    if(ob!==0&&!_ldFrom){
      var obBal=Math.abs(ob);
      var obDateStr=cl.openingBalanceDate?fmtD(cl.openingBalanceDate):'—';
      obRow='<tr style="background:rgba(245,158,11,.12)">'+
        '<td>'+obDateStr+'</td>'+
        '<td><strong>Opening Balance</strong></td>'+
        '<td style="color:#b91c1c;font-weight:700">'+(ob>0?fmt(obBal):'—')+'</td>'+
        '<td style="color:#15803d;font-weight:700">'+(ob<0?fmt(obBal):'—')+'</td>'+
        '<td style="font-weight:800;color:'+(ob>0?'#b91c1c':'#15803d')+'">'+fmt(obBal)+' '+(ob>0?'Dr':'Cr')+'</td>'+
      '</tr>';
    }
    var rows=pageEvents.map(function(e){
      var bl;
      if(e.type==='sale'){
        running+=e.amount;
        bl=running>0?'#b91c1c':running<0?'#15803d':'#475569';
        return '<tr><td style="vertical-align:top">'+fmtD(e.date)+'</td><td style="vertical-align:top"><strong style="color:#1d4ed8;cursor:pointer" onclick="openChallanView(\''+e.id+'\')">'+e.ref+'</strong>'+ledgerItemsHTML(e)+'</td><td style="color:#b91c1c;font-weight:700;vertical-align:top">'+fmt(e.amount)+'</td><td style="color:#94a3b8;vertical-align:top">—</td><td style="font-weight:800;color:'+bl+';vertical-align:top">'+fmt(Math.abs(running))+' '+(running>0?'Dr':running<0?'Cr':'Nil')+'</td></tr>';
      } else {
        running-=e.amount;
        bl=running>0?'#b91c1c':running<0?'#15803d':'#475569';
        return '<tr style="background:rgba(34,197,94,.10)"><td>'+fmtD(e.date)+'</td><td><span style="color:#15803d;font-weight:700">Payment Received</span><br><span style="font-size:11px;color:#64748b">'+e.desc+' <span class="badge badge-'+e.mode+'" style="font-size:10px">'+e.mode.toUpperCase()+(e.mode==='upi'&&e.upiAccountId?' · '+upiAccountName(e.upiAccountId):'')+'</span></span></td><td style="color:#94a3b8">—</td><td style="color:#15803d;font-weight:700">'+fmt(e.amount)+'</td><td style="font-weight:800;color:'+bl+'">'+fmt(Math.abs(running))+' '+(running>0?'Dr':running<0?'Cr':'Nil')+'</td></tr>';
      }
    }).join('');

    var bal=clientBalance(clientId);
    var filterUI='<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">'+
      '<label style="font-size:12px;color:#64748b">From</label>'+
      '<input type="date" value="'+_ldFrom+'" onchange="_ldFrom=this.value;_ldPage=1;_reLedgerModal()" style="font-size:12px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px">'+
      '<label style="font-size:12px;color:#64748b">To</label>'+
      '<input type="date" value="'+_ldTo+'" onchange="_ldTo=this.value;_ldPage=1;_reLedgerModal()" style="font-size:12px;padding:4px 8px;border:1px solid #e2e8f0;border-radius:6px">'+
      '<button onclick="_ldFrom=\'\';_ldTo=\'\';_ldPage=1;_reLedgerModal()" class="btn btn-ghost" style="font-size:12px;padding:4px 10px">Clear</button>'+
    '</div>';

    var pagination='<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:6px">'+
      '<span style="font-size:12px;color:#64748b">'+filtered.length+' entries · Page '+_ldPage+' of '+totalPages+'</span>'+
      '<div style="display:flex;gap:6px">'+
        '<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="_ldPage=Math.max(1,_ldPage-1);_reLedgerModal()" '+((_ldPage<=1)?'disabled':'')+'>‹ Prev</button>'+
        '<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px" onclick="_ldPage=Math.min('+totalPages+',_ldPage+1);_reLedgerModal()" '+((_ldPage>=totalPages)?'disabled':'')+'>Next ›</button>'+
      '</div>'+
    '</div>';

    var pdfBtns='<div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<button class="btn" style="background:#dc5800;color:#fff;font-size:12px" onclick="downloadLedgerPDF('+clientId+')"><i class="fas fa-file-pdf" style="margin-right:4px"></i>Full PDF</button>'+
      ((_ldFrom||_ldTo)?'<button class="btn" style="background:#7c3aed;color:#fff;font-size:12px" onclick="downloadLedgerPDF('+clientId+',\''+_ldFrom+'\',\''+_ldTo+'\')"><i class="fas fa-filter" style="margin-right:4px"></i>Filtered PDF</button>':'')+
      '<button class="btn btn-success" style="font-size:12px" onclick="closeModal();openPaymentModal('+clientId+')"><i class="fas fa-rupee-sign" style="margin-right:4px"></i>Record Payment</button>'+
    '</div>';

    el('modal-body').innerHTML=
      '<div style="background:var(--surface-2);border-radius:8px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'+
        '<div><div style="font-weight:700;font-size:14px;color:var(--text)">'+cl.name+'</div><div style="font-size:11px;color:#64748b">'+cl.gst+' · '+cl.phone+'</div></div>'+
        '<div style="text-align:right"><div style="font-size:11px;color:#94a3b8">'+(bal>0?'Outstanding':bal<0?'Advance':'Balance')+'</div><div style="font-size:18px;font-weight:800;color:'+(bal>0?'#b91c1c':bal<0?'#15803d':'#475569')+'">'+fmt(Math.abs(bal))+' '+(bal>0?'Dr':bal<0?'Cr':'')+'</div></div>'+
      '</div>'+
      filterUI+
      (allEvents.length?
        '<div style="overflow-x:auto"><table><thead><tr><th>Date</th><th>Particulars</th><th style="color:#b91c1c">Debit (Sales)</th><th style="color:#15803d">Credit (Payments)</th><th>Balance</th></tr></thead><tbody>'+obRow+rows+'</tbody></table></div>'+
        (totalPages>1?pagination:'')+
        '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+pdfBtns+'</div>'
      :'<div style="text-align:center;padding:30px;color:#94a3b8">No credit transactions yet.</div>');
  }

  window._reLedgerModal = renderModalBody;
  openModal('Party Ledger — '+cl.name, '', null, true);
  setTimeout(function(){ var sf=el('modal-foot').querySelector('#modal-save'); if(sf) sf.style.display='none'; },0);
  renderModalBody();
}

// ═══ DELETE ═══
function confirmDelete(type, id){
  var labels={challan:'challan',client:'client',product:'product',supplier:'supplier',purchase:'purchase'};
  el('modal-title').textContent='Confirm Delete';
  el('modal-body').innerHTML='<div style="text-align:center;padding:10px 0"><i class="fas fa-trash-alt" style="font-size:36px;color:#ef4444;margin-bottom:12px;display:block"></i><div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">Delete this '+labels[type]+'?</div><div style="color:#64748b;font-size:13px">This action cannot be undone.</div></div>';
  el('modal-box').className='modal-box';
  el('modal').classList.add('open');
  el('modal-foot').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-danger" onclick="doDelete(\''+type+'\',\''+id+'\')">Delete</button>';
}
function doDelete(type,id){
  if(type==='challan'){
    APP.challans=APP.challans.filter(function(c){return c.id!==id;});
    clearAllocCache();
  } else if(type==='client'){
    APP.clients=APP.clients.filter(function(c){return c.id!=id;});
    APP.payments=APP.payments.filter(function(p){return p.clientId!=id;});
    clearAllocCache();
  } else if(type==='product'){
    APP.products=APP.products.filter(function(p){return p.id!=id;});
  }
  saveStore(); closeModal();
  el('modal-foot').innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="modal-save" onclick="handleSave()">Save</button>';
  toast(type[0].toUpperCase()+type.slice(1)+' deleted','t-del');
  if(type==='challan') renderChallans();
  if(type==='client') renderClients();
  if(type==='product') renderProducts();
  renderDashboard();
}

// ═══════════════════════════════════════════════
//  POPULATE SELECTS
// ═══════════════════════════════════════════════
function populateClientSelects(){
  ['fc-cl','r-cl','p-cl-filter','qp-client'].forEach(function(selId){
    var sel=el(selId); if(!sel) return;
    var cur=sel.value;
    while(sel.options.length>1) sel.remove(1);
    cClients().forEach(function(c){sel.add(new Option(c.name,c.id));});
    sel.value=cur;
  });
}

// ═══════════════════════════════════════════════
//  PDF EXPORTS
// ═══════════════════════════════════════════════
function pdfHeader(doc, subtitle, landscape, company) {
  var W = landscape ? 297 : 210, co = company || getActiveCompany();
  var rgb = hexToRgb(co.primaryColor||'#0f172a');
  var sec = hexToRgb(co.secondaryColor||co.primaryColor||'#334155');
  // Brand band + a thin secondary-colour accent strip beneath it
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, 0, W, 32, 'F');
  doc.setFillColor(sec[0], sec[1], sec[2]);
  doc.rect(0, 32, W, 2.4, 'F');
  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(co.name || '', 14, 13);
  // Address + contact line (lighter tint for hierarchy)
  doc.setTextColor(232, 236, 243);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  if (co.address) doc.text(co.address, 14, 19.5);
  var contact = [];
  if (co.phone) contact.push('Ph ' + co.phone);
  if (co.gst)   contact.push('GSTIN ' + co.gst);
  if (co.email) contact.push(co.email);
  if (contact.length) doc.text(contact.join('   |   '), 14, 25);
  // Document title, right-aligned as a subtle uppercase label
  if (subtitle) {
    doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(226, 232, 240);
    doc.text(subtitle, 14, 30.5);
  }
}

function pdfFooter(doc, landscape, company) {
  var W = landscape ? 297 : 210;
  var co = company || getActiveCompany(),
      pageH = landscape ? 210 : 297,
      fY = pageH - 10;
  var sig = (co.authorizedSignatory || co.proprietor)
    ? (co.authorizedSignatory || co.proprietor) + ' — Authorised Signatory'
    : 'For ' + (co.name || '') + '  ·  Authorised Signatory';
  // Stamp the footer on every page (so multi-page ledgers stay branded + numbered)
  var total = doc.getNumberOfPages();
  for (var p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3);
    doc.line(14, fY - 4, W - 14, fY - 4);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(148, 163, 184);
    doc.text('Generated ' + fmtD(TODAY), 14, fY);
    doc.text('Page ' + p + ' of ' + total, W / 2, fY, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setTextColor(71, 85, 105);
    doc.text(sig, W - 14, fY, { align: 'right' });
  }
}

function downloadChallanPDF(id) {
  // Open the delivery challan overlay then auto-trigger browser Print → Save as PDF
  printDeliveryChallan(id);
  setTimeout(function(){ window.print(); }, 350);
}

function downloadReportPDF() {
  if (!window.jspdf) { alert('PDF library not loaded. Check your internet connection.'); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  var W = 297, mg = 14;
  var cId = el('r-cl').value, mn = el('r-mn').value;
  var list = cChallans().filter(function(c){return c.date.startsWith(mn);});
  if (cId) list = list.filter(function(c){return c.clientId == cId;});
  list.sort(function(a,b){return new Date(a.date)-new Date(b.date);});
  var bName  = cId ? clientName(parseInt(cId)) : 'All Clients';
  var mLabel = new Date(mn + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  var tS = list.reduce(function(s,c){return s+c.total;},0);
  var tP = list.reduce(function(s,c){return s+paidAmt(c);},0);
  var tO = list.reduce(function(s,c){return s+outstanding(c);},0);
  var tCash = list.filter(function(c){return c.mode==='cash';}).reduce(function(s,c){return s+c.total;},0);
  var tUPI  = list.filter(function(c){return c.mode==='upi';}).reduce(function(s,c){return s+c.total;},0);
  var tCred = list.filter(function(c){return c.mode==='credit';}).reduce(function(s,c){return s+c.total;},0);

  pdfHeader(doc, 'Monthly Report  ·  ' + mLabel + '  ·  ' + bName + '  ·  Generated: ' + fmtD(TODAY), true);
  var y = 43;
  var boxes = [
    { l:'Total Sales',    v:'Rs.'+fmtPdf(tS),   c:[29,78,216]  },
    { l:'Cash Sales',     v:'Rs.'+fmtPdf(tCash),c:[21,128,61]  },
    { l:'UPI Sales',      v:'Rs.'+fmtPdf(tUPI), c:[109,40,217] },
    { l:'Credit Sales',   v:'Rs.'+fmtPdf(tCred),c:[157,23,77]  },
    { l:'Collected',      v:'Rs.'+fmtPdf(tP),   c:[21,128,61]  },
    { l:'Outstanding',    v:'Rs.'+fmtPdf(tO),   c:tO>0?[185,28,28]:[21,128,61] },
    { l:'Total Challans', v:list.length+'',c:[100,116,139]}
  ];
  boxes.forEach(function(b, i) {
    var x = mg + i * 38.5;
    doc.setFillColor(248, 250, 252); doc.rect(x, y, 36, 16, 'F');
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139); doc.text(b.l, x+2, y+7);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor.apply(doc, b.c); doc.text(b.v, x+2, y+14);
  });
  y += 22;
  doc.autoTable({
    startY: y, margin: { left: mg, right: mg },
    head: [['Date', 'DC No', 'Client', 'Items', 'Total (Rs.)', 'Paid (Rs.)', 'Outstanding (Rs.)', 'Mode', 'Status']],
    body: list.map(function(c){return [fmtD(c.date), c.billNo, clientName(c.clientId), c.items.map(function(i){return i.name+'('+i.qty+(unitLabel(i.unit))+')';}).join(', '), c.total.toLocaleString('en-IN'), paidAmt(c).toLocaleString('en-IN'), outstanding(c).toLocaleString('en-IN'), c.mode.toUpperCase(), challanStatus(c).toUpperCase()];}),
    foot: [['', '', '', 'TOTAL', tS.toLocaleString('en-IN'), tP.toLocaleString('en-IN'), tO.toLocaleString('en-IN'), '', '']],
    headStyles: { fillColor:[15,23,42], textColor:[255,255,255], fontSize:8, fontStyle:'bold', cellPadding:3 },
    bodyStyles: { fontSize:8, cellPadding:2.5, textColor:[51,65,85] },
    footStyles: { fillColor:[15,23,42], textColor:[255,255,255], fontStyle:'bold', fontSize:8 },
    alternateRowStyles: { fillColor:[248,250,252] },
    columnStyles: { 4:{halign:'right'}, 5:{halign:'right',textColor:[21,128,61]}, 6:{halign:'right',textColor:[185,28,28]} }
  });
  pdfFooter(doc, true);
  doc.save('Report-' + mLabel.replace(' ','-') + '-' + bName.replace(/\s+/g,'-') + '.pdf');
}

function downloadAgingPDF() {
  if (!window.jspdf) { alert('PDF library not loaded. Check your internet connection.'); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  var W = 297, mg = 14;
  var b = agingBuckets(null);
  var totalOS = b.b0 + b.b31 + b.b61 + b.b90;
  pdfHeader(doc, 'Credit Aging Analysis  ·  As of ' + fmtD(TODAY), true);
  var y = 43;
  var boxes = [
    { l:'0–30 Days (Fresh)',    v:'Rs.'+fmtPdf(b.b0),  c:[21,128,61]   },
    { l:'31–60 Days (Remind)',  v:'Rs.'+fmtPdf(b.b31), c:[217,119,6]   },
    { l:'61–90 Days (Urgent)',  v:'Rs.'+fmtPdf(b.b61), c:[220,38,38]   },
    { l:'90+ Days (Critical)',  v:'Rs.'+fmtPdf(b.b90), c:[127,29,29]   },
    { l:'Total Outstanding',    v:'Rs.'+fmtPdf(totalOS),c:[185,28,28]  },
  ];
  boxes.forEach(function(bx, i) {
    var x = mg + i * 53;
    doc.setFillColor(248,250,252); doc.rect(x, y, 50, 16, 'F');
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139); doc.text(bx.l, x+2, y+7);
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor.apply(doc, bx.c); doc.text(bx.v, x+2, y+14);
  });
  y += 22;
  doc.autoTable({
    startY: y, margin: { left: mg, right: mg },
    head: [['Client', 'Phone', '0–30d (Rs.)', '31–60d (Rs.)', '61–90d (Rs.)', '90+d (Rs.)', 'Total OS (Rs.)', 'Oldest', 'Last Asked', 'Risk']],
    body: cClients().map(function(cl) {
      var s = clientStats(cl.id), bk = agingBuckets(cl.id), r = riskLevel(s.oldest, s.os);
      var laD = cl.lastAsked ? daysOld(cl.lastAsked) + 'd ago' : 'Never asked!';
      return [cl.name, cl.phone, bk.b0>0?bk.b0.toLocaleString('en-IN'):'—', bk.b31>0?bk.b31.toLocaleString('en-IN'):'—', bk.b61>0?bk.b61.toLocaleString('en-IN'):'—', bk.b90>0?bk.b90.toLocaleString('en-IN'):'—', s.os>0?s.os.toLocaleString('en-IN'):'Clear', s.oldest>0?s.oldest+' days':'—', laD, r.label];
    }),
    headStyles: { fillColor:[15,23,42], textColor:[255,255,255], fontSize:8, fontStyle:'bold', cellPadding:3 },
    bodyStyles: { fontSize:8, cellPadding:2.5, textColor:[51,65,85] },
    alternateRowStyles: { fillColor:[248,250,252] }
  });
  y = doc.lastAutoTable.finalY + 10;
  var pending = [...cChallans()].filter(function(c){return outstanding(c)>0;}).sort(function(a,b){return daysOld(b.date)-daysOld(a.date);});
  if (pending.length) {
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(15,23,42);
    doc.text('All Pending Credits — Oldest First', mg, y); y += 4;
    doc.autoTable({
      startY: y, margin: { left: mg, right: mg },
      head: [['DC No', 'Date', 'Client', 'Total (Rs.)', 'Outstanding (Rs.)', 'Days Old', 'Status']],
      body: pending.map(function(c){return [c.billNo, fmtD(c.date), clientName(c.clientId), c.total.toLocaleString('en-IN'), outstanding(c).toLocaleString('en-IN'), daysOld(c.date)+' days', challanStatus(c).toUpperCase()];}),
      headStyles: { fillColor:[15,23,42], textColor:[255,255,255], fontSize:8, fontStyle:'bold', cellPadding:3 },
      bodyStyles: { fontSize:8, cellPadding:2.5, textColor:[51,65,85] },
      alternateRowStyles: { fillColor:[248,250,252] },
      columnStyles: { 4:{halign:'right',textColor:[185,28,28],fontStyle:'bold'}, 5:{halign:'right'} }
    });
  }
  pdfFooter(doc, true);
  doc.save('Aging-Analysis-' + TODAY + '.pdf');
}

function downloadChallansListPDF() {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  var W=297, mg=14;

  // mirror renderChallans filter state
  var q  = (el('fc-q').value||'').toLowerCase();
  var cl = el('fc-cl').value;
  var st = el('fc-st').value;
  var mo = el('fc-mo').value;
  var mn = el('fc-mn').value;
  var list = [...cChallans()].sort(function(a,b){return new Date(b.date)-new Date(a.date);});
  if(q)  list=list.filter(function(c){return c.billNo.toLowerCase().includes(q)||clientName(c.clientId).toLowerCase().includes(q)||c.items.some(function(i){return i.name.toLowerCase().includes(q);});});
  if(cl) list=list.filter(function(c){return c.clientId==cl;});
  if(st) list=list.filter(function(c){return challanStatus(c)===st;});
  if(mo) list=list.filter(function(c){return c.mode===mo;});
  if(mn) list=list.filter(function(c){return c.date.startsWith(mn);});

  var tS=list.reduce(function(s,c){return s+c.total;},0);
  var tP=list.reduce(function(s,c){return s+paidAmt(c);},0);
  var tO=list.reduce(function(s,c){return s+outstanding(c);},0);
  var nPaid=list.filter(function(c){return challanStatus(c)==='paid';}).length;
  var nPart=list.filter(function(c){return challanStatus(c)==='partial';}).length;
  var nPend=list.filter(function(c){return challanStatus(c)==='pending';}).length;

  var parts=[];
  if(cl) parts.push(clientName(parseInt(cl)));
  if(mn) parts.push(new Date(mn+'-01').toLocaleDateString('en-IN',{month:'long',year:'numeric'}));
  if(st) parts.push(st.toUpperCase());
  var subtitle='Challans'+(parts.length?' — '+parts.join(' · '):'')+'  ·  Generated: '+fmtD(TODAY);

  pdfHeader(doc, subtitle, true);
  var y=43;
  var boxes=[
    {l:'Total Challans',  v:list.length+'',   c:[29,78,216]},
    {l:'Total Value',     v:'Rs.'+fmtPdf(tS),        c:[29,78,216]},
    {l:'Collected',       v:'Rs.'+fmtPdf(tP),        c:[21,128,61]},
    {l:'Outstanding',     v:'Rs.'+fmtPdf(tO),        c:tO>0?[185,28,28]:[21,128,61]},
    {l:'Paid',            v:nPaid+'',           c:[21,128,61]},
    {l:'Partial',         v:nPart+'',           c:[217,119,6]},
    {l:'Pending',         v:nPend+'',           c:[185,28,28]},
  ];
  boxes.forEach(function(b,i){
    var x=mg+i*38;
    doc.setFillColor(248,250,252);doc.rect(x,y,36,16,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(100,116,139);doc.text(b.l,x+2,y+7);
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,b.c);doc.text(b.v,x+2,y+14);
  });
  y+=22;
  doc.autoTable({
    startY:y, margin:{left:mg,right:mg},
    head:[['Date','DC No','Client','Items','Total (Rs.)','Paid (Rs.)','Outstanding (Rs.)','Mode','Age','Status']],
    body:list.map(function(c){
      var pa=paidAmt(c),os=outstanding(c),d=daysOld(c.date);
      return [fmtD(c.date),c.billNo,clientName(c.clientId),
        c.items.map(function(i){return i.name+'('+i.qty+(unitLabel(i.unit))+')';}).join(', '),
        c.total.toLocaleString('en-IN'),pa.toLocaleString('en-IN'),os.toLocaleString('en-IN'),
        c.mode.toUpperCase(),d+'d',challanStatus(c).toUpperCase()];
    }),
    foot:[['','','','TOTAL',tS.toLocaleString('en-IN'),tP.toLocaleString('en-IN'),tO.toLocaleString('en-IN'),'','','']],
    headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
    bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85]},
    footStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{4:{halign:'right'},5:{halign:'right',textColor:[21,128,61]},6:{halign:'right',textColor:[185,28,28],fontStyle:'bold'},8:{halign:'center'}}
  });
  pdfFooter(doc, true);
  var fname='Challans'+(mn?'-'+mn:'')+(cl?'-'+clientName(parseInt(cl)).replace(/\s+/g,'-'):'');
  doc.save(fname+'-'+TODAY+'.pdf');
}

function downloadPaymentsPDF() {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  var W=297, mg=14;

  var cIdFilter = el('p-cl-filter')?.value || '';
  var list=[...cPayments()];
  if(cIdFilter) list=list.filter(function(p){return p.clientId==cIdFilter;});
  list.sort(function(a,b){return new Date(b.date)-new Date(a.date);});

  var tot  =list.reduce(function(s,p){return s+p.amount;},0);
  var tCash=list.filter(function(p){return p.mode==='cash';}).reduce(function(s,p){return s+p.amount;},0);
  var tUPI =list.filter(function(p){return p.mode==='upi'; }).reduce(function(s,p){return s+p.amount;},0);

  var subtitle='Payment Collections  ·  '+(cIdFilter?clientName(parseInt(cIdFilter)):'All Clients')+'  ·  Generated: '+fmtD(TODAY);
  pdfHeader(doc, subtitle, true);
  var y=43;
  var boxes=[
    {l:'Total Collected', v:'Rs.'+fmtPdf(tot),        c:[21,128,61]},
    {l:'Cash',            v:'Rs.'+fmtPdf(tCash),       c:[21,128,61]},
    {l:'UPI',             v:'Rs.'+fmtPdf(tUPI),        c:[109,40,217]},
    {l:'Total Entries',   v:list.length+'',       c:[29,78,216]},
  ];
  boxes.forEach(function(b,i){
    var x=mg+i*66;
    doc.setFillColor(248,250,252);doc.rect(x,y,63,16,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(100,116,139);doc.text(b.l,x+2,y+7);
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,b.c);doc.text(b.v,x+2,y+14);
  });
  y+=22;
  doc.autoTable({
    startY:y, margin:{left:mg,right:mg},
    head:[['Date','Client','Amount (Rs.)','Mode','Note']],
    body:list.map(function(p){
      return [fmtD(p.date),clientName(p.clientId),p.amount.toLocaleString('en-IN'),p.mode.toUpperCase(),p.note||'—'];
    }),
    foot:[['','TOTAL',tot.toLocaleString('en-IN'),'','']],
    headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
    bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85]},
    footStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{2:{halign:'right',textColor:[21,128,61],fontStyle:'bold'}}
  });
  pdfFooter(doc, true);
  var fname='Payments'+(cIdFilter?'-'+clientName(parseInt(cIdFilter)).replace(/\s+/g,'-'):'');
  doc.save(fname+'-'+TODAY+'.pdf');
}

function downloadClientsPDF() {
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
  var W=297, mg=14;

  var totalSales=cClients().reduce(function(s,cl){
    return s+cChallans().filter(function(c){return c.clientId===cl.id;}).reduce(function(ss,c){return ss+c.total;},0);
  },0);
  var totalPaid=cPayments().reduce(function(s,p){return s+p.amount;},0);
  var totalOS=cClients().reduce(function(s,cl){return s+Math.max(0,clientBalance(cl.id));},0);
  var nCredit=cClients().filter(function(cl){return Math.max(0,clientBalance(cl.id))>0;}).length;

  pdfHeader(doc, 'Client Summary  ·  Generated: '+fmtD(TODAY), true);
  var y=43;
  var boxes=[
    {l:'Total Clients',      v:cClients().length+'',  c:[29,78,216]},
    {l:'Total Sales',        v:'Rs.'+fmtPdf(totalSales),  c:[29,78,216]},
    {l:'Total Collected',    v:'Rs.'+fmtPdf(totalPaid),   c:[21,128,61]},
    {l:'Total Outstanding',  v:'Rs.'+fmtPdf(totalOS),     c:totalOS>0?[185,28,28]:[21,128,61]},
    {l:'Clients with Credit',v:nCredit+'',              c:[185,28,28]},
  ];
  boxes.forEach(function(b,i){
    var x=mg+i*53;
    doc.setFillColor(248,250,252);doc.rect(x,y,50,16,'F');
    doc.setFontSize(7);doc.setFont('helvetica','normal');doc.setTextColor(100,116,139);doc.text(b.l,x+2,y+7);
    doc.setFontSize(11);doc.setFont('helvetica','bold');doc.setTextColor.apply(doc,b.c);doc.text(b.v,x+2,y+14);
  });
  y+=22;
  doc.autoTable({
    startY:y, margin:{left:mg,right:mg},
    head:[['Client','GST','Phone','Total Sales (Rs.)','Paid (Rs.)','Outstanding (Rs.)','Last Challan','Oldest Debt','Last Asked','Risk']],
    body:cClients().map(function(cl){
      var s=clientStats(cl.id); var r=riskLevel(s.oldest,s.os);
      var laD=cl.lastAsked?daysOld(cl.lastAsked)+'d ago':'Never asked!';
      var advStr=s.advance>0?'Adv '+s.advance.toLocaleString('en-IN'):(s.os>0?s.os.toLocaleString('en-IN'):'Clear');
      return [
        cl.name, cl.gst||'—', cl.phone||'—',
        s.totalSales.toLocaleString('en-IN'),
        s.totalPaid.toLocaleString('en-IN'),
        advStr,
        fmtD(s.lastCh?.date),
        s.oldest>0?s.oldest+' days':'—',
        laD, r.label
      ];
    }),
    headStyles:{fillColor:[15,23,42],textColor:[255,255,255],fontSize:8,fontStyle:'bold',cellPadding:3},
    bodyStyles:{fontSize:8,cellPadding:2.5,textColor:[51,65,85]},
    alternateRowStyles:{fillColor:[248,250,252]},
    columnStyles:{3:{halign:'right'},4:{halign:'right',textColor:[21,128,61]},5:{halign:'right',textColor:[185,28,28],fontStyle:'bold'}}
  });
  pdfFooter(doc, true);
  doc.save('Clients-Summary-'+TODAY+'.pdf');
}

// ═══════════════════════════════════════════════
//  DATA MANAGEMENT
// ═══════════════════════════════════════════════
function exportData() {
  const json = JSON.stringify(APP, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'ChallanPro-Backup-' + TODAY + '.json';
  a.click(); URL.revokeObjectURL(url);
  toast('Backup exported successfully');
}

function exportExcel() {
  if (!window.XLSX) { alert('Excel library not loaded. Check your internet connection.'); return; }
  var wb = XLSX.utils.book_new();

  /* ── helper: create sheet from array-of-arrays, set col widths ── */
  function mkSheet(rows, colWidths) {
    var ws = XLSX.utils.aoa_to_sheet(rows);
    if (colWidths) ws['!cols'] = colWidths.map(function(w){ return {wch:w}; });
    return ws;
  }

  /* ── 1. SUMMARY ── */
  var sumRows = [
    ['ChallanPro — Full Data Export'],
    ['Exported on:', fmtD(TODAY)],
    [],
    ['Company','Total Challans','Total Sales (Rs.)','Total Collected (Rs.)','Outstanding (Rs.)','Total Clients','Total Products']
  ];
  APP.companies.forEach(function(co){
    var chs = APP.challans.filter(function(c){return c.companyId===co.id;});
    var cls = APP.clients.filter(function(c){return c.companyId===co.id;});
    var prs = APP.products.filter(function(p){return p.companyId===co.id;});
    var sales = chs.reduce(function(s,c){return s+(c.total||0);},0);
    var paid  = chs.reduce(function(s,c){return s+paidAmt(c);},0);
    sumRows.push([co.name, chs.length, sales, paid, sales-paid, cls.length, prs.length]);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(sumRows,[30,14,18,20,18,12,12]), 'Summary');

  /* ── 2. CHALLANS ── */
  var chRows = [['Company','DC No','Date','Client','Payment Mode','Total (Rs.)','Paid (Rs.)','Outstanding (Rs.)','Status','Vehicle No','Receiver','Notes']];
  APP.challans.forEach(function(ch){
    var co = APP.companies.find(function(c){return c.id===ch.companyId;})||{name:''};
    var cl = APP.clients.find(function(c){return c.id===ch.clientId;})||{name:''};
    var pa = paidAmt(ch);
    chRows.push([co.name, ch.billNo, fmtD(ch.date), cl.name,
      ch.mode, ch.total||0, pa, (ch.total||0)-pa,
      challanStatus(ch), ch.vehicleNo||'', ch.receiver||'', ch.notes||'']);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(chRows,[22,14,14,24,12,13,12,15,10,12,16,28]), 'Challans');

  /* ── 3. CHALLAN ITEMS ── */
  var itRows = [['Company','DC No','Date','Client','Item / Product','Size','Qty','Unit','Rate (Rs.)','Amount (Rs.)']];
  APP.challans.forEach(function(ch){
    var co = APP.companies.find(function(c){return c.id===ch.companyId;})||{name:''};
    var cl = APP.clients.find(function(c){return c.id===ch.clientId;})||{name:''};
    (ch.items||[]).forEach(function(it){
      itRows.push([co.name, ch.billNo, fmtD(ch.date), cl.name,
        it.name||'', it.size||'', it.qty||0, (it.unit==='charge'?'':it.unit||''), it.price||0, it.lt||0]);
    });
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(itRows,[22,14,14,24,28,10,8,8,13,14]), 'Challan Items');

  /* ── 4. PAYMENTS ── */
  var pyRows = [['Company','Date','Client','Amount (Rs.)','Mode','Notes']];
  APP.payments.forEach(function(p){
    var co = APP.companies.find(function(c){return c.id===p.companyId;})||{name:''};
    var cl = APP.clients.find(function(c){return c.id===p.clientId;})||{name:''};
    pyRows.push([co.name, fmtD(p.date), cl.name, p.amount||0, p.mode||'', p.notes||'']);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(pyRows,[22,14,24,14,10,28]), 'Payments');

  /* ── 5. CLIENTS ── */
  var clRows = [['Company','Name','Phone','Email','Address','GST','Risk Level','Total Sales (Rs.)','Total Paid (Rs.)','Outstanding (Rs.)','Oldest Pending (Days)','Last Asked']];
  APP.clients.forEach(function(cl){
    var co = APP.companies.find(function(c){return c.id===cl.companyId;})||{name:''};
    var chs = APP.challans.filter(function(c){return c.clientId===cl.id;});
    var sales = chs.reduce(function(s,c){return s+(c.total||0);},0);
    var paid  = chs.reduce(function(s,c){return s+paidAmt(c);},0);
    var pendingDates = chs.filter(function(c){return outstanding(c)>0;}).map(function(c){return daysOld(c.date);});
    var oldest = pendingDates.length ? Math.max.apply(null,pendingDates) : 0;
    clRows.push([co.name, cl.name, cl.phone||'', cl.email||'', cl.address||'',
      cl.gst||'', cl.risk||'low', sales, paid, sales-paid, oldest, cl.lastAsked||'']);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(clRows,[22,24,14,24,32,20,10,15,13,15,18,12]), 'Clients');

  /* ── 6. PRODUCTS ── */
  var prRows = [['Company','Product Name','Size','Unit','Default Rate (Rs.)','Description']];
  APP.products.forEach(function(p){
    var co = APP.companies.find(function(c){return c.id===p.companyId;})||{name:''};
    prRows.push([co.name, p.name||'', p.size||'', p.unit||'', p.price||0, p.desc||'']);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(prRows,[22,28,10,8,16,36]), 'Products');

  /* ── 7. COMPANIES ── */
  var coRows = [['Name','Phone','Email','Address','GST','Bank / Payment Details','Bill Prefix']];
  APP.companies.forEach(function(co){
    coRows.push([co.name||'', co.phone||'', co.email||'', co.address||'',
      co.gst||'', co.bank||'', co.billPrefix||'']);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(coRows,[30,14,28,40,20,40,12]), 'Companies');

  /* ── 8. AGING ANALYSIS ── */
  var agRows = [['Company','Client','Phone','Outstanding (Rs.)','0–30 Days (Rs.)','31–60 Days (Rs.)','61–90 Days (Rs.)','90+ Days (Rs.)','Risk Level','Oldest (Days)','Last Asked']];
  APP.clients.forEach(function(cl){
    var co = APP.companies.find(function(c){return c.id===cl.companyId;})||{name:''};
    var chs = APP.challans.filter(function(c){return c.clientId===cl.id&&c.mode==='credit';});
    var os  = chs.reduce(function(s,c){return s+outstanding(c);},0);
    if(os<=0) return; // skip cleared clients
    var bkts = agingBuckets(cl.id);
    var pendingDays = chs.filter(function(c){return outstanding(c)>0;}).map(function(c){return daysOld(c.date);});
    var oldest = pendingDays.length ? Math.max.apply(null,pendingDays) : 0;
    var risk = riskLevel(oldest, os);
    agRows.push([co.name, cl.name, cl.phone||'', os,
      bkts.b0, bkts.b31, bkts.b61, bkts.b90,
      risk.label, oldest, cl.lastAsked||'']);
  });
  XLSX.utils.book_append_sheet(wb, mkSheet(agRows,[22,24,14,16,16,16,16,14,10,12,12]), 'Aging Analysis');

  /* ── Save ── */
  XLSX.writeFile(wb, 'ChallanPro-Export-' + TODAY + '.xlsx');
  toast('Excel exported — 8 sheets ✓');
}
