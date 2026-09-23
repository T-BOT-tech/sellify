import assert from 'node:assert/strict';
import { getLogisticsFulfillmentContext, isLogisticsFulfillmentContext, logisticsFulfillmentBoundaryContract } from '../app/src/verticals/logistics/fulfillment-boundary.js';

const order = {
  id: 'ORDER-13.10-1', fulfillment_type: 'delivery', fulfillment_status: 'out_for_delivery',
  delivery_address: 'Bole', scheduled_time: '2026-09-08T10:00', tracking_reference: 'TRK-1',
  fulfillment_proof: { type: 'photo', ref: 'proof-1' },
};
const context = getLogisticsFulfillmentContext(order);
assert.equal(context.order_id, order.id);
assert.equal(context.fulfillment_status, 'out_for_delivery');
assert.equal(context.destination, 'Bole');
assert.equal(context.tracking_reference, 'TRK-1');
assert.equal(context.order_authority, 'commerce');
assert.equal(context.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(context.logistics_role, 'coordinate_and_project');
assert.equal(isLogisticsFulfillmentContext(context), true);
assert.equal(logisticsFulfillmentBoundaryContract().duplicate_fulfillment_authority, false);
assert.throws(() => getLogisticsFulfillmentContext({ id: 'X', fulfillment_type: 'ship', fulfillment_status: 'pending' }), /Unsupported fulfillment type/);
assert.throws(() => getLogisticsFulfillmentContext({ id: 'X', fulfillment_type: 'delivery', fulfillment_status: 'unknown' }), /Unsupported fulfillment status/);
console.log('Phase 13.10.3 Logistics Fulfillment Boundary Regression: PASS');
