// Operator-facing projection for canonical service bookings.
// The backend remains authoritative for scope, permissions, lifecycle, and persistence.
import { config, orders, products } from '../state.js';
import { authHeaders } from '../auth/tenant.js';
import { escapeHtml, escapeAttr } from '../utils/index.js';

const NEXT = Object.freeze({
  REQUESTED: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'FAILED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED'],
});

function apiBase() {
  return String(config.syncUrl || window.location.origin).replace(/\/$/, '');
}

function serviceOrders() {
  const serviceIds = new Set((Array.isArray(products) ? products : [])
    .filter(p => String(p.item_type || p.type || '').toLowerCase() === 'service')
    .map(p => String(p.id)));
  return (Array.isArray(orders) ? orders : [])
    .filter(o => o.server_order_id && Array.isArray(o.items)
      && o.items.some(item => String(item.item_type || item.type || '').toLowerCase() === 'service'
        || serviceIds.has(String(item.item_id || item.id || item.product_id || item.productId || ''))))
    .slice(-40);
}

async function requestBookings(order) {
  const url = apiBase() + '/tenants/' + encodeURIComponent(config.chatId)
    + '/orders/' + encodeURIComponent(order.server_order_id) + '/service-bookings';
  const response = await fetch(url, { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'Could not load service bookings.');
    error.status = response.status;
    throw error;
  }
  return Array.isArray(data.bookings) ? data.bookings : [];
}

function canOperate() {
  const roles = Array.isArray(config.contextualRoles) ? config.contextualRoles : [];
  const roleNames = roles.map(r => String(r?.role || '').toLowerCase());
  return ['owner', 'manager'].includes(String(config.currentStaffRole || config.authRole || config.tenantRole || '').toLowerCase())
    || roleNames.some(r => ['logistics_manager', 'logistics_dispatcher'].includes(r));
}

function renderBookingCard(order, booking) {
  const status = String(booking.status || 'REQUESTED').toUpperCase();
  const transitions = NEXT[status] || [];
  const mode = String(booking.appointment_mode || '').replaceAll('_', ' ').toLowerCase();
  const date = value => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value || '—') : parsed.toLocaleString();
  };
  const actions = canOperate() ? transitions.map(target =>
    '<button type="button" class="btn-secondary service-booking-action" data-order-id="' + escapeAttr(order.server_order_id)
    + '" data-booking-id="' + escapeAttr(booking.id) + '" data-version="' + escapeAttr(booking.version)
    + '" data-target="' + escapeAttr(target) + '">' + escapeHtml(target.replaceAll('_', ' ')) + '</button>'
  ).join('') : '';
  return '<article class="logistics-card service-booking-card">'
    + '<div class="logistics-top"><strong>' + escapeHtml(booking.service_item_id || 'Service')
    + '</strong><span class="logistics-status">' + escapeHtml(status.replaceAll('_', ' ')) + '</span></div>'
    + '<div class="logistics-meta">Order ' + escapeHtml(order.server_order_id) + ' · ' + escapeHtml(mode || 'appointment')
    + ' · v' + escapeHtml(booking.version) + '</div>'
    + '<div class="logistics-meta">' + escapeHtml(date(booking.requested_start)) + ' – ' + escapeHtml(date(booking.requested_end)) + '</div>'
    + (booking.customer_note ? '<div class="logistics-meta">' + escapeHtml(booking.customer_note) + '</div>' : '')
    + (booking.status_reason ? '<div class="logistics-meta">Reason: ' + escapeHtml(booking.status_reason) + '</div>' : '')
    + (booking.completion_note ? '<div class="logistics-meta">Completion: ' + escapeHtml(booking.completion_note) + '</div>' : '')
    + (actions ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + actions + '</div>' : '')
    + '</article>';
}

export function serviceBookingsWorkspaceShell() {
  return '<section id="serviceBookingsWorkspace" class="settings-section" aria-label="Service bookings">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">'
    + '<h3 style="margin:0;">Service bookings</h3>'
    + '<button type="button" class="btn-secondary" id="serviceBookingsRefresh">Refresh bookings</button></div>'
    + '<p class="logistics-meta">Appointments attached to canonical service orders. The server validates every action.</p>'
    + '<div id="serviceBookingsStatus" class="logistics-meta" role="status">Loading service bookings…</div>'
    + '<div id="serviceBookingsList"></div></section>';
}

export async function refreshServiceBookings(root = document) {
  const workspace = root.querySelector('#serviceBookingsWorkspace');
  const status = workspace?.querySelector('#serviceBookingsStatus');
  const list = workspace?.querySelector('#serviceBookingsList');
  if (!workspace || !status || !list) return;
  if (!config.chatId || !config.sessionToken) {
    status.textContent = 'Sign in to view service bookings.';
    list.replaceChildren();
    return;
  }
  status.textContent = 'Loading service bookings…';
  list.replaceChildren();
  const candidates = serviceOrders();
  if (!candidates.length) {
    status.textContent = 'No synced service orders found. Create or sync a service order first.';
    return;
  }
  const results = await Promise.all(candidates.map(async order => {
    try { return { order, bookings: await requestBookings(order) }; }
    catch (error) { return { order, error }; }
  }));
  const bookings = results.flatMap(result => result.bookings
    ? result.bookings.map(booking => ({ order: result.order, booking }))
    : []);
  list.innerHTML = bookings.map(({ order, booking }) => renderBookingCard(order, booking)).join('');
  const denied = results.filter(result => result.error?.status === 403).length;
  const failures = results.filter(result => result.error && result.error.status !== 403).length;
  status.textContent = bookings.length
    ? bookings.length + ' booking' + (bookings.length === 1 ? '' : 's') + ' loaded.'
    : denied === results.length
      ? 'Your account does not have permission to view these bookings.'
      : failures
        ? 'Some bookings could not be loaded. Refresh to retry.'
        : 'No service bookings yet.';
}

async function transitionBooking(button, root) {
  const target = button.dataset.target;
  let reason = '';
  let completion_note = '';
  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(target)) {
    reason = window.prompt('Enter a reason for ' + target.toLowerCase() + ':')?.trim() || '';
    if (!reason) return;
  }
  if (target === 'COMPLETED') {
    completion_note = window.prompt('Completion note (optional):')?.trim() || '';
  }
  const orderId = button.dataset.orderId;
  const bookingId = button.dataset.bookingId;
  const url = apiBase() + '/tenants/' + encodeURIComponent(config.chatId)
    + '/orders/' + encodeURIComponent(orderId) + '/service-bookings/' + encodeURIComponent(bookingId);
  button.disabled = true;
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json', 'Idempotency-Key': 'service-booking-ui-' + crypto.randomUUID() },
      body: JSON.stringify({
        status: target,
        expected_version: Number(button.dataset.version),
        ...(reason ? { reason } : {}),
        ...(completion_note ? { completion_note } : {}),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error?.message || 'Booking update failed.');
    await refreshServiceBookings(root);
  } catch (error) {
    window.alert(error.message || 'Booking update failed. Refresh and retry.');
    button.disabled = false;
  }
}

export function mountServiceBookingsWorkspace(root = document) {
  const workspace = root.querySelector('#serviceBookingsWorkspace');
  if (!workspace) return;
  if (!workspace.dataset.handlersBound) {
    workspace.dataset.handlersBound = '1';
    workspace.addEventListener('click', event => {
      const refresh = event.target.closest('#serviceBookingsRefresh');
      const action = event.target.closest('.service-booking-action');
      if (refresh) refreshServiceBookings(root);
      if (action) transitionBooking(action, root);
    });
  }
  refreshServiceBookings(root);
}
