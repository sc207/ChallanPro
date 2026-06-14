function getCompanyById(id) {
  return APP.companies.find(c => c.id === id) || getActiveCompany();
}

function getCompanyForChallan(ch) {
  return getCompanyById(ch.companyId || APP.activeCompanyId);
}

function companyInitials(name) {
  const words = (name || '').replace(/pvt\.?|ltd\.?|private|limited/gi, '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || 'CO';
}

function formatCompanyAddress(co) {
  return [co.address, co.city, co.state, co.pincode].filter(Boolean).join(', ');
}

function renderCompanyLogo(co, sizePx) {
  const logo = co.logoPath || co.logo || '';
  if (logo) {
    return '<img src="' + esc(logo) + '" alt="' + esc(co.name) + '" class="co-logo" style="width:' + sizePx + 'px;height:' + sizePx + 'px;object-fit:contain">';
  }
  return '<div class="cph-circle" style="width:' + sizePx + 'px;height:' + sizePx + 'px">' + esc(companyInitials(co.name)) + '</div>';
}

function applyCompanyTheme(co) {
  if (!co) return;
  const primary = co.primaryColor || '#0f172a';
  const secondary = co.secondaryColor || '#1d4ed8';
  document.documentElement.style.setProperty('--co-primary', primary);
  document.documentElement.style.setProperty('--co-secondary', secondary);
  const swName = document.getElementById('co-sw-name');
  if (swName) swName.textContent = co.name;
  const topLogo = document.getElementById('top-co-logo');
  if (topLogo) {
    const logo = co.logoPath || co.logo || '';
    topLogo.innerHTML = logo
      ? '<img src="' + esc(logo) + '" style="height:28px;object-fit:contain">'
      : '<span style="font-weight:800;color:#1d4ed8">' + esc(companyInitials(co.name)) + '</span>';
  }
}

function hexToRgb(hex) {
  const h = (hex || '#0f172a').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
