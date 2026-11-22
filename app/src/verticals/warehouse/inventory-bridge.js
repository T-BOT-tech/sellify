// Phase 13.9.4 — Warehouse -> Core Inventory bridge contract.
//
// Warehouse owns receiving/adjustment workflow semantics, but Core Inventory
// remains the only stock mutation and movement authority. This bridge is
// persistence-neutral: callers inject the existing applyStockChange function
// and movement stream rather than creating a second inventory implementation.

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result;
}

function finiteNonZero(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result === 0) {
    throw new TypeError(`Warehouse ${field} must be a finite non-zero number`);
  }
  return result;
}

function positive(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new TypeError(`Warehouse ${field} must be greater than zero`);
  }
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Warehouse inventory reference belongs to a different organization');
    }
  }
}

function productIdOf(product) {
  return text(product?.id, 'product_id');
}

export function buildWarehouseReceivingBridge({ receiving, product, location } = {}) {
  if (!receiving || typeof receiving !== 'object') throw new TypeError('Warehouse Receiving is required');
  if (!product || product.id == null) throw new TypeError('Existing Core Product is required');
  if (!location) throw new TypeError('Existing Core Organization Location is required');

  const receivingId = text(receiving.id ?? receiving.receiving_id, 'receiving_id');
  const organizationId = organizationOf(receiving);
  assertSameOrganization(organizationId, product, location);
  const coreProductId = productIdOf(product);
  const referencedProductId = text(receiving.product_id ?? receiving.productId, 'receiving product_id');
  if (coreProductId !== referencedProductId) throw new TypeError('Receiving must reference the supplied Product');

  const quantity = positive(receiving.quantity, 'receiving quantity');
  const eventId = text(
    receiving.event_id ?? receiving.eventId ?? `warehouse:receiving:${receivingId}:received`,
    'receiving event_id',
  );

  return Object.freeze({
    operation: 'receive',
    receiving_id: receivingId,
    product_id: coreProductId,
    organization_id: organizationId,
    location_id: text(location.id, 'location_id'),
    quantity,
    movement_type: 'received',
    reference_type: 'warehouse_receiving',
    reference_id: receivingId,
    event_id: eventId,
    mutation_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
    ledger_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
    idempotency: 'event_id',
  });
}

export function buildWarehouseStockAdjustmentBridge({ adjustment, product, location } = {}) {
  if (!adjustment || typeof adjustment !== 'object') throw new TypeError('Warehouse StockAdjustment is required');
  if (!product || product.id == null) throw new TypeError('Existing Core Product is required');
  if (!location) throw new TypeError('Existing Core Organization Location is required');

  const adjustmentId = text(adjustment.id ?? adjustment.adjustment_id, 'adjustment_id');
  const organizationId = organizationOf(adjustment);
  assertSameOrganization(organizationId, product, location);
  const coreProductId = productIdOf(product);
  const referencedProductId = text(adjustment.product_id ?? adjustment.productId, 'adjustment product_id');
  if (coreProductId !== referencedProductId) throw new TypeError('StockAdjustment must reference the supplied Product');

  const delta = finiteNonZero(adjustment.delta ?? adjustment.quantity, 'stock adjustment delta');
  const eventId = text(
    adjustment.event_id ?? adjustment.eventId ?? `warehouse:adjustment:${adjustmentId}:applied`,
    'stock adjustment event_id',
  );

  return Object.freeze({
    operation: 'adjust',
    adjustment_id: adjustmentId,
    product_id: coreProductId,
    organization_id: organizationId,
    location_id: text(location.id, 'location_id'),
    quantity: delta,
    movement_type: 'adjusted',
    reference_type: 'warehouse_stock_adjustment',
    reference_id: adjustmentId,
    event_id: eventId,
    mutation_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
    ledger_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
    idempotency: 'event_id',
  });
}

export function isWarehouseInventoryBridge(value) {
  return Boolean(value && typeof value === 'object' &&
    (value.operation === 'receive' || value.operation === 'adjust') &&
    typeof value.product_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.location_id === 'string' &&
    typeof value.event_id === 'string' &&
    value.mutation_authority === 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement' &&
    value.ledger_authority === 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement' &&
    value.idempotency === 'event_id');
}

// Execute only after the bridge payload is validated. The injected function
// is the existing Inventory authority; this module never mutates product.stock
// or writes a movement record directly.
export async function executeWarehouseInventoryBridge(bridge, { recordCanonicalInventoryMovement } = {}) {
  if (!isWarehouseInventoryBridge(bridge)) throw new TypeError('Valid Warehouse inventory bridge is required');
  if (typeof recordCanonicalInventoryMovement !== 'function') {
    throw new TypeError('Canonical Inventory movement authority is required');
  }

  const result = await recordCanonicalInventoryMovement({
    productId: bridge.product_id,
    quantity: bridge.quantity,
    movementType: bridge.movement_type === 'received' ? 'PURCHASE' : 'ADJUSTMENT',
    referenceType: bridge.reference_type,
    referenceId: bridge.reference_id,
    eventId: bridge.event_id,
    locationId: bridge.location_id,
  });
  if (!result || typeof result !== 'object') throw new Error('Canonical Inventory did not return an execution result');
  return Object.freeze({
    status: result.queued ? 'pending' : 'confirmed',
    queued: Boolean(result.queued),
    movement: result.movement || null,
    event_id: bridge.event_id,
  });
}

export const WAREHOUSE_INVENTORY_BRIDGE_CONTRACT = Object.freeze({
  warehouse_authority: 'warehouse',
  product_authority: 'commerce',
  stock_authority: 'inventory',
  mutation_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
  ledger_authority: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
  receiving_movement_type: 'received',
  adjustment_movement_type: 'adjusted',
  receiving_reference_type: 'warehouse_receiving',
  adjustment_reference_type: 'warehouse_stock_adjustment',
  idempotency_key: 'event_id',
  persistence: 'delegated_to_existing_inventory_authority',
  duplicate_inventory_authority: false,
});
