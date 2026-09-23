import assert from 'node:assert/strict';
import {
  buildWarehouseStockAdjustmentContract,
  isWarehouseStockAdjustmentContract,
  warehouseStockAdjustmentContract,
} from '../app/src/verticals/warehouse/stock-adjustment-contract.js';

const product = { id: 'p-1', name: 'Coffee', organization_id: 'org-1' };
const location = { id: 'loc-1', code: 'WH-A', name: 'Main Warehouse', type: 'WAREHOUSE', organization_id: 'org-1' };

const adjustment = {
  id: 'adj-1',
  organization_id: 'org-1',
  product_id: 'p-1',
  delta: -4,
  reorder_point: 8,
  notes: 'Cycle count correction',
};

const contract = buildWarehouseStockAdjustmentContract({ adjustment, product, location });
assert.equal(contract.adjustment_id, 'adj-1');
assert.equal(contract.organization_id, 'org-1');
assert.equal(contract.product_id, 'p-1');
assert.equal(contract.location_id, 'loc-1');
assert.equal(contract.delta, -4);
assert.equal(contract.reorder_point, 8);
assert.equal(contract.notes, 'Cycle count correction');
assert.equal(contract.movement_type, 'adjusted');
assert.equal(contract.reference_type, 'warehouse_stock_adjustment');
assert.equal(contract.reference_id, 'adj-1');
assert.equal(contract.event_id, 'warehouse:adjustment:adj-1:applied');
assert.equal(contract.persistence, 'delegated_to_existing_inventory_authority');
assert.equal(isWarehouseStockAdjustmentContract(contract), true);
assert.equal(Object.isFrozen(contract), true);

const positive = buildWarehouseStockAdjustmentContract({
  adjustment: { id: 'adj-2', organization_id: 'org-1', product_id: 'p-1', delta: 5 },
  product,
  location,
});
assert.equal(positive.delta, 5);
assert.equal(positive.reorder_point, null);
assert.equal(positive.notes, null);

assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment: { ...adjustment, delta: 0 }, product, location,
}), /finite non-zero/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment: { ...adjustment, delta: 'not-a-number' }, product, location,
}), /finite non-zero/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment: { ...adjustment, reorder_point: -1 }, product, location,
}), /non-negative/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment: { ...adjustment, organization_id: 'org-2' }, product, location,
}), /different organization/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment: { ...adjustment, product_id: 'p-2' }, product, location,
}), /reference the supplied Product/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment, product, location: { ...location, organization_id: 'org-2' },
}), /different organization/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment: { ...adjustment, id: '' }, product, location,
}), /adjustment_id/);
assert.throws(() => buildWarehouseStockAdjustmentContract({
  adjustment, product, location: null,
}), /Organization Location/);

const metadata = warehouseStockAdjustmentContract();
assert.equal(metadata.adjustment_authority, 'warehouse');
assert.equal(metadata.product_authority, 'commerce');
assert.equal(metadata.inventory_authority, 'inventory');
assert.equal(metadata.location_authority, 'locations');
assert.equal(metadata.mutation_authority, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(metadata.ledger_authority, 'app/src/warehouse/ledger.js#recordInventoryMovement');
assert.equal(metadata.idempotency_key, 'event_id');
assert.equal(metadata.adjustment_semantics, 'finite_non_zero_delta');
assert.equal(metadata.negative_delta_allowed, true);
assert.equal(metadata.duplicate_adjustment_authority, false);
assert.equal(metadata.duplicate_inventory_authority, false);
assert.deepEqual(metadata.optional_metadata, ['reorder_point', 'notes']);

console.log('Phase 13.9.8 Warehouse Stock Adjustment Contract Regression: PASS');
