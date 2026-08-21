/* ═══════════════ ADMIN — ACTIVE SESSIONS ═══════════════ */
function _deviceLabel(ua){
  ua = ua || '';
  var os = /Windows/i.test(ua)?'Windows' : /Android/i.test(ua)?'Android' : /iPhone|iPad|iOS/i.test(ua)?'iOS' : /Mac OS X|Macintosh/i.test(ua)?'macOS' : /Linux/i.test(ua)?'Linux' : 'Unknown OS';
  var br = /Edg\//i.test(ua)?'Edge' : /OPR\/|Opera/i.test(ua)?'Opera' : /Chrome\//i.test(ua)?'Chrome' : /Firefox\//i.test(ua)?'Firefox' : /Safari\//i.test(ua)?'Safari' : 'Browser';
  return br + ' · ' + os;
}
async function renderSessions(){
  if (!(CURRENT_USER && CURRENT_USER.role === 'admin')) return;
  var tb = el('t-sessions'); if(!tb) return;
  tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:18px">Loading…</td></tr>';
  try{
    var rows = await API.get('/sessions');
    tb.innerHTML = rows.length ? rows.map(function(s){
      return '<tr>'+
        '<td><i class="fas fa-desktop" style="color:#64748b;margin-right:6px"></i>'+_deviceLabel(s.userAgent)+(s.current?' <span class="badge badge-cash" style="font-size:10px">THIS DEVICE</span>':'')+'</td>'+
        '<td>'+(s.userEmail||'—')+'</td>'+
        '<td style="color:var(--muted)">'+(s.ip||'—')+'</td>'+
        '<td style="color:var(--muted)">'+fmtD(s.createdAt)+'</td>'+
        '<td style="color:var(--muted)">'+(s.lastSeen?fmtD(s.lastSeen):'—')+'</td>'+
        '<td>'+(s.current?'':'<button class="btn btn-danger btn-sm" onclick="revokeSession(\''+s.id+'\')" title="Sign out this device"><i class="fas fa-power-off"></i></button>')+'</td>'+
      '</tr>';
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:18px">No active sessions.</td></tr>';
  }catch(e){
    tb.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#b91c1c;padding:18px">'+(e.message||'Failed to load sessions')+'</td></tr>';
  }
}
async function revokeSession(id){
  if(!confirm('Sign this device out?')) return;
  try{ await API.del('/sessions/'+id); toast('Device signed out','t-del'); renderSessions(); }
  catch(e){ toast(e.message||'Failed','t-del'); }
}
async function terminateOtherSessions(){
  if(!confirm('Sign out ALL other devices? You will stay logged in on this device.')) return;
  try{ await API.del('/sessions'); toast('All other devices signed out','t-del'); renderSessions(); }
  catch(e){ toast(e.message||'Failed','t-del'); }
}
