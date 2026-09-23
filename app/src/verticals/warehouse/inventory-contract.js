// Phase 13.11.4 — Warehouse ↔ Core Inventory integration contract.
//
// Warehouse owns receiving and stock-adjustment workflow semantics. Core
// Inventory remains the sole stock/movement authority. This contract joins
// the existing Warehouse bridges into one canonical, persistence-neutral
// handoff without introducing a second inventory service, ledger, or store.

const MUTATION_AUTHORITY = 'app/src/warehouse/inventory.js#applyStockChange';
const LEDGER_AUTHORITY = 'app/src/warehouse/ledger.js#recordInventoryMovement';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Warehouse inventory ${field} must be a non-empty string`);
  return result;
}

function finiteNonZero(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result === 0) {
    throw new TypeError(`Warehouse inventory ${field} must be a finite non-zero number`);
  }
  return result;
}

function positive(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new TypeError(`Warehouse inventory ${field} must be greater than zero`);
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

function locationIdOf(location) {
  return text(location?.id, 'location_id');
}

function baseContract({ operation, operationId, organizationId, productId, locationId, quantity, movementType, referenceType, eventId, metadata = {} }) {
  return Object.freeze({
    operation,
    operation_id: operationId,
    organization_id: organizationId,
    product_id: productId,
    location_id: locationId,
    quantity,
    movement_type: movementType,
    reference_type: referenceType,
    reference_id: operationId,
    event_id: eventId,
    metadata: Object.freeze({ ...metadata }),
    inventory_mutation_authority: MUTATION_AUTHORITY,
    inventory_ledger_authority: LEDGER_AUTHORITY,
    persistence: 'delegated_to_existing_inventory_authority',
    idempotency: 'event_id',
  });
}

export function buildWarehouseInventoryReceiveHandoff({ receiving, product, location } = {}) {
  if (!receiving || typeof receiving !== 'object') throw new TypeError('Warehouse Receiving is required');
  if (!product || product.id == null) throw new TypeError('Existing Core Product is required');
  if (!location) throw new TypeError('Existing Core Organization Location is required');

  const operationId = text(receiving.id ?? receiving.receiving_id, 'receiving_id');
  const organizationId = organizationOf(receiving);
  assertSameOrganization(organizationId, product, location);
  const productId = productIdOf(product);
  if (productId !== text(receiving.product_id ?? receiving.productId, 'receiving product_id')) {
    throw new TypeError('Receiving must reference the supplied Product');
  }
  const eventId = text(receiving.event_id ?? receiving.eventId ?? `warehouse:receiving:${operationId}:received`, 'event_id');

  return baseContract({
    operation: 'receive',
    operationId,
    organizationId,
    productId,
    locationId: locationIdOf(location),
    quantity: positive(receiving.quantity, 'receiving quantity'),
    movementType: 'received',
    referenceType: 'warehouse_receiving',
    eventId,
    metadata: {
      batch_number: receiving.batch_number ?? receiving.batchNumber ?? null,
      expiry_date: receiving.expiry_date ?? receiving.expiryDate ?? null,
      storage_bin: receiving.bin_location ?? receiving.binLocation ?? receiving.storage_bin ?? null,
    },
  });
}

export function buildWarehouseInventoryAdjustmentHandoff({ adjustment, product, location } = {}) {
  if (!adjustment || typeof adjustment !== 'object') throw new TypeError('Warehouse StockAdjustment is required');
  if (!product || product.id == null) throw new TypeError('Existing Core Product is required');
  if (!location) throw new TypeError('Existing Core Organization Location is required');

  const operationId = text(adjustment.id ?? adjustment.adjustment_id, 'adjustment_id');
  const organizationId = organizationOf(adjustment);
  assertSameOrganization(organizationId, product, location);
  const productId = productIdOf(product);
  if (productId !== text(adjustment.product_id ?? adjustment.productId, 'adjustment product_id')) {
    throw new TypeError('StockAdjustment must reference the supplied Product');
  }
  const eventId = text(adjustment.event_id ?? adjustment.eventId ?? `warehouse:adjustment:${operationId}:applied`, 'event_id');

  return baseContract({
    operation: 'adjust',
    operationId,
    organizationId,
    productId,
    locationId: locationIdOf(location),
    quantity: finiteNonZero(adjustment.delta ?? adjustment.quantity, 'adjustment delta'),
    movementType: 'adjusted',
    referenceType: 'warehouse_stock_adjustment',
    eventId,
    metadata: {
      reorder_point: adjustment.reorder_point ?? adjustment.reorderPoint ?? null,
      notes: adjustment.notes ?? null,
    },
  });
}

export function isWarehouseInventoryHandoff(value) {
  return Boolean(value && typeof value === 'object' &&
    (value.operation === 'receive' || value.operation === 'adjust') &&
    typeof value.operation_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.product_id === 'string' &&
    typeof value.location_id === 'string' &&
    Number.isFinite(Number(value.quantity)) && Number(value.quantity) !== 0 &&
    typeof value.movement_type === 'string' &&
    typeof value.reference_type === 'string' &&
    value.reference_id === value.operation_id &&
    typeof value.event_id === 'string' &&
    value.inventory_mutation_authority === MUTATION_AUTHORITY &&
    value.inventory_ledger_authority === LEDGER_AUTHORITY &&
    value.persistence === 'delegated_to_existing_inventory_authority' &&
    value.idempotency === 'event_id');
}

export function executeWarehouseInventoryHandoff(handoff, { applyStockChange } = {}) {
  if (!isWarehouseInventoryHandoff(handoff)) throw new TypeError('Valid Warehouse Inventory handoff is required');
  if (typeof applyStockChange !== 'function') throw new TypeError('Core inventory applyStockChange authority is required');

  return applyStockChange(handoff.product_id, handoff.quantity, handoff.movement_type, {
    referenceType: handoff.reference_type,
    referenceId: handoff.reference_id,
    eventId: handoff.event_id,
    locationId: handoff.location_id,
    metadata: handoff.metadata,
  });
}

export function warehouseInventoryContract() {
  return Object.freeze({
    warehouse_workflow_authority: 'warehouse',
    product_authority: 'commerce',
    stock_authority: 'inventory',
    location_authority: 'locations',
    mutation_authority: MUTATION_AUTHORITY,
    ledger_authority: LEDGER_AUTHORITY,
    supported_operations: Object.freeze(['receive', 'adjust']),
    movement_types: Object.freeze(['received', 'adjusted']),
    idempotency_key: 'event_id',
    organization_scope: 'required_and_cross_reference_checked',
    persistence: 'delegated_to_existing_inventory_authority',
    duplicate_inventory_authority: false,
    duplicate_ledger_authority: false,
    direct_stock_mutation_by_warehouse: false,
  });
}
