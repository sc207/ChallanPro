const { run } = require('../db/connection');

async function logAudit({ userId, userEmail, action, entityType, entityId, companyId, details = {} }) {
  try {
    await run(
      `INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, company_id, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId || null, userEmail || '', action, entityType || '', entityId || '', companyId || null, JSON.stringify(details)]
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

function formatActivity(row) {
  const labels = {
    CREATE: 'Created', UPDATE: 'Updated', DELETE: 'Deleted',
    SOFT_DELETE: 'Deleted', CONFIRM: 'Confirmed', CANCEL: 'Cancelled',
    LOGIN: 'Logged in', LOGOUT: 'Logged out', IMPORT_DATA: 'Imported data',
    EXPORT_DATA: 'Exported data',
  };
  const entities = {
    client: 'Client', product: 'Product', challan: 'Challan',
    payment: 'Payment', company: 'Company', user: 'User',
  };
  const action = labels[row.action] || row.action;
  const entity = entities[row.entity_type] || row.entity_type || 'record';
  let detail = '';
  try {
    const d = JSON.parse(row.details_json || '{}');
    if (d.name) detail = d.name;
    else if (d.billNo) detail = '#' + d.billNo;
    else if (d.bill_no) detail = '#' + d.bill_no;
  } catch (_) {}
  return {
    id: row.id,
    userEmail: row.user_email,
    message: `${row.user_email || 'System'} — ${action} ${entity}${detail ? ' ' + detail : ''}`,
    createdAt: row.created_at,
  };
}

module.exports = { logAudit, formatActivity };
