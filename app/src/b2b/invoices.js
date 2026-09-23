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

export async function renderInvoices() {
  const list = document.getElementById('b2bInvoicesList');
  if (!list || !config.chatId || !config.sessionToken) return;
  if (!hasPermission(currentStaff?.role || 'owner', 'b2b:invoice:view')) {
    list.innerHTML = '<div class="empty">Invoice access is not available for this role.</div>'; return;
  }
  list.innerHTML = '<div class="empty">Loading invoices…</div>';
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/invoices?limit=100`);
    const rows = data.invoices || [];
    if (!rows.length) { list.innerHTML = '<div class="empty">No invoices yet.</div>'; return; }
    list.innerHTML = rows.map(i => {
      const actions = i.status === 'DRAFT' && hasPermission(currentStaff?.role || '', 'b2b:invoice:manage')
        ? `<button class="table-edit" data-invoice-issue="${escapeHtml(i.id)}">Issue</button>` : '';
      return `<div class="table-card account-card"><div class="account-name">${escapeHtml(i.invoiceNumber)} · ${escapeHtml(i.status)}</div><div class="account-contact">${escapeHtml(i.currency)} ${Number(i.totalMinor).toLocaleString()} · Customer ${escapeHtml(i.customerId)}</div><div class="account-notes">Due ${escapeHtml(new Date(i.dueAt).toLocaleDateString())} · AR ${escapeHtml(i.receivableId)}</div><div class="table-actions">${actions}</div></div>`;
    }).join('');
    list.querySelectorAll('[data-invoice-issue]').forEach(btn => btn.addEventListener('click', async () => {
      if (!hasPermission(currentStaff?.role || '', 'b2b:invoice:manage')) return;
      try { await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/invoices/${encodeURIComponent(btn.dataset.invoiceIssue)}`, { method: 'PATCH', body: JSON.stringify({ status: 'ISSUED' }) }); await renderInvoices(); }
      catch (e) { list.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(e.message || 'Invoice update failed.')}</div>`); }
    }));
  } catch (error) { list.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Could not load invoices.')}</div>`; }
}

export async function createInvoiceFromUI() {
  if (!hasPermission(currentStaff?.role || '', 'b2b:invoice:create')) return;
  const receivableId = document.getElementById('b2bInvoiceReceivableId')?.value.trim() || '';
  if (!receivableId) return;
  await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/invoices`, { method: 'POST', body: JSON.stringify({ receivableId, notes: document.getElementById('b2bInvoiceNotes')?.value || '' }) });
  await renderInvoices();
}

export function bindInvoiceUI() {
  const refresh = document.getElementById('b2bInvoiceRefresh');
  const create = document.getElementById('b2bInvoiceCreate');
  const list = document.getElementById('b2bInvoicesList');
  refresh?.addEventListener('click', () => renderInvoices());
  create?.addEventListener('click', () => createInvoiceFromUI().catch(error => list?.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Invoice creation failed.')}</div>`)));
}
