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

export async function renderPurchaseOrders() {
  const list = document.getElementById('b2bPurchaseOrdersList');
  if (!list || !config.chatId || !config.sessionToken) return;
  if (!hasPermission(currentStaff?.role || 'owner', 'b2b:po:view')) {
    list.innerHTML = '<div class="empty">Purchase-order access is not available for this role.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Loading purchase orders…</div>';
  try {
    const data = await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/purchase-orders?limit=100`);
    const orders = data.purchaseOrders || [];
    if (!orders.length) { list.innerHTML = '<div class="empty">No purchase orders yet.</div>'; return; }
    list.innerHTML = orders.map(po => {
      const approval = po.status === 'SUBMITTED' && hasPermission(currentStaff?.role || '', 'b2b:po:approve')
        ? `<div class="table-actions"><button type="button" data-po-action="approve" data-po-id="${escapeHtml(po.id)}">Approve</button><button type="button" class="table-remove" data-po-action="reject" data-po-id="${escapeHtml(po.id)}">Reject</button></div>` : '';
      return `<div class="table-card account-card"><div class="account-name">${escapeHtml(po.poNumber)} · ${escapeHtml(po.status)}</div><div class="account-contact">${escapeHtml(po.buyerReference || 'No buyer reference')} · ${escapeHtml(po.currency)} ${Number(po.totalMinor).toLocaleString()}</div><div class="account-notes">Quote ${escapeHtml(po.quoteId)}</div>${approval}</div>`;
    }).join('');
  } catch (error) {
    list.innerHTML = `<div class="empty">${escapeHtml(error.message || 'Could not load purchase orders.')}</div>`;
  }
}

export async function transitionPurchaseOrderFromUI(poId, status) {
  if (!hasPermission(currentStaff?.role || '', status === 'APPROVED' || status === 'REJECTED' ? 'b2b:po:approve' : 'b2b:po:create')) return;
  await request(`/tenants/${encodeURIComponent(config.chatId)}/b2b/purchase-orders/${encodeURIComponent(poId)}`, {
    method: 'PATCH', body: JSON.stringify({ status }),
  });
  await renderPurchaseOrders();
}

export function bindPurchaseOrderUI() {
  const list = document.getElementById('b2bPurchaseOrdersList');
  const refresh = document.getElementById('b2bPoRefresh');
  if (refresh) refresh.addEventListener('click', () => renderPurchaseOrders());
  if (list) list.addEventListener('click', async event => {
    const button = event.target.closest('[data-po-action]');
    if (!button) return;
    try {
      await transitionPurchaseOrderFromUI(button.dataset.poId, button.dataset.poAction === 'approve' ? 'APPROVED' : 'REJECTED');
    } catch (error) {
      list.insertAdjacentHTML('afterbegin', `<div class="empty">${escapeHtml(error.message || 'Purchase-order update failed.')}</div>`);
    }
  });
}
