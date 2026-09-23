// Phase 13.9.8 — Warehouse Stock Adjustment Contract.
// Formalizes the existing adjustment workflow without creating a second
// inventory mutation or ledger authority.
import { buildWarehouseStockAdjustmentBridge } from './inventory-bridge.js';

function text(value, field, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new TypeError(`Warehouse ${field} must be a non-empty string`);
  return result || null;
}

function finiteNonZero(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result === 0) {
    throw new TypeError(`Warehouse ${field} must be a finite non-zero number`);
  }
  return result;
}

function nonNegative(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) {
    throw new TypeError(`Warehouse ${field} must be a non-negative number`);
  }
  return result;
}

/**
 * Normalize an existing Warehouse stock adjustment into a persistence-neutral
 * contract. Core Inventory remains responsible for the stock mutation and
 * movement record; this function only validates and describes the handoff.
 */
export function buildWarehouseStockAdjustmentContract({ adjustment, product, location } = {}) {
  if (!adjustment || typeof adjustment !== 'object') {
    throw new TypeError('Warehouse StockAdjustment is required');
  }

  const bridge = buildWarehouseStockAdjustmentBridge({ adjustment, product, location });
  const delta = finiteNonZero(adjustment.delta ?? adjustment.quantity, 'stock adjustment delta');

  return Object.freeze({
    adjustment_id: bridge.adjustment_id,
    organization_id: bridge.organization_id,
    product_id: bridge.product_id,
    location_id: bridge.location_id,
    delta,
    reorder_point: nonNegative(adjustment.reorder_point ?? adjustment.reorderPoint, 'reorder_point'),
    notes: text(adjustment.notes, 'notes', false),
    movement_type: 'adjusted',
    reference_type: 'warehouse_stock_adjustment',
    reference_id: bridge.reference_id,
    event_id: bridge.event_id,
    inventory_mutation_authority: bridge.mutation_authority,
    inventory_ledger_authority: bridge.ledger_authority,
    persistence: 'delegated_to_existing_inventory_authority',
  });
}

export function isWarehouseStockAdjustmentContract(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.adjustment_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.product_id === 'string' &&
    typeof value.location_id === 'string' &&
    Number.isFinite(Number(value.delta)) && Number(value.delta) !== 0 &&
    (value.reorder_point === null || (Number.isFinite(Number(value.reorder_point)) && Number(value.reorder_point) >= 0)) &&
    value.movement_type === 'adjusted' &&
    value.reference_type === 'warehouse_stock_adjustment' &&
    typeof value.reference_id === 'string' &&
    typeof value.event_id === 'string' &&
    value.inventory_mutation_authority === 'app/src/warehouse/inventory.js#applyStockChange' &&
    value.inventory_ledger_authority === 'app/src/warehouse/ledger.js#recordInventoryMovement' &&
    value.persistence === 'delegated_to_existing_inventory_authority');
}

export function warehouseStockAdjustmentContract() {
  return Object.freeze({
    adjustment_authority: 'warehouse',
    product_authority: 'commerce',
    inventory_authority: 'inventory',
    location_authority: 'locations',
    mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
    movement_type: 'adjusted',
    reference_type: 'warehouse_stock_adjustment',
    idempotency_key: 'event_id',
    adjustment_semantics: 'finite_non_zero_delta',
    negative_delta_allowed: true,
    reorder_point_authority: 'product_inventory_metadata',
    optional_metadata: Object.freeze(['reorder_point', 'notes']),
    persistence: 'delegated_to_existing_inventory_authority',
    duplicate_adjustment_authority: false,
    duplicate_inventory_authority: false,
  });
}
