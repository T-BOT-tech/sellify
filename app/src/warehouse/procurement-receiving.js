// P0-03 — Procurement → Warehouse receiving surface.
// UI only: Procurement remains receipt authority; Inventory remains physical stock authority.
import { config, currentStaff, organizationLocations } from '../state.js';
import { hasPermission } from '../auth/permissions.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';
import { UI_STATES } from '../experience/state-contract.js';
import { enqueueCommand, flushCommandOutbox, getPendingCommands, getFailedCommands, retryCommand } from '../sync/outbox.js';

function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }
function role() { return currentStaff?.role || 'owner'; }
function can(permission) { return hasPermission(role(), permission); }
async function request(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `Request failed (${res.status})`);
  return body;
}

function activeLocations() {
  return organizationLocations.filter(l => l.status === 'active');
}

const RECEIPT_COMMAND = 'procurement.receipt.create';
function queuedReceipts() { return getPendingCommands(RECEIPT_COMMAND); }
function failedReceipts() { return getFailedCommands(RECEIPT_COMMAND); }

function locationOptions(selected) {
  const locations = activeLocations();
  return locations.length
    ? locations.map(l => `<option value="${escapeAttr(l.id)}" ${String(l.id) === String(selected || config.locationId || '') ? 'selected' : ''}>${escapeHtml(l.name)} · ${escapeHtml(l.type)}</option>`).join('')
    : '<option value="">No active receiving location</option>';
}

function receiveForm(po) {
  const lines = Array.isArray(po.items) ? po.items : [];
  return `
    <div class="p0-receive-form" data-po-id="${escapeAttr(po.id)}">
      <div class="form-grid">
        <select data-receive-location aria-label="Receiving location">${locationOptions(config.locationId)}</select>
      </div>
      <div class="p0-receive-lines">
        ${lines.map(item => `
          <label class="p0-receive-line">
            <span>${escapeHtml(item.description || item.productId)} · ordered ${Number(item.quantity)}</span>
            <input data-po-item="${escapeAttr(item.id)}" type="number" min="0" max="${Number(item.quantity)}" step="1" value="${Number(item.quantity)}" aria-label="Receive ${escapeAttr(item.description || item.productId)}">
          </label>`).join('')}
      </div>
      <div class="table-actions">
        <button type="button" class="btn-primary" data-procurement-receive="${escapeAttr(po.id)}">Post receipt</button>
      </div>
      <div class="p0-receive-status" data-receive-status></div>
    </div>`;
}

function poMarkup(po) {
  const approved = String(po.status || '').toUpperCase() === 'APPROVED';
  return `<article class="table-card account-card p0-procurement-po">
    <div class="account-name">${escapeHtml(po.poNumber)} · ${escapeHtml(po.status)}</div>
    <div class="account-contact">Supplier ${escapeHtml(po.supplierOrganizationId || '')} · ${po.items?.length || 0} item(s)</div>
    <div class="account-notes">${approved ? 'Approved procurement-origin PO — ready for canonical receiving.' : 'Receiving is available only after canonical PO approval.'}</div>
    ${approved && can('procurement:receipt:create') ? receiveForm(po) : ''}
  </article>`;
}

export async function renderProcurementReceiving() {
  const root = document.getElementById('warehouseProcurementReceiving');
  if (!root) return;
  if (!config.chatId || !config.sessionToken) {
    root.dataset.state = UI_STATES.UNKNOWN;
    root.innerHTML = '<div class="empty">Sign in to load procurement receiving work.</div>';
    return;
  }
  if (!can('b2b:po:view') && !can('procurement:receipt:view')) {
    root.dataset.state = UI_STATES.PERMISSION_DENIED;
    root.innerHTML = '<div class="empty">Procurement receiving access is not available for this role.</div>';
    return;
  }
  if (!navigator.onLine) {
    root.dataset.state = UI_STATES.OFFLINE;
    const queued = queuedReceipts();
    const failed = failedReceipts();
    const recoveryMarkup = [...queued.map(command => `<div class="sync-note">Queued receipt for PO ${escapeHtml(command.aggregateId || '')} — NOT server-confirmed. It will retry when the server is reachable.</div>`),
      ...failed.map(command => `<div class="sync-note">Receipt for PO ${escapeHtml(command.aggregateId || '')} was rejected by the canonical authority: ${escapeHtml(command.lastError || 'Unknown failure')} <button type="button" class="btn-secondary" data-retry-receipt="${escapeAttr(command.eventId)}">Retry</button></div>`)].join('');
    root.innerHTML = `<div class="empty">Offline — canonical procurement receiving cannot be confirmed until the server is reachable.</div>${recoveryMarkup}`;
    return;
  }
  root.dataset.state = UI_STATES.LOADING;
  root.innerHTML = '<div class="empty">Loading approved procurement purchase orders…</div>';
  try {
    const tenant = encodeURIComponent(config.chatId);
    const data = await request(`/tenants/${tenant}/b2b/purchase-orders?limit=100`);
    const pos = (data.purchaseOrders || []).filter(po => String(po.sourceType || po.source_type || '').toUpperCase() === 'PROCUREMENT_AWARD');
    const approved = pos.filter(po => String(po.status || '').toUpperCase() === 'APPROVED');
    root.dataset.state = UI_STATES.SUCCESS;
    const queued = queuedReceipts();
    const failed = failedReceipts();
    const recoveryMarkup = [...queued.map(command => `
      <div class="sync-note" data-recovery-command="${escapeAttr(command.eventId)}">Queued receipt for PO ${escapeHtml(command.aggregateId || '')} — not yet server-confirmed. It will retry when the server is reachable.</div>`),
      ...failed.map(command => `
      <div class="sync-note" data-recovery-command="${escapeAttr(command.eventId)}">Receipt for PO ${escapeHtml(command.aggregateId || '')} was rejected by the canonical authority: ${escapeHtml(command.lastError || 'Unknown failure')} <button type="button" class="btn-secondary" data-retry-receipt="${escapeAttr(command.eventId)}">Retry</button></div>`)].join('');
    root.innerHTML = `
      <div class="sync-note">Procurement owns the receipt record. Inventory remains the physical stock and ledger authority. Posting here calls the existing canonical procurement-receiving API.</div>
      ${recoveryMarkup}
      ${approved.length ? approved.map(poMarkup).join('') : '<div class="empty">No approved procurement-origin purchase orders are ready for receiving.</div>'}`;
  } catch (error) {
    root.dataset.state = UI_STATES.FAILURE;
    root.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function postReceipt(poId, form) {
  if (!can('procurement:receipt:create')) throw new Error('Procurement receipt creation permission required.');
  const locationId = form.querySelector('[data-receive-location]')?.value || '';
  if (!locationId) throw new Error('Select an active receiving location.');
  const items = [...form.querySelectorAll('[data-po-item]')]
    .map(input => ({ purchaseOrderItemId: input.dataset.poItem, receivedQuantity: Number(input.value) }))
    .filter(item => Number.isInteger(item.receivedQuantity) && item.receivedQuantity > 0);
  if (!items.length) throw new Error('Enter at least one received quantity.');
  const idempotencyKey = `p0-receipt-${poId}-${crypto.randomUUID()}`;
  const endpoint = `/tenants/${encodeURIComponent(config.chatId)}/procurement/purchase-orders/${encodeURIComponent(poId)}/receipts`;
  const payload = { locationId, items, idempotencyKey };
  if (!navigator.onLine) {
    enqueueCommand({ commandType: RECEIPT_COMMAND, endpoint, method: 'POST', payload, idempotencyKey, aggregateType: 'procurement_receipt', aggregateId: poId });
    return { state: UI_STATES.QUEUED };
  }
  try {
    await fetch(`${baseUrl()}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(config.sessionToken ? { Authorization: `Bearer ${config.sessionToken}` } : {}), 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    }).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(body?.error?.message || `Request failed (${response.status})`), { status: response.status });
      return body;
    });
    return { state: UI_STATES.SUCCESS };
  } catch (error) {
    if (!error.status || error.status >= 500) {
      enqueueCommand({ commandType: RECEIPT_COMMAND, endpoint, method: 'POST', payload, idempotencyKey, aggregateType: 'procurement_receipt', aggregateId: poId });
      return { state: UI_STATES.UNKNOWN, error: error.message };
    }
    throw error;
  }
}

export function bindProcurementReceivingEvents() {
  const root = document.getElementById('warehouseProcurementReceiving');
  if (!root || root.dataset.bound === '1') return;
  root.dataset.bound = '1';
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-procurement-receive]');
    if (!button) return;
    const form = button.closest('[data-po-id]');
    const status = form?.querySelector('[data-receive-status]');
    if (!form) return;
    button.disabled = true;
    if (status) status.textContent = 'Posting canonical receipt…';
    try {
      const result = await postReceipt(button.dataset.procurementReceive, form);
      if (result.state === UI_STATES.QUEUED) {
        if (status) status.textContent = 'Queued locally. The receipt is NOT server-confirmed yet.';
      } else if (result.state === UI_STATES.UNKNOWN) {
        if (status) status.textContent = 'The server response is UNKNOWN. The same idempotent command is queued for recovery; do not create another receipt.';
      } else if (status) {
        status.textContent = 'Receipt confirmed by the canonical procurement authority.';
      }
      await renderProcurementReceiving();
    } catch (error) {
      if (status) status.textContent = error.message || 'Receipt failed.';
      button.disabled = false;
    }
  });
  if (root.dataset.onlineBound !== '1') {
    root.dataset.onlineBound = '1';
    window.addEventListener('online', async () => {
      await flushCommandOutbox(RECEIPT_COMMAND);
      await renderProcurementReceiving();
    });
  }
  root.addEventListener('click', async event => {
    const retry = event.target.closest('[data-retry-receipt]');
    if (!retry) return;
    retryCommand(retry.dataset.retryReceipt);
    await flushCommandOutbox(RECEIPT_COMMAND);
    await renderProcurementReceiving();
  });
}
