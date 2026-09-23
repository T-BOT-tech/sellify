import assert from 'node:assert/strict';
import {
  buildWarehouseReceivingBridge,
  buildWarehouseStockAdjustmentBridge,
  executeWarehouseInventoryBridge,
  isWarehouseInventoryBridge,
  WAREHOUSE_INVENTORY_BRIDGE_CONTRACT,
} from '../app/src/verticals/warehouse/inventory-bridge.js';

const org = 'org-13-9-4';
const product = { id: 'product-1', name: 'Widget', organization_id: org };
const location = { id: 'location-1', organization_id: org, status: 'active' };

const receiving = buildWarehouseReceivingBridge({
  receiving: { id: 'receiving-1', organization_id: org, product_id: 'product-1', quantity: 25 },
  product,
  location,
});
assert.equal(receiving.operation, 'receive');
assert.equal(receiving.quantity, 25);
assert.equal(receiving.movement_type, 'received');
assert.equal(receiving.reference_type, 'warehouse_receiving');
assert.equal(receiving.event_id, 'warehouse:receiving:receiving-1:received');
assert.equal(isWarehouseInventoryBridge(receiving), true);

const adjustment = buildWarehouseStockAdjustmentBridge({
  adjustment: { id: 'adjustment-1', organization_id: org, product_id: 'product-1', delta: -3 },
  product,
  location,
});
assert.equal(adjustment.operation, 'adjust');
assert.equal(adjustment.quantity, -3);
assert.equal(adjustment.movement_type, 'adjusted');
assert.equal(adjustment.reference_type, 'warehouse_stock_adjustment');
assert.equal(adjustment.event_id, 'warehouse:adjustment:adjustment-1:applied');

const calls = [];
const tx = executeWarehouseInventoryBridge(receiving, {
  applyStockChange(productId, quantity, type, meta) {
    calls.push({ productId, quantity, type, meta });
    return { id: 'tx-1', product_id: productId, quantity, type };
  },
});
assert.equal(tx.id, 'tx-1');
assert.deepEqual(calls[0], {
  productId: 'product-1',
  quantity: 25,
  type: 'received',
  meta: {
    referenceType: 'warehouse_receiving',
    referenceId: 'receiving-1',
    eventId: 'warehouse:receiving:receiving-1:received',
    locationId: 'location-1',
  },
});

assert.equal(WAREHOUSE_INVENTORY_BRIDGE_CONTRACT.stock_authority, 'inventory');
assert.equal(WAREHOUSE_INVENTORY_BRIDGE_CONTRACT.duplicate_inventory_authority, false);
assert.equal(WAREHOUSE_INVENTORY_BRIDGE_CONTRACT.idempotency_key, 'event_id');

assert.throws(
  () => buildWarehouseReceivingBridge({
    receiving: { id: 'receiving-2', organization_id: org, product_id: 'product-1', quantity: 1 },
    product,
    location: { ...location, organization_id: 'other-org' },
  }),
  /different organization/,
);
assert.throws(
  () => buildWarehouseReceivingBridge({
    receiving: { id: 'receiving-3', organization_id: org, product_id: 'other-product', quantity: 1 },
    product,
    location,
  }),
  /supplied Product/,
);
assert.throws(
  () => buildWarehouseReceivingBridge({
    receiving: { id: 'receiving-4', organization_id: org, product_id: 'product-1', quantity: 0 },
    product,
    location,
  }),
  /greater than zero/,
);
assert.throws(
  () => buildWarehouseStockAdjustmentBridge({
    adjustment: { id: 'adjustment-2', organization_id: org, product_id: 'product-1', delta: 0 },
    product,
    location,
  }),
  /finite non-zero/,
);
assert.throws(
  () => executeWarehouseInventoryBridge(receiving, {}),
  /applyStockChange authority/,
);

console.log('Phase 13.9.4 Warehouse Inventory Bridge Regression: PASS');
