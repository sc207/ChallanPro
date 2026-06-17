// Admin UI — user management, activity feed, admin-only nav

function setupAdminUI() {
  const isAdmin = CURRENT_USER && CURRENT_USER.role === 'admin';
  const navUsers = document.getElementById('nav-users');
  const pageUsers = document.getElementById('page-users');

  const badge = document.getElementById('user-role-badge');
  if (badge && CURRENT_USER) {
    badge.textContent = CURRENT_USER.email + ' (' + CURRENT_USER.role + ')';
    badge.style.display = 'block';
  }

  if (!isAdmin) {
    if (navUsers) navUsers.style.display = 'none';
    if (pageUsers) pageUsers.remove();
    ['nav-companies'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.querySelectorAll('.admin-only').forEach(el => { el.style.display = 'none'; });
    return;
  }

  if (navUsers) navUsers.style.display = '';
}

async function renderActivityFeed() {
  const box = document.getElementById('d-activity');
  if (!box) return;
  try {
    const items = await loadActivity();
    if (!items.length) {
      box.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px 0">No recent activity</div>';
      return;
    }
    const grouped = {};
    items.forEach(it => {
      const day = (it.createdAt || '').slice(0, 10) || 'Recent';
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(it);
    });
    let html = '';
    Object.keys(grouped).sort().reverse().slice(0, 3).forEach(day => {
      const label = day === TODAY ? 'Today' : fmtD(day);
      html += '<div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin:10px 0 6px">' + label + '</div>';
      grouped[day].forEach(it => {
        html += '<div style="padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px;display:flex;gap:8px">' +
          '<i class="fas fa-circle" style="color:#60a5fa;font-size:6px;margin-top:6px"></i>' +
          '<span>' + esc(it.message) + '</span></div>';
      });
    });
    box.innerHTML = html;
  } catch (_) {
    box.innerHTML = '<div style="color:#94a3b8;font-size:12px">Activity unavailable</div>';
  }
}

async function renderUsers() {
  if (CURRENT_USER?.role !== 'admin') {
    toast('Admin access required', 't-del');
    nav('dashboard');
    return;
  }
  try {
    const users = await API.get('/users');
    const active = users.filter(u => u.active);
    const inactive = users.filter(u => !u.active);

    el('u-stats').innerHTML =
      '<div class="stat-card"><div class="icon-box" style="background:#dbeafe"><i class="fas fa-users" style="color:#1d4ed8"></i></div><div><div class="stat-label">Total Users</div><div class="stat-val">' + users.length + '</div></div></div>' +
      '<div class="stat-card"><div class="icon-box" style="background:#dcfce7"><i class="fas fa-user-shield" style="color:#15803d"></i></div><div><div class="stat-label">Admins</div><div class="stat-val">' + users.filter(u => u.role === 'admin' && u.active).length + '</div></div></div>' +
      '<div class="stat-card"><div class="icon-box" style="background:#ede9fe"><i class="fas fa-user" style="color:#6d28d9"></i></div><div><div class="stat-label">Staff</div><div class="stat-val">' + users.filter(u => u.role === 'staff' && u.active).length + '</div></div></div>';

    function userRow(u) {
      const status = u.active
        ? '<span class="badge badge-paid">Active</span>'
        : '<span class="badge badge-pending">Inactive</span>';
      const roleBadge = u.role === 'admin'
        ? '<span class="badge" style="background:#dbeafe;color:#1d4ed8">Admin</span>'
        : '<span class="badge" style="background:#f1f5f9;color:#475569">Staff</span>';
      const actions = u.id === CURRENT_USER.id
        ? '<span style="color:#94a3b8;font-size:12px">You</span>'
        : u.active
          ? '<button class="btn btn-danger btn-sm" onclick="deactivateUser(' + u.id + ',\'' + esc(u.email) + '\')"><i class="fas fa-ban"></i></button>'
          : '<button class="btn btn-success btn-sm" onclick="reactivateUser(' + u.id + ')"><i class="fas fa-check"></i> Restore</button>';
      return '<tr><td><strong>' + esc(u.email) + '</strong></td><td>' + roleBadge + '</td><td>' + status + '</td>' +
        '<td style="color:#64748b;font-size:12px">' + fmtD((u.created_at || '').slice(0, 10)) + '</td><td>' + actions + '</td></tr>';
    }

    el('u-list').innerHTML =
      '<table><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody>' +
      active.map(userRow).join('') +
      (inactive.length ? inactive.map(userRow).join('') : '') +
      '</tbody></table>';

    if (inactive.length) {
      el('u-inactive-note').textContent = inactive.length + ' inactive user(s) shown below active users.';
      el('u-inactive-note').style.display = 'block';
    } else {
      el('u-inactive-note').style.display = 'none';
    }
  } catch (e) {
    toast('Failed to load users: ' + e.message, 't-del');
  }
}

function openAddUserModal() {
  const html =
    '<div class="form-row"><label>Email address *</label><input class="inp" id="nu-email" type="email" placeholder="staff@company.com"></div>' +
    '<div class="form-row"><label>Role</label><select class="inp" id="nu-role">' +
    '<option value="staff">Staff — can manage challans, clients, payments</option>' +
    '<option value="admin">Admin — full access including users & companies</option>' +
    '</select></div>' +
    '<div style="background:#f8fafc;border-radius:8px;padding:10px;font-size:12px;color:#64748b;margin-top:8px">' +
    '<i class="fas fa-info-circle" style="margin-right:5px"></i>User will receive OTP via email when logging in. No password needed.</div>';
  openModal('Add User', html, saveNewUser);
}

async function saveNewUser() {
  const email = el('nu-email').value.trim().toLowerCase();
  const role = el('nu-role').value;
  if (!email) { alert('Email is required'); return; }
  try {
    await API.post('/users', { email, role });
    closeModal();
    toast('User added — they can now login with OTP');
    renderUsers();
  } catch (e) {
    alert(e.message);
  }
}

async function deactivateUser(id, email) {
  if (!confirm('Deactivate ' + email + '? They will no longer be able to login.')) return;
  try {
    await API.del('/users/' + id);
    toast('User deactivated', 't-info');
    renderUsers();
  } catch (e) {
    toast(e.message, 't-del');
  }
}

async function reactivateUser(id) {
  try {
    await API.put('/users/' + id + '/activate', {});
    toast('User reactivated');
    renderUsers();
  } catch (e) {
    toast(e.message, 't-del');
  }
}

function downloadAllData() {
  window.location.href = '/api/backup/export';
}

async function wipeAllData() {
  const confirmed = confirm(
    'Are you sure you want to DELETE ALL DATA?\n\n' +
    'This will permanently remove:\n' +
    '  • All challans\n' +
    '  • All payments\n' +
    '  • All clients\n' +
    '  • All products\n' +
    '  • All audit logs\n\n' +
    'Companies, users and DC series configuration will be kept.\n\n' +
    'This action CANNOT be undone.'
  );
  if (!confirmed) return;

  const typed = prompt('Type  DELETE ALL  to confirm:');
  if ((typed || '').trim() !== 'DELETE ALL') {
    toast('Wipe cancelled', 't-info');
    return;
  }

  try {
    await API.del('/backup/wipe');
    toast('All data wiped successfully');
    await loadCompanyData(APP.activeCompanyId);
    nav('dashboard');
  } catch (e) {
    toast('Wipe failed: ' + e.message, 't-del');
  }
}
