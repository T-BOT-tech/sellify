// Phase 10.5 — canonical inventory movement ledger.
// This module is deliberately additive. The legacy product.stock and
// stockTransactions projection remain operational; this append-only stream
// records the same business movements so the authoritative inventory model
// can be migrated later without losing offline compatibility.
import { STORAGE_KEYS } from '../constants.js';
import { config, currentStaff, inventoryMovements, setInventoryMovements, inventoryBalances, setInventoryBalances } from '../state.js';
import { saveJSON } from '../storage/json.js';
import { uid } from '../utils/index.js';
import { enqueueEvent } from '../sync/outbox.js';

const TYPE_MAP = Object.freeze({
  received: 'PURCHASE',
  sold: 'SALE',
  adjusted: 'ADJUSTMENT',
  returned: 'RETURN',
  transfer_in: 'TRANSFER_IN',
  transfer_out: 'TRANSFER_OUT',
  damaged: 'DAMAGE',
  lost: 'LOSS',
  reservation: 'RESERVATION',
  release: 'RELEASE',
});

function persist() { saveJSON(STORAGE_KEYS.inventoryMovements, inventoryMovements); }
function baseUrl() { return (config.syncUrl || window.location.origin).replace(/\/$/, ''); }
function eventId() { return `inv_${Date.now()}_${uid()}`; }

export function movementType(type) {
  const value = String(type || '').trim().toLowerCase();
  return TYPE_MAP[value] || String(type || '').trim().toUpperCase() || 'ADJUSTMENT';
}

export function recordInventoryMovement(product, quantity, type, meta = {}) {
  if (!product || !Number.isFinite(Number(quantity)) || Number(quantity) === 0) return null;
  const now = new Date().toISOString();
  const movement = {
    id: uid(),
    eventId: meta.eventId || eventId(),
    organizationId: config.organizationId || '',
    locationId: meta.locationId || config.locationId || '',
    productId: String(product.id),
    productName: String(product.name || ''),
    quantity: Number(quantity),
    movementType: movementType(type),
    referenceType: meta.referenceType || null,
    referenceId: meta.referenceId || meta.reference || null,
    actorId: config.authUser?.id || null,
    deviceId: config.deviceId || null,
    occurredAt: meta.occurredAt || now,
    reason: String(meta.reason || meta.notes || '').slice(0, 500),
    metadata: meta.metadata || {},
    syncStatus: 'pending',
  };
  const next = [movement, ...inventoryMovements.filter(m => m.eventId !== movement.eventId)];
  setInventoryMovements(next);
  persist();
  enqueueEvent('inventory.movement.record', movement, { aggregateType: 'inventory_movement', aggregateId: movement.id, eventId: movement.eventId, occurredAt: movement.occurredAt });
  return movement;
}

export async function recordCanonicalInventoryMovement(input = {}) {
  const productId = String(input.productId || '').trim();
  const quantity = Number(input.quantity);
  const movementType = String(input.movementType || '').trim().toUpperCase();
  if (!productId || !Number.isFinite(quantity) || quantity === 0 || !movementType) {
    throw new Error('Valid product, non-zero quantity, and movement type are required.');
  }
  const event = {
    eventId: input.eventId || eventId(),
    productId,
    quantity,
    movementType,
    locationId: input.locationId || config.locationId || '',
    referenceType: input.referenceType || null,
    referenceId: input.referenceId || null,
    reason: input.reason || '',
    metadata: input.metadata || {},
    occurredAt: new Date().toISOString(),
  };
  if (!config.chatId || !config.sessionToken || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    enqueueEvent('inventory.movement.record', event, {
      aggregateType: 'inventory_movement',
      aggregateId: event.eventId,
      eventId: event.eventId,
      occurredAt: event.occurredAt,
    });
    return { queued: true, movement: event };
  }
  try {
    const res = await fetch(
      `${baseUrl()}` + '/tenants/' + encodeURIComponent(config.chatId) + '/inventory/movements',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sessionToken}` },
        body: JSON.stringify(event),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const error = new Error(data?.error?.message || `Inventory update failed (${res.status})`); error.status = res.status; error.code = data?.error?.code; throw error; }
    const remote = data.movement || event;
    const existing = inventoryMovements.filter(m => m.eventId !== remote.eventId);
    setInventoryMovements([{ ...remote, syncStatus: 'synced' }, ...existing]);
    persist();
    return { queued: false, movement: remote };
  } catch (error) {
    // A lost response is UNKNOWN, not failure of the business operation.
    // Requeue the exact event so a reconnect can safely replay it by eventId.
    if (!error?.status && !error?.code) {
      enqueueEvent('inventory.movement.record', event, {
        aggregateType: 'inventory_movement',
        aggregateId: event.eventId,
        eventId: event.eventId,
        occurredAt: event.occurredAt,
      });
      return { queued: true, movement: event, syncStatus: 'pending', reason: error?.message || 'transport_failure' };
    }
    throw error;
  }
}

export async function syncInventoryMovement(movement) {
  if (!movement || !config.chatId || !config.sessionToken) return null;
  const res = await fetch(`${baseUrl()}/tenants/${encodeURIComponent(config.chatId)}/inventory/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.sessionToken}` },
    body: JSON.stringify(movement),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Inventory sync failed (${res.status})`);
  const remote = data.movement || movement;
  const next = inventoryMovements.map(item => item.eventId === movement.eventId ? { ...item, ...remote, syncStatus: 'synced' } : item);
  setInventoryMovements(next);
  persist();
  return remote;
}

export async function loadInventoryMovements({ productId = '', locationId = '', limit = 100 } = {}) {
  if (!config.chatId || !config.sessionToken) return inventoryMovements;
  const params = new URLSearchParams({ limit: String(limit) });
  if (productId) params.set('product_id', productId);
  if (locationId) params.set('location_id', locationId);
  const res = await fetch(`${baseUrl()}/tenants/${encodeURIComponent(config.chatId)}/inventory/movements?${params}`, {
    headers: { Authorization: `Bearer ${config.sessionToken}` },
  });
  if (!res.ok) return inventoryMovements;
  const data = await res.json();
  if (!Array.isArray(data.movements)) return inventoryMovements;
  const byEvent = new Map(inventoryMovements.map(m => [m.eventId, m]));
  for (const remote of data.movements) byEvent.set(remote.eventId, { ...remote, syncStatus: 'synced' });
  const merged = [...byEvent.values()].sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')));
  setInventoryMovements(merged);
  persist();
  return merged;
}


// Refresh status is deliberately in-memory. The balances endpoint does not
// provide server-side freshness metadata, so refreshedAt means only that this
// client received a valid balance response at that time.
let inventoryBalanceRefreshState = {
  status: 'UNKNOWN',
  tenantChatId: '',
  locationId: '',
  refreshedAt: null,
  httpStatus: null,
};
let lastSuccessfulInventoryBalanceRefresh = null;

export function getInventoryBalanceRefreshState({ locationId = config.locationId || '' } = {}) {
  const tenantChatId = String(config.chatId || '');
  const scopedLocationId = String(locationId || '');
  if (
    inventoryBalanceRefreshState.tenantChatId !== tenantChatId
    || inventoryBalanceRefreshState.locationId !== scopedLocationId
  ) {
    return { status: 'UNKNOWN', tenantChatId, locationId: scopedLocationId, refreshedAt: null, httpStatus: null };
  }
  return { ...inventoryBalanceRefreshState };
}

function setInventoryBalanceRefreshStatus(status, scope, { refreshedAt = null, httpStatus = null } = {}) {
  inventoryBalanceRefreshState = {
    status,
    tenantChatId: scope.tenantChatId,
    locationId: scope.locationId,
    refreshedAt,
    httpStatus,
  };
}

function lastSuccessfulRefreshFor(scope) {
  const last = lastSuccessfulInventoryBalanceRefresh;
  return last && last.tenantChatId === scope.tenantChatId && last.locationId === scope.locationId
    ? last
    : null;
}

export async function loadInventoryBalances({ locationId = '' } = {}) {
  const scope = {
    tenantChatId: String(config.chatId || ''),
    locationId: String(locationId || ''),
  };
  if (!scope.tenantChatId || !config.sessionToken) {
    setInventoryBalanceRefreshStatus('UNKNOWN', scope);
    return inventoryBalances;
  }

  const lastSuccessful = lastSuccessfulRefreshFor(scope);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setInventoryBalanceRefreshStatus(lastSuccessful ? 'CACHED' : 'OFFLINE', scope, {
      refreshedAt: lastSuccessful?.refreshedAt || null,
    });
    return inventoryBalances;
  }

  setInventoryBalanceRefreshStatus('REFRESHING', scope, {
    refreshedAt: lastSuccessful?.refreshedAt || null,
  });

  try {
    const params = new URLSearchParams();
    if (scope.locationId) params.set('location_id', scope.locationId);
    const query = params.toString();
    const url = baseUrl() + '/tenants/' + encodeURIComponent(scope.tenantChatId)
      + '/inventory/balances' + (query ? '?' + query : '');
    const res = await fetch(url, {
      headers: { Authorization: 'Bearer ' + config.sessionToken },
    });

    if (!res.ok) {
      setInventoryBalanceRefreshStatus(
        res.status === 401 || res.status === 403 ? 'PERMISSION_DENIED' : (lastSuccessful ? 'CACHED' : 'UNKNOWN'),
        scope,
        { refreshedAt: lastSuccessful?.refreshedAt || null, httpStatus: res.status },
      );
      return inventoryBalances;
    }

    const data = await res.json().catch(() => null);
    if (!Array.isArray(data?.balances)) {
      setInventoryBalanceRefreshStatus(lastSuccessful ? 'CACHED' : 'UNKNOWN', scope, {
        refreshedAt: lastSuccessful?.refreshedAt || null,
        httpStatus: res.status,
      });
      return inventoryBalances;
    }

    const next = data.balances.map(row => ({
      locationId: row.locationId || '',
      productId: String(row.productId),
      quantity: Number(row.quantity || 0),
    }));
    setInventoryBalances(next);
    persistBalances();
    const refreshedAt = new Date().toISOString();
    lastSuccessfulInventoryBalanceRefresh = { ...scope, refreshedAt };
    setInventoryBalanceRefreshStatus('FRESH', scope, { refreshedAt, httpStatus: res.status });
    return next;
  } catch (error) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setInventoryBalanceRefreshStatus(offline ? (lastSuccessful ? 'CACHED' : 'OFFLINE') : (lastSuccessful ? 'CACHED' : 'UNKNOWN'), scope, {
      refreshedAt: lastSuccessful?.refreshedAt || null,
    });
    throw error;
  }
}

function persistBalances() { saveJSON(STORAGE_KEYS.inventoryBalances, inventoryBalances); }

export function getInventoryBalance(productId, locationId = '') {
  const row = inventoryBalances.find(item => String(item.productId) === String(productId) && (!locationId || String(item.locationId) === String(locationId)));
  if (row) return Number(row.quantity || 0);
  return localInventoryBalance(productId, locationId);
}

export function localInventoryBalance(productId, locationId = '') {
  return inventoryMovements
    .filter(m => String(m.productId) === String(productId) && (!locationId || String(m.locationId || '') === String(locationId)))
    .reduce((sum, m) => sum + Number(m.quantity || 0), 0);
}
