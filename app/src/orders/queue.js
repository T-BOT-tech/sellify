// orders/queue.js
// Phase 4 extraction (see modularization plan §5): the order queue tab —
// daily summary, ticket rendering/patching, and the optimistic
// delete-with-undo flow — moved out of main.js unchanged.
// pendingOrderDeletes is local state owned here (only this module reads or
// writes it).
//
// NOTE on the `../main.js` import below: patchList, renderStatus,
// showUndoToast, isVolumeDiscountEnabled, getVolumeDiscountForQty, and t all
// still live in main.js at this phase (patchList/renderStatus move out in
// Phase 7 — ui/render-core.js; the wholesale helpers and t in their own
// later phases). Importing them back from main.js creates a harmless
// circular import, the same temporary pattern storage/json.js already
// uses — see that file for the fuller explanation.
import { CS } from '../config/currency.js';
import { escapeHtml, formatElapsedShort } from '../utils/index.js';
import { formatMoney } from '../utils/money.js';
import { STORAGE_KEYS } from '../constants.js';
import { config, orders, setOrders, currentStaff } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { hasPermission } from '../auth/permissions.js';
import { authHeaders } from '../auth/tenant.js';
// Phase 8 fix (see modularization plan §5, Phase 8): these used to come
// from '../main.js', which only re-exported them from their real owning
// module. That made main.js and every feature file that needed a toast,
// a translation, or a render call import each other in a cycle. Now
// imported directly from source, so main.js only imports feature code —
// nothing imports main.js back except window-bridge.js.
import { isVolumeDiscountEnabled, getVolumeDiscountForQty } from '../b2b/pricing.js';
import { t } from '../ui/i18n.js';
import { patchList, renderStatus } from '../ui/render.js';
import { showUndoToast } from '../ui/toast.js';
import { getPaymentForOrder } from '../payments/projection.js';

export function renderDailySummary() {
  const container = document.getElementById('dailySummaryContainer');
  if (!container) return;
  if (orders.length === 0) {
    container.innerHTML = '';
    return;
  }
  // Phase 4 (data integrity in reporting): this used to sum every order
  // ever stored, regardless of when it was placed — so "Today's Sales"
  // silently showed all-time revenue once the queue had more than one
  // day's orders in it (confirmed bug, not theoretical: nothing here ever
  // pruned or filtered by date). Filtered to created_at falling within the
  // *device's local* calendar day — orders don't carry a timezone, and a
  // seller reading this on their own device expects "today" to mean their
  // own local today, not UTC's.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const todaysOrders = orders.filter(o => (o.created_at || 0) >= startOfTodayMs);

  const totalRevenue = todaysOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrdersCount = todaysOrders.length;
  const avgValue = totalOrdersCount > 0 ? (totalRevenue / totalOrdersCount) : 0;
  const queuedCount = todaysOrders.filter(o => o.status !== 'synced').length;
  const syncedCount = todaysOrders.filter(o => o.status === 'synced').length;

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">${t('todaySales')}</div>
        <div class="val">${CS()}${formatMoney(totalRevenue)}</div>
      </div>
      <div class="summary-card">
        <div class="label">${t('totalOrders')}</div>
        <div class="val">${totalOrdersCount}</div>
      </div>
      <div class="summary-card">
        <div class="label">${t('avgOrderVal')}</div>
        <div class="val">${CS()}${formatMoney(avgValue)}</div>
      </div>
      <div class="summary-card">
        <div class="label">${t('queued')} / ${t('synced')}</div>
        <div class="val">${queuedCount} / ${syncedCount}</div>
      </div>
    </div>`;
}

export function renderQueue() {
  renderDailySummary();
  const list = document.getElementById('queueList');
  if (!list) return;
  if (orders.length === 0) {
    list.innerHTML = `<div class="empty">${t('noOrders')}</div>`;
    return;
  }
  if (list.querySelector(':scope > .empty')) list.innerHTML = '';
  patchList(list, orders, o => o.id, createTicketNode, updateTicketNode, removeTicketNode);
}

// (formatElapsedShort() now comes from utils/index.js.)

export function ticketInnerHtml(o) {
  const itemsHtml = o.items.map(i =>
    `<div class="item-row"><span>${i.qty} × ${escapeHtml(i.name)}</span><span>${CS()}${formatMoney(i.qty * i.price)}</span></div>`
  ).join('');
  const customerLine = o.customer_name || o.customer_phone
    ? `<div class="ticket-customer">${escapeHtml(o.customer_name || '')} ${escapeHtml(o.customer_phone || '')}</div>` : '';
  const cashLine = (o.cash_tendered !== null && o.cash_tendered !== undefined)
    ? `<div class="ticket-customer">${t('cashTendered')}: ${CS()}${formatMoney(o.cash_tendered)} · ${t('changeDue')}: ${CS()}${formatMoney(o.change_due || 0)}</div>` : '';
  const payment = o.server_order_id ? getPaymentForOrder(o.server_order_id) : null;
  const paymentStateLine = payment?.state
    ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> Payment Core: ${escapeHtml(String(payment.state).replaceAll('_', ' '))}</div>` : '';
  const payMethodLine = o.payment_method_name
    ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> ${escapeHtml(o.payment_method_name)}${o.payment_proof ? ' · <svg class="icon icon-sm"><use href="#i-paperclip"/></svg> proof attached' : ''}</div>` : '';
  const staffLine = o.created_by_role
    ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-user"/></svg> Staff: ${escapeHtml(o.created_by_user || 'Staff')} (${escapeHtml((o.created_by_role || '').toUpperCase())})</div>` : '';
  const b2bLine = o.b2b_account_name
    ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-building"/></svg> ${escapeHtml(o.b2b_account_name)}${o.pricing_tier_name ? ' · ' + escapeHtml(o.pricing_tier_name) : ''}</div>` : '';
  const hasVolumeDiscount = isVolumeDiscountEnabled() && o.items.some(i => getVolumeDiscountForQty(i.qty));
  const volumeLine = hasVolumeDiscount ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-box"/></svg> ${t('volumeDiscountApplied')}</div>` : '';
  const statusLabel = o.is_marketplace ? String(o.status || 'queued').replaceAll('_', ' ') : (o.status === 'synced' ? t('synced') : t('queued'));
  // W5: provenance line, only shown for still-queued tickets — this is
  // what answers "is my data safe?" per-record instead of a bare badge.
  // Silent once retry count is 0 and it just went in seconds ago; only
  // speaks up once there's something worth knowing. Plain English text
  // rather than a t() key, same reasoning as the cart-sticky-bar count:
  // not worth adding a new key across all 7 locales for one line.
  const provenanceLine = (o.status === 'queued' && o.created_at)
    ? `<div class="ticket-provenance">${escapeHtml(formatElapsedShort(Date.now() - o.created_at))}${
        o.sync_attempts ? ` · ${o.sync_attempts} retry attempt${o.sync_attempts === 1 ? '' : 's'}` : ''
      }</div>`
    : '';
  const proofBtn = (o.payment_proof && hasPermission(currentStaff ? currentStaff.role : 'owner', 'payments:view_proof'))
    ? `<button type="button" class="ticket-act-btn" onclick="viewPaymentProof('${o.id}')"><svg class="icon icon-sm"><use href="#i-paperclip"/></svg> Proof</button>` : '';
  const disabledAttr = o._deleting ? ' disabled' : '';

  return `
    <div class="ticket-head">
      <span class="ticket-id">${o.id}${o.server_order_id ? ' → ' + o.server_order_id : ''}</span>
      <span class="badge ${o.status}">${statusLabel}</span>
    </div>
    ${provenanceLine}
    <div class="ticket-items">${itemsHtml}</div>
    <div class="ticket-total"><span>${t('total')}</span><span>${CS()}${formatMoney(o.total)}</span></div>
    ${payMethodLine}
    ${paymentStateLine}
    ${cashLine}
    ${customerLine}
    ${b2bLine}
    ${volumeLine}
    ${staffLine}
    <div class="ticket-actions">
      <button type="button" class="ticket-act-btn" onclick="generateAndShareImageReceipt('${o.id}')"${disabledAttr}><svg class="icon icon-sm"><use href="#i-image"/></svg> ${t('imageReceipt')}</button>
      <button type="button" class="ticket-act-btn" onclick="shareReceipt('${o.id}')"${disabledAttr}><svg class="icon icon-sm"><use href="#i-send"/></svg> ${t('share')}</button>
      <button type="button" class="ticket-act-btn" onclick="copyReceipt('${o.id}')"${disabledAttr}><svg class="icon icon-sm"><use href="#i-paperclip"/></svg> ${t('copy')}</button>
      <button type="button" class="ticket-act-btn" onclick="printReceipt('${o.id}')"${disabledAttr}><svg class="icon icon-sm"><use href="#i-print"/></svg> ${t('print')}</button>
      ${proofBtn}
      ${o.is_marketplace && MARKETPLACE_NEXT[o.status] ? `<button type="button" class="ticket-act-btn" onclick="advanceMarketplaceOrderStatus('${o.id}')"${disabledAttr}>Next: ${escapeHtml(MARKETPLACE_NEXT[o.status].replaceAll('_', ' '))}</button>` : ''}
      ${o.is_marketplace && ['queued','confirmed','preparing'].includes(o.status) ? `<button type="button" class="ticket-act-btn danger" onclick="cancelMarketplaceOrder('${o.id}')"${disabledAttr}>Cancel</button>` : ''}
      <button type="button" class="ticket-act-btn danger" onclick="deleteOrder('${o.id}')"${disabledAttr}><svg class="icon icon-sm"><use href="#i-trash"/></svg> ${t('delete')}</button>
    </div>`;
}

export function createTicketNode(o) {
  const div = document.createElement('div');
  div.className = 'ticket ticket-enter';
  div.innerHTML = ticketInnerHtml(o);
  requestAnimationFrame(() => div.classList.remove('ticket-enter'));
  return div;
}

export function updateTicketNode(node, o) {
  node.classList.toggle('ticket-removing', !!o._deleting);
  node.innerHTML = ticketInnerHtml(o);
}

export function removeTicketNode(node) {
  node.classList.add('ticket-exit');
  setTimeout(() => node.remove(), 220);
}

export function getOrderById(id) {
  return orders.find(o => o.id === id);
}

const MARKETPLACE_NEXT = { queued: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' };

export async function advanceMarketplaceOrderStatus(id) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'orders:view')) return;
  const order = getOrderById(id);
  if (!order?.is_marketplace || !MARKETPLACE_NEXT[order.status]) return;
  const next = MARKETPLACE_NEXT[order.status];
  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/api/marketplace/orders/status/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status: next }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to update order status.');
    order.status = data.status || next;
    order.status_updated_at = data.status_updated_at || Date.now();
    saveJSON(STORAGE_KEYS.orders, orders);
    renderQueue();
  } catch (error) {
    console.error(error);
    renderStatus();
  }
}

export async function cancelMarketplaceOrder(id) {
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'orders:view')) return;
  const order = getOrderById(id);
  if (!order?.is_marketplace || !['queued','confirmed','preparing'].includes(order.status)) return;
  try {
    const res = await fetch(`${config.syncUrl.replace(/\/$/, '')}/api/marketplace/orders/status/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ status: 'cancelled' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Unable to cancel order.');
    order.status = data.status || 'cancelled'; order.status_updated_at = data.status_updated_at || Date.now();
    saveJSON(STORAGE_KEYS.orders, orders); renderQueue();
  } catch (error) { console.error(error); renderStatus(); }
}

const pendingOrderDeletes = new Map();

export function deleteOrder(id) {
  // Phase 3 fix (see modularization plan §5, Phase 3): this previously had
  // no permission gate at all — any role could delete an order. Now matches
  // the same silent-return convention the paymethods:manage checks already
  // use elsewhere in this file.
  if (!hasPermission(currentStaff ? currentStaff.role : 'owner', 'orders:delete')) return;
  const o = getOrderById(id);
  if (!o || o._deleting) return;
  o._deleting = true;
  renderQueue();

  const timeoutId = setTimeout(() => finalizeOrderDelete(id), 5000);
  pendingOrderDeletes.set(id, timeoutId);

  showUndoToast(t('orderDeleted'), () => undoDeleteOrder(id));
}

export function undoDeleteOrder(id) {
  const timeoutId = pendingOrderDeletes.get(id);
  if (timeoutId) { clearTimeout(timeoutId); pendingOrderDeletes.delete(id); }
  const o = getOrderById(id);
  if (o) { delete o._deleting; renderQueue(); }
}

export function finalizeOrderDelete(id) {
  pendingOrderDeletes.delete(id);
  setOrders(orders.filter(o => o.id !== id));
  saveJSON(STORAGE_KEYS.orders, orders);
  renderStatus();
  renderQueue();
}
