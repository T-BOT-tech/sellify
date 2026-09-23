// Phase 13.9.7 — Warehouse Receiving Contract.
// Formalizes the existing receiving workflow without creating a second
// receiving persistence model or inventory authority.
import { buildWarehouseReceivingBridge } from './inventory-bridge.js';

function text(value, field, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result || null;
}

function positive(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new TypeError(`Warehouse ${field} must be greater than zero`);
  }
  return result;
}

/**
 * Normalize an existing Warehouse receiving action into a persistence-neutral
 * contract. The inventory bridge remains responsible for the Core Inventory
 * handoff; this function does not mutate stock or write storage.
 */
export function buildWarehouseReceivingContract({ receiving, product, location } = {}) {
  if (!receiving || typeof receiving !== 'object') throw new TypeError('Warehouse Receiving is required');

  const bridge = buildWarehouseReceivingBridge({ receiving, product, location });
  const quantity = positive(receiving.quantity, 'receiving quantity');

  return Object.freeze({
    receiving_id: bridge.receiving_id,
    organization_id: bridge.organization_id,
    product_id: bridge.product_id,
    location_id: bridge.location_id,
    quantity,
    batch_number: text(receiving.batch_number ?? receiving.batchNumber, 'batch_number', false),
    expiry_date: text(receiving.expiry_date ?? receiving.expiryDate, 'expiry_date', false),
    storage_bin: text(receiving.bin_location ?? receiving.binLocation ?? receiving.storage_bin, 'storage_bin', false),
    reference: text(receiving.reference, 'reference', false),
    notes: text(receiving.notes, 'notes', false),
    movement_type: 'received',
    reference_type: 'warehouse_receiving',
    reference_id: bridge.receiving_id,
    event_id: bridge.event_id,
    inventory_mutation_authority: bridge.mutation_authority,
    inventory_ledger_authority: bridge.ledger_authority,
    persistence: 'delegated_to_existing_inventory_authority',
  });
}

export function isWarehouseReceivingContract(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.receiving_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.product_id === 'string' &&
    typeof value.location_id === 'string' &&
    Number.isFinite(Number(value.quantity)) && Number(value.quantity) > 0 &&
    value.movement_type === 'received' &&
    value.reference_type === 'warehouse_receiving' &&
    typeof value.reference_id === 'string' &&
    typeof value.event_id === 'string' &&
    value.inventory_mutation_authority === 'app/src/warehouse/inventory.js#applyStockChange' &&
    value.inventory_ledger_authority === 'app/src/warehouse/ledger.js#recordInventoryMovement' &&
    value.persistence === 'delegated_to_existing_inventory_authority');
}

export function warehouseReceivingContract() {
  return Object.freeze({
    receiving_authority: 'warehouse',
    product_authority: 'commerce',
    inventory_authority: 'inventory',
    location_authority: 'locations',
    mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
    movement_type: 'received',
    reference_type: 'warehouse_receiving',
    idempotency_key: 'event_id',
    optional_metadata: Object.freeze(['batch_number', 'expiry_date', 'storage_bin', 'reference', 'notes']),
    persistence: 'existing_inventory_and_legacy_transaction_projection',
    duplicate_receiving_authority: false,
    duplicate_inventory_authority: false,
  });
}
