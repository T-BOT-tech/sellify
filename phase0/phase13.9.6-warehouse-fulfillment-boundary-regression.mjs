import assert from 'node:assert/strict';
import {
  getWarehouseFulfillmentContext,
  isWarehouseFulfillmentContext,
  warehouseFulfillmentBoundaryContract,
} from '../app/src/verticals/warehouse/fulfillment-boundary.js';

const delivery = getWarehouseFulfillmentContext({
  id: 'ORDER-13-9-6-D',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  delivery_address: 'Bonga',
  scheduled_time: '2026-09-07T20:00',
  tracking_reference: 'TRK-96',
  fulfillment_proof: { type: 'photo', ref: 'proof-96' },
  stock_deducted: true,
});
assert.deepEqual(delivery, {
  order_id: 'ORDER-13-9-6-D',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  destination: 'Bonga',
  scheduled_at: '2026-09-07T20:00',
  tracking_reference: 'TRK-96',
  proof: { type: 'photo', ref: 'proof-96' },
  stock_deducted: true,
  final: true,
  fulfillment_authority: 'app/src/logistics/fulfillment.js',
  order_authority: 'commerce',
});
assert.equal(isWarehouseFulfillmentContext(delivery), true);

const pickup = getWarehouseFulfillmentContext({
  id: 'ORDER-13-9-6-P',
  fulfillment_type: 'pickup',
  fulfillment_status: 'ready_for_pickup',
  pickup_location: 'Main Store',
  stock_deducted: 'false',
});
assert.equal(pickup.destination, 'Main Store');
assert.equal(pickup.final, false);
assert.equal(pickup.stock_deducted, false);

assert.throws(() => getWarehouseFulfillmentContext(null), /Core Order is required/);
assert.throws(() => getWarehouseFulfillmentContext({ id: 'x', fulfillment_type: 'warehouse' }), /Unsupported fulfillment type/);
assert.throws(() => getWarehouseFulfillmentContext({ id: 'x', fulfillment_type: 'pickup', fulfillment_status: 'stored' }), /Unsupported fulfillment status/);

const contract = warehouseFulfillmentBoundaryContract();
assert.equal(contract.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.lifecycle_mutation, 'fulfillment_only');
assert.equal(contract.stock_mutation, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(contract.stock_deduction_guard, 'order.stock_deducted');
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.warehouse_fulfillment_entity, false);
assert.equal(contract.persistence, 'none');

console.log('Phase 13.9.6 Warehouse Fulfillment Boundary Regression: PASS');
