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
import { getPaymentForOrder, refreshCanonicalOrderPaymentSummary } from '../payments/projection.js';

// Order-level financial truth is fetched from Payment Core, not reconstructed
// from the local payment projection. Keep a short-lived UI cache so rendering
// the queue does not issue a network request for every paint.
const orderPaymentSummaryCache = new Map();
const orderPaymentSummaryInFlight = new Map();
const orderPaymentSummaryVersions = new Map();
let orderPaymentSummaryGlobalVersion = 0;
const ORDER_PAYMENT_SUMMARY_TTL_MS = 10000;

function orderPaymentSummaryKey(orderId) {
  return `${String(config.chatId || '').trim()}:${String(orderId || '').trim()}`;
}

function getCachedOrderPaymentSummary(orderId) {
  const key = orderPaymentSummaryKey(orderId);
  const cached = orderPaymentSummaryCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.receivedAt > ORDER_PAYMENT_SUMMARY_TTL_MS) return null;
  return cached.unavailable ? { unavailable: true } : cached.summary;
}

export function invalidateOrderPaymentSummaryCache(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return;
  const key = orderPaymentSummaryKey(id);
  orderPaymentSummaryVersions.set(key, (orderPaymentSummaryVersions.get(key) || 0) + 1);
  orderPaymentSummaryCache.delete(key);
}

export function invalidateAllOrderPaymentSummaryCache() {
  // In-flight requests may resolve after a tenant switch or global refresh.
  // A generation bump prevents those older responses from repopulating cache.
  orderPaymentSummaryGlobalVersion += 1;
  orderPaymentSummaryCache.clear();
}

function refreshOrderPaymentSummary(orderId) {
  const id = String(orderId || '').trim();
  if (!id || !config.chatId || orderPaymentSummaryInFlight.has(orderPaymentSummaryKey(id))) return;
  const key = orderPaymentSummaryKey(id);
  const globalVersion = orderPaymentSummaryGlobalVersion;
  // Never retain an expired/stale financial projection while a canonical
  // refresh is in flight. Failure must render as unavailable/checking rather
  // than silently presenting an old PAID/PARTIAL/UNPAID decision.
  invalidateOrderPaymentSummaryCache(id);
  const requestKeyVersion = orderPaymentSummaryVersions.get(key) || 0;
  let wasInvalidated = false;
  const promise = refreshCanonicalOrderPaymentSummary(id)
    .then(summary => {
      wasInvalidated = globalVersion !== orderPaymentSummaryGlobalVersion
        || requestKeyVersion !== (orderPaymentSummaryVersions.get(key) || 0);
      if (!wasInvalidated) {
        orderPaymentSummaryCache.set(key, { summary, receivedAt: Date.now() });
      }
      renderQueue();
      return wasInvalidated ? null : summary;
    })
    .catch(() => {
      // Cache an explicit unavailable result briefly to avoid leaving the UI
      // stuck on "checking…" or creating an immediate retry/render loop.
      // Never reuse an older financial decision after a canonical read fails.
      const wasInvalidated = globalVersion !== orderPaymentSummaryGlobalVersion
        || requestKeyVersion !== (orderPaymentSummaryVersions.get(key) || 0);
      if (!wasInvalidated) {
        orderPaymentSummaryCache.set(key, { unavailable: true, receivedAt: Date.now() });
      }
      renderQueue();
      return null;
    })
    .finally(() => {
      orderPaymentSummaryInFlight.delete(key);
      // If an event invalidated this request while it was in flight, retry
      // only after removing the old in-flight marker; its response is not
      // allowed to become the displayed financial summary.
      if (wasInvalidated || globalVersion !== orderPaymentSummaryGlobalVersion
        || requestKeyVersion !== (orderPaymentSummaryVersions.get(key) || 0)) {
        renderQueue();
      }
    });
  orderPaymentSummaryInFlight.set(key, promise);
}

export function renderDailySummary() {
  const container = document.getElementById('dailySummaryContainer');
  if (!container) return;
  if (orders.length === 0) {
    container.innerHTML = '';
    return;
  }
  // Reporting semantics: order totals are not proof of collected revenue.
  // This summary reports today's order value, not confirmed payments. The
  // date filter also prevents older orders from inflating today's figures.
  // Orders don't carry a timezone, so "today" follows the device's local
  // calendar day rather than UTC.
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTodayMs = startOfToday.getTime();
  const todaysOrders = orders.filter(o => (o.created_at || 0) >= startOfTodayMs);

  const orderValueTotal = todaysOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrdersCount = todaysOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? (orderValueTotal / totalOrdersCount) : 0;
  const queuedCount = todaysOrders.filter(o => o.status !== 'synced').length;
  const syncedCount = todaysOrders.filter(o => o.status === 'synced').length;

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card">
        <div class="label">${t('orderValue')}</div>
        <div class="val">${CS()}${formatMoney(orderValueTotal)}</div>
      </div>
      <div class="summary-card">
        <div class="label">${t('totalOrders')}</div>
        <div class="val">${totalOrdersCount}</div>
      </div>
      <div class="summary-card">
        <div class="label">${t('avgOrderVal')}</div>
        <div class="val">${CS()}${formatMoney(avgOrderValue)}</div>
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
  const orderPaymentSummary = o.server_order_id ? getCachedOrderPaymentSummary(o.server_order_id) : null;
  if (o.server_order_id && !orderPaymentSummary) refreshOrderPaymentSummary(o.server_order_id);
  const paymentStateLine = orderPaymentSummary && !orderPaymentSummary.unavailable && payment?.state
    ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> Payment Core: ${escapeHtml(String(payment.state).replaceAll('_', ' '))}</div>` : '';
  const orderPaymentStatus = String(orderPaymentSummary?.status || orderPaymentSummary?.payment_status || '').toUpperCase();
  const orderPaymentStatusLabel = ['UNPAID', 'PARTIAL', 'PAID', 'OVERPAID', 'REFUNDED', 'REVERSED'].includes(orderPaymentStatus)
    ? orderPaymentStatus
    : 'Payment status unavailable';
  const orderPaymentLine = orderPaymentSummary?.unavailable
    ? '<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> Order payment: status unavailable · retry by refreshing</div>'
    : orderPaymentSummary
      ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> Order payment: ${escapeHtml(orderPaymentStatusLabel)} · ${CS()}${formatMoney(orderPaymentSummary.verifiedMinor ?? orderPaymentSummary.verified_minor ?? 0)} paid · ${CS()}${formatMoney(orderPaymentSummary.outstandingMinor ?? orderPaymentSummary.outstanding_minor ?? 0)} outstanding</div>`
      : (o.server_order_id ? '<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> Order payment: checking…</div>' : '');
  const payMethodLine = o.payment_method_name
    ? `<div class="ticket-customer"><svg class="icon icon-sm"><use href="#i-card"/></svg> ${escapeHtml(o.payment_method_name)}${o.payment_proof ? ' · <svg class="icon icon-sm"><use href="#i-paperclip"/></svg> receipt attached (evidence only)' : ''}</div>` : '';
  // A locally queued order has not yet been linked to canonical Payment Core.
  // State this explicitly so the method name or receipt attachment cannot be
  // mistaken for backend-confirmed payment.
  const paymentLinkageLine = !o.server_order_id && o.payment_linkage?.status === 'UNLINKED'
    ? '<div class="ticket-customer">Payment tracking: Not yet linked to Payment Core</div>' : '';
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
    ${paymentLinkageLine}
    ${orderPaymentLine}
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


// Canonical payment/status updates invalidate the corresponding order summary
// immediately. This prevents a successful sync/provider refresh from leaving an
// older PAID/PARTIAL/UNPAID projection visible until the normal TTL expires.
if (typeof window !== 'undefined') {
  window.addEventListener('sellify:payment-canonical-updated', event => {
    invalidateOrderPaymentSummaryCache(event?.detail?.orderId);
  });
  // The order-payment summary cache is tenant-scoped. Clear it before a tenant
  // switch so no prior tenant's financial projection survives context change.
  window.addEventListener('sellify:tenant-changing', invalidateAllOrderPaymentSummaryCache);
}
