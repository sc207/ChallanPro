/* ═══════════════ THEME · SIDEBAR COLLAPSE · KEYBOARD SHORTCUTS ═══════════════ */
function applyThemeIcon(){var dark=document.documentElement.getAttribute('data-theme')==='dark';var b=document.getElementById('theme-toggle');if(b)b.innerHTML='<i class="fas fa-'+(dark?'sun':'moon')+'"></i>';}
function toggleTheme(){var dark=document.documentElement.getAttribute('data-theme')==='dark';if(dark){document.documentElement.removeAttribute('data-theme');}else{document.documentElement.setAttribute('data-theme','dark');}try{localStorage.setItem('cp-theme',dark?'light':'dark');}catch(e){}applyThemeIcon();}
function toggleSidebarCollapse(){document.body.classList.toggle('sidebar-collapsed');try{localStorage.setItem('cp-sidebar',document.body.classList.contains('sidebar-collapsed')?'1':'');}catch(e){}}
function applyPrivacyIcon(){var on=document.documentElement.classList.contains('privacy-on');var b=document.getElementById('privacy-toggle');if(b){b.innerHTML='<i class="fas fa-'+(on?'eye-slash':'eye')+'"></i>';b.style.color=on?'#1d4ed8':'';}}
function togglePrivacy(){var on=document.documentElement.classList.toggle('privacy-on');try{localStorage.setItem('cp-privacy',on?'1':'');}catch(e){}applyPrivacyIcon();if(typeof toast==='function')toast(on?'Privacy on — amounts hidden':'Privacy off','t-info');}
var SHORTCUTS=[
  {k:'N',d:'New challan'},{k:'P',d:'Record payment (in)'},{k:'U',d:'New purchase'},
  {k:'G then D',d:'Go to Dashboard'},{k:'G then C',d:'Go to Challans'},{k:'G then K',d:'Go to Customers'},
  {k:'G then R',d:'Go to Purchases'},{k:'G then S',d:'Go to Suppliers'},{k:'G then A',d:'Go to Payables Aging'},
  {k:'T',d:'Toggle dark / light mode'},{k:'H',d:'Privacy mode (blur amounts)'},{k:'\\',d:'Collapse / expand sidebar'},
  {k:'?',d:'Show this shortcuts help'},{k:'Esc',d:'Close dialog'}
];
function openShortcutsHelp(){
  var body='<div style="font-size:12px;color:var(--muted);margin-bottom:10px">Shortcuts work when you are not typing in a field. Press <span class="kbd">G</span> then a letter to navigate.</div>'+
    SHORTCUTS.map(function(s){return '<div class="sc-row"><span class="sc-desc">'+s.d+'</span><span class="kbd">'+s.k+'</span></div>';}).join('');
  openModal('Keyboard Shortcuts', body, null, false);
  var f=el('modal-foot'); if(f) f.innerHTML='<button class="btn btn-ghost" onclick="closeModal()">Close</button>';
}
(function(){
  var lastG=0;
  document.addEventListener('keydown', function(e){
    var t=((e.target&&e.target.tagName)||'').toLowerCase();
    var typing=t==='input'||t==='textarea'||t==='select'||(e.target&&e.target.isContentEditable);
    if(e.key==='Escape'){ if(typing&&e.target.blur){e.target.blur();} else if(typeof closeModal==='function'){closeModal();} return; }
    if(typing||e.ctrlKey||e.metaKey||e.altKey) return;
    var now=Date.now();
    if(now-lastG<800){ lastG=0;
      var map={d:'dashboard',c:'challans',k:'customers',r:'purchases',s:'suppliers',a:'payables-aging',u:'upi',p:'payments'};
      var dest=map[(e.key||'').toLowerCase()];
      if(dest&&typeof nav==='function'){ e.preventDefault(); nav(dest); }
      return;
    }
    switch(e.key){
      case 'g': case 'G': lastG=now; break;
      case '?': e.preventDefault(); openShortcutsHelp(); break;
      case 'n': case 'N': if(typeof openChallanModal==='function'){e.preventDefault();openChallanModal();} break;
      case 'p': case 'P': if(typeof openQuickPaymentModal==='function'){e.preventDefault();openQuickPaymentModal();} break;
      case 'u': case 'U': if(typeof openPurchaseModal==='function'){e.preventDefault();openPurchaseModal();} break;
      case 't': case 'T': toggleTheme(); break;
      case 'h': case 'H': togglePrivacy(); break;
      case '\\': e.preventDefault(); toggleSidebarCollapse(); break;
    }
  });
  document.addEventListener('DOMContentLoaded', function(){
    try{ if(localStorage.getItem('cp-sidebar')==='1' && window.innerWidth>768) document.body.classList.add('sidebar-collapsed'); }catch(e){}
    applyThemeIcon();
    applyPrivacyIcon();
  });
})();

/* ═══════════════ HEADER SPLIT DROPDOWNS (Payment In/Out, New Challan/Purchase) ═══════════════ */
function closeHdrDd(){ document.querySelectorAll('.hdr-dd-menu.open').forEach(function(m){ m.classList.remove('open'); }); }
function toggleHdrDd(e, btn){
  e.stopPropagation();
  var menu = btn.parentNode.querySelector('.hdr-dd-menu');
  var willOpen = menu && !menu.classList.contains('open');
  closeHdrDd();
  if(willOpen) menu.classList.add('open');
}
document.addEventListener('click', closeHdrDd);
