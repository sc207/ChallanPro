const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
let css = styleMatch ? styleMatch[1] : '';

// Responsive fixes
css = css.replace(/table\{min-width:700px\}/, '/* removed global table min-width */');
css += `
@media (max-width:767px){
  .challan-table-wrap{display:none!important}
  .challan-cards{display:flex!important;flex-direction:column;gap:10px}
  .data-card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px}
  .data-card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
  .data-card-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
  .topbar-actions .btn-text{display:none}
  .topbar-actions .btn-icon-only{padding:8px 12px}
  .filter-bar{flex-direction:column!important}
  .filter-bar .inp,.filter-bar select{width:100%!important}
  .prow{grid-template-columns:1fr!important}
  @media(max-width:768px){.cp-sheet{min-height:auto;aspect-ratio:118/168;max-height:70vh}}
}
.challan-cards{display:none}
:root{--co-primary:#0f172a;--co-secondary:#1d4ed8}
`;

fs.writeFileSync(path.join(__dirname, '../public/css/app.css'), css);

const printCss = `
@media print{.sidebar,.topbar,.no-print,#bottom-nav{display:none!important}.main{margin-left:0;padding-bottom:0!important}.print-head{display:block!important}}
.print-head{display:none}
@media print{
  @page{size:A5 portrait;margin:0}
  body>*:not(#cp-ov){display:none!important}
  #cp-ov{position:fixed!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;background:none!important;padding:0!important}
  .cp-bar,.cp-hint{display:none!important}
  .cp-sheet{width:118mm!important;height:168mm!important;min-height:0!important;max-width:none!important;box-shadow:none!important;margin:auto!important;font-size:80%;overflow:hidden!important}
  .cph-addr-bar{background:var(--co-primary)!important;color:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
`;
fs.writeFileSync(path.join(__dirname, '../public/css/print.css'), printCss);

let body = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/print.css">');
body = body.replace('</head>', '<script src="/js/api.js"></script><script src="/js/branding.js"></script><script src="/js/data.js"></script></head>');

// Remove SEED and old loadStore - will use data.js
body = body.replace(/const SEED = \{[\s\S]*?\};\n\n/, '');
body = body.replace(/let APP;\nfunction loadStore\(\)[\s\S]*?function saveStore\(\)[^\n]+\n/, '');

// Branding fixes in script
body = body.replace(
  "'<div class=\"cph-type\">Textile Merchant</div>'+",
  "'<div class=\"cph-type\">'+esc(co.tagline||'')+'</div>'+"
);
body = body.replace(
  "'<div class=\"cph-circle\">'+esc(initials)+'</div>'+",
  "renderCompanyLogo(co,50)+"
);
body = body.replace(
  /var co=getActiveCompany\(\);\s*el\('cp-sheet'\)/,
  "var co=getCompanyForChallan(ch);\n  el('cp-sheet')"
);
body = body.replace(
  /function pdfHeader\(doc, subtitle, landscape\) \{\s*var W = landscape \? 297 : 210, co = getActiveCompany\(\);/,
  'function pdfHeader(doc, subtitle, landscape, company) {\n  var W = landscape ? 297 : 210, co = company || getActiveCompany();\n  var rgb = hexToRgb(co.primaryColor||\'#0f172a\');'
);
body = body.replace(
  /doc\.setFillColor\(15, 23, 42\);/,
  'doc.setFillColor(rgb[0], rgb[1], rgb[2]);'
);
body = body.replace(
  /function pdfFooter\(doc, landscape\) \{\s*var W = landscape \? 297 : 210;\s*var co = getActiveCompany\(\)/,
  'function pdfFooter(doc, landscape, company) {\n  var W = landscape ? 297 : 210;\n  var co = company || getActiveCompany()'
);
body = body.replace(
  /co\.proprietor \? co\.proprietor \+ ' — Authorised Signatory'/,
  "(co.authorizedSignatory||co.proprietor) ? (co.authorizedSignatory||co.proprietor) + ' — Authorised Signatory'"
);

// Init with async loadStore
body = body.replace(
  /document\.addEventListener\('DOMContentLoaded',function\(\)\{\s*loadStore\(\);/,
  "document.addEventListener('DOMContentLoaded',async function(){\n  if(!await checkAuth())return;\n  await loadStore();"
);

// Company switch
body = body.replace(
  /function switchCompany\(id\) \{[\s\S]*?toast\('Switched to '[^;]+;\s*\}/,
  'function switchCompany(id) { doSwitchCompany(id); }'
);

// Activity feed on dashboard
body = body.replace(
  /renderAgingBarChart\(\);\s*\}/,
  "renderAgingBarChart();\n  if (typeof renderActivityFeed === 'function') renderActivityFeed();\n}"
);

// Admin init
body = body.replace(
  /renderPayments\(\);\s*nav\('dashboard'\);/,
  "renderPayments();\n  setupAdminUI();\n  if (CURRENT_USER?.role === 'admin') { const bnUsers = el('bn-users'); if (bnUsers) bnUsers.style.display = ''; }\n  nav('dashboard');"
);

// API patches + admin UI load after main script
if (!body.includes('/js/patches.js')) {
  body = body.replace(
    /<\/script>\s*<!-- ═══ DELIVERY CHALLAN/,
    '</script>\n<script src="/js/patches.js"></script>\n<script src="/js/admin.js"></script>\n<!-- ═══ DELIVERY CHALLAN'
  );
}

fs.writeFileSync(path.join(__dirname, '../public/index.html'), body);
console.log('Built public/index.html');
