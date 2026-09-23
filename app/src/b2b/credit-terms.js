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

export async function renderCreditTerms() {
  const list = document.getElementById('b2bCreditTermsList');
  if (!list || !config.chatId || !config.sessionToken) return;
  if (!hasPermission(currentStaff?.role || 'owner', 'b2b:credit:view')) {
    list.innerHTML = '<div class="empty">Credit-term access is not available for this role.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Loading credit terms…</div>';
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/credit-terms?limit=100`);
    const terms = data.creditTerms || [];
    if (!terms.length) { list.innerHTML = '<div class="empty">No credit terms yet.</div>'; return; }
    list.innerHTML = terms.map(t => {
      const approval = t.status === 'PENDING' && hasPermission(currentStaff?.role || '', 'b2b:credit:approve')
        ? `<div class="table-actions"><button type="button" data-credit-action="approve" data-credit-id="${escapeHtml(t.id)}">Approve</button><button type="button" class="table-remove" data-credit-action="reject" data-credit-id="${escapeHtml(t.id)}">Reject</button></div>` : '';
      const suspend = t.status === 'APPROVED' && hasPermission(currentStaff?.role || '', 'b2b:credit:approve')
        ? `<button type="button" data-credit-action="suspend" data-credit-id="${escapeHtml(t.id)}">Suspend</button>` : '';
      return `<div class="table-card account-card"><div class="account-name">${escapeHtml(t.status)} · ${escapeHtml(t.currency)} ${Number(t.creditLimitMinor).toLocaleString()}</div><div class="account-contact">Customer ${escapeHtml(t.customerId)} · Net ${Number(t.paymentDueDays)} days</div><div class="account-notes">${t.requiresPo ? 'PO required' : 'PO not required'}${t.reason ? ` · ${escapeHtml(t.reason)}` : ''}</div>${approval}${suspend ? `<div class="table-actions">${suspend}</div>` : ''}</div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Could not load credit terms.')}</div>`;
  }
}

export async function createCreditTermsFromUI() {
  if (!hasPermission(currentStaff?.role || '', 'b2b:credit:create')) return;
  const customerId = document.getElementById('b2bCreditCustomer')?.value || '';
  const limit = Number(document.getElementById('b2bCreditLimit')?.value || 0);
  const days = Number(document.getElementById('b2bCreditDays')?.value || 0);
  if (!customerId || !Number.isInteger(limit) || limit < 0 || !Number.isInteger(days) || days < 0 || days > 365) return;
  await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/credit-terms`, { method: 'POST', body: JSON.stringify({ customerId, creditLimitMinor: limit, paymentDueDays: days, requiresPo: document.getElementById('b2bCreditRequiresPo')?.checked !== false }) });
  await renderCreditTerms();
}

export async function loadBusinessCreditCustomers() {
  const select = document.getElementById('b2bCreditCustomer');
  if (!select || !config.chatId || !config.sessionToken) return;
  if (!hasPermission(currentStaff?.role || 'owner', 'b2b:credit:create')) return;
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/customers?status=active&limit=200`);
    const customers = (data.customers || []).filter(c => String(c.customerType || '').toLowerCase() === 'business');
    select.innerHTML = '<option value="">Select business customer…</option>' + customers.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('');
  } catch { /* existing page remains usable if customer loading fails */ }
}

export function bindCreditTermsUI() {
  const refresh = document.getElementById('b2bCreditRefresh');
  const create = document.getElementById('b2bCreditCreate');
  const list = document.getElementById('b2bCreditTermsList');
  if (refresh) refresh.addEventListener('click', () => renderCreditTerms());
  if (create) create.addEventListener('click', () => createCreditTermsFromUI().catch(error => list?.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Credit-term creation failed.')}</div>`)));
  if (list) list.addEventListener('click', async event => {
    const button = event.target.closest('[data-credit-action]');
    if (!button || !hasPermission(currentStaff?.role || '', 'b2b:credit:approve')) return;
    const action = button.dataset.creditAction;
    const status = action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'SUSPENDED';
    try {
      await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/credit-terms/${encodeURIComponent(button.dataset.creditId)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await renderCreditTerms();
    } catch (error) {
      list.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Credit-term update failed.')}</div>`);
    }
  });
  loadBusinessCreditCustomers();
}
