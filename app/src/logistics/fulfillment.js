// logistics/fulfillment.js
// FUX-44 — Core Fulfillment frontend authority binding.
//
// The Logistics UI expresses intent; the backend Core Fulfillment API owns
// status transitions and terminal inventory consequences. This module keeps
// only local UI state and a projection of the canonical response.
//
// Invariant:
// UI intent -> canonical fulfillment command -> backend authority
// Offline/network-unknown -> durable command outbox -> reconciliation
// Never mark a local order delivered/picked_up without a canonical response.

import { config, orders } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { STORAGE_KEYS } from '../constants.js';
import { authHeaders } from '../auth/tenant.js';
import { enqueueCommand } from '../sync/outbox.js';
import { t } from '../ui/i18n.js';
import { showToast } from '../ui/toast.js';
import { renderLogistics } from './ui.js';

export let selectedFulfillmentType = null;
export function setSelectedFulfillmentType(next) { selectedFulfillmentType = next; }

export function isLogisticsEnabled() {
  return !!config.logisticsEnabled;
}

export function nextFulfillmentStatus(order) {
  if (order.fulfillment_type === 'delivery') {
    if (order.fulfillment_status === 'pending') return 'out_for_delivery';
    if (order.fulfillment_status === 'out_for_delivery') return 'delivered';
  } else if (order.fulfillment_type === 'pickup') {
    if (order.fulfillment_status === 'pending') return 'ready_for_pickup';
    if (order.fulfillment_status === 'ready_for_pickup') return 'picked_up';
  }
  return null;
}

export function isFulfillmentFinal(status) {
  return status === 'delivered' || status === 'picked_up';
}

export function fulfillmentStatusLabel(status) {
  return t('whFulfill_' + status) || status;
}

function fulfillmentEndpoint(order) {
  return `/tenants/${encodeURIComponent(config.chatId)}/orders/${encodeURIComponent(order.server_order_id)}/fulfillment`;
}

function fulfillmentCommandKey(order, next) {
  return `fulfillment:${String(order.server_order_id)}:${String(next)}`;
}

function canonicalFulfillmentPatch(order, fulfillment) {
  if (!fulfillment?.status) return false;
  order.fulfillment_status = fulfillment.status;
  order.fulfillment_sync_status = 'confirmed';
  if (fulfillment.fulfillment_type) order.fulfillment_type = fulfillment.fulfillment_type;
  if (fulfillment.destination_json) {
    try {
      const destination = typeof fulfillment.destination_json === 'string'
        ? JSON.parse(fulfillment.destination_json)
        : fulfillment.destination_json;
      if (destination?.address) order.delivery_address = destination.address;
    } catch {}
  }
  return true;
}

function queueFulfillmentCommand(order, next, reason = 'offline') {
  if (!config.chatId || !config.sessionToken || !order.server_order_id) return null;
  const command = enqueueCommand({
    commandType: 'fulfillment.transition',
    endpoint: fulfillmentEndpoint(order),
    method: 'POST',
    payload: {
      status: next,
      locationId: config.locationId || null,
    },
    idempotencyKey: fulfillmentCommandKey(order, next),
    aggregateType: 'order',
    aggregateId: String(order.server_order_id),
  });
  if (command) {
    order.fulfillment_sync_status = 'queued';
    order.fulfillment_sync_reason = reason;
    saveJSON(STORAGE_KEYS.orders, orders);
    renderLogistics();
  }
  return command;
}

async function requestCanonicalFulfillment(order, next) {
  const idempotencyKey = fulfillmentCommandKey(order, next);
  const response = await fetch(
    `${(config.syncUrl || window.location.origin).replace(/\/$/, '')}${fulfillmentEndpoint(order)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        status: next,
        locationId: config.locationId || null,
      }),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Fulfillment request failed (${response.status})`);
    error.status = response.status;
    error.code = data?.error?.code;
    throw error;
  }
  return data?.fulfillment || null;
}

export async function advanceFulfillmentOrder(orderId) {
  const order = orders.find(o => String(o.id) === String(orderId));
  if (!order) return;

  const next = nextFulfillmentStatus(order);
  if (!next) return;

  // Core fulfillment requires a canonical server order. An unsynced local
  // order cannot be given a fake fulfillment transition locally.
  if (!order.server_order_id) {
    showToast('Sync this order before advancing fulfillment.');
    return;
  }

  const queued = order.fulfillment_sync_status === 'queued';
  if (queued) return;

  // Offline is an explicit QUEUED state, not a successful fulfillment state.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    queueFulfillmentCommand(order, next, 'offline');
    showToast('Fulfillment action queued for sync.');
    return;
  }

  try {
    const fulfillment = await requestCanonicalFulfillment(order, next);
    if (!canonicalFulfillmentPatch(order, fulfillment)) {
      throw new Error('Server returned no canonical fulfillment state.');
    }
    delete order.fulfillment_sync_reason;
    saveJSON(STORAGE_KEYS.orders, orders);
    renderLogistics();
  } catch (error) {
    // A lost network response is UNKNOWN. Reusing the same idempotency key
    // makes a later retry safe if the server actually committed it.
    if (!error.status || error.status >= 500) {
      queueFulfillmentCommand(order, next, 'unknown');
      showToast('Fulfillment status is unknown; retry queued for sync.');
      return;
    }
    showToast(error.message || 'Could not update fulfillment.');
  }
}
