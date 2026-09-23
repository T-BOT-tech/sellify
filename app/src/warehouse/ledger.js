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


export async function loadInventoryBalances({ locationId = '' } = {}) {
  if (!config.chatId || !config.sessionToken) return inventoryBalances;
  const params = new URLSearchParams();
  if (locationId) params.set('location_id', locationId);
  const query = params.toString();
  const res = await fetch(`${baseUrl()}/tenants/${encodeURIComponent(config.chatId)}/inventory/balances${query ? `?${query}` : ''}`, {
    headers: { Authorization: `Bearer ${config.sessionToken}` },
  });
  if (!res.ok) return inventoryBalances;
  const data = await res.json();
  if (!Array.isArray(data.balances)) return inventoryBalances;
  const next = data.balances.map(row => ({
    locationId: row.locationId || '', productId: String(row.productId), quantity: Number(row.quantity || 0)
  }));
  setInventoryBalances(next);
  persistBalances();
  return next;
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
