import { config, currentStaff } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml } from '../utils/index.js';

function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }
function headers() { return { 'Content-Type': 'application/json', ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}) }; }
async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
  return body;
}

export async function renderReceivables() {
  const list = document.getElementById('b2bReceivablesList');
  if (!list || !config.chatId || !config.sessionToken) return;
  if (!hasPermission(currentStaff?.role || 'owner', 'b2b:ar:view')) {
    list.innerHTML = '<div class="empty">Accounts-receivable access is not available for this role.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Loading receivables…</div>';
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/receivables?limit=100`);
    const rows = data.receivables || [];
    if (!rows.length) { list.innerHTML = '<div class="empty">No receivables yet.</div>'; return; }
    list.innerHTML = rows.map(r => `<div class="table-card account-card"><div class="account-name">${escapeHtml(r.status)} · ${escapeHtml(r.currency)} ${Number(r.outstandingMinor).toLocaleString()} outstanding</div><div class="account-contact">Customer ${escapeHtml(r.customerId)} · Due ${escapeHtml(new Date(r.dueAt).toLocaleDateString())}</div><div class="account-notes">${escapeHtml(r.sourceType)} ${escapeHtml(r.sourceId)} · Original ${Number(r.amountMinor).toLocaleString()}</div></div>`).join('');
  } catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Could not load receivables.')}</div>`; }
}

export async function createReceivableFromUI() {
  if (!hasPermission(currentStaff?.role || '', 'b2b:ar:create')) return;
  const sourceId = document.getElementById('b2bArSourceId')?.value.trim() || '';
  const sourceType = document.getElementById('b2bArSourceType')?.value || 'purchase_order';
  if (!sourceId) return;
  await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/receivables`, { method: 'POST', body: JSON.stringify({ sourceType, sourceId, notes: document.getElementById('b2bArNotes')?.value || '' }) });
  await renderReceivables();
}

export function bindReceivableUI() {
  const refresh = document.getElementById('b2bArRefresh');
  const create = document.getElementById('b2bArCreate');
  const list = document.getElementById('b2bReceivablesList');
  if (refresh) refresh.addEventListener('click', () => renderReceivables());
  if (create) create.addEventListener('click', () => createReceivableFromUI().catch(error => list?.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Receivable creation failed.')}</div>`)));
}
