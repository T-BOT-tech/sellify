import assert from 'node:assert/strict';
import { isPhysicalFulfillment, toPhysicalFlow, physicalFlowStatus } from '../app/src/logistics/physical-flow.js';

const deliveryOrder = {
  id: 'ORDER-12-DELIVERY',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  delivery_address: 'Bonga',
  scheduled_time: '2026-09-07T20:00',
  tracking_reference: 'TRK-12',
  fulfillment_proof: { type: 'photo', ref: 'proof-12' },
  stock_deducted: true,
};

assert.equal(isPhysicalFulfillment(deliveryOrder), true);
const deliveryFlow = toPhysicalFlow(deliveryOrder);
assert.deepEqual(deliveryFlow, {
  id: 'order:ORDER-12-DELIVERY',
  source: 'sellify.order',
  orderId: 'ORDER-12-DELIVERY',
  type: 'delivery',
  status: 'delivered',
  destination: 'Bonga',
  scheduledAt: '2026-09-07T20:00',
  trackingReference: 'TRK-12',
  proof: { type: 'photo', ref: 'proof-12' },
  stockDeducted: true,
  final: true,
});
assert.equal(physicalFlowStatus(deliveryFlow), 'delivered');

// The bridge must consume the actual checkout field names rather than the
// prefixed compatibility aliases.
const pickupOrder = {
  id: 'ORDER-12-PICKUP',
  fulfillment_type: 'pickup',
  fulfillment_status: 'ready_for_pickup',
  pickup_location: 'Main Store',
  scheduled_time: '2026-09-08T09:00',
  stock_deducted: false,
};
assert.deepEqual(toPhysicalFlow(pickupOrder), {
  id: 'order:ORDER-12-PICKUP',
  source: 'sellify.order',
  orderId: 'ORDER-12-PICKUP',
  type: 'pickup',
  status: 'ready_for_pickup',
  destination: 'Main Store',
  scheduledAt: '2026-09-08T09:00',
  trackingReference: null,
  proof: null,
  stockDeducted: false,
  final: false,
});

// Historical/prefixed aliases remain readable without changing the order.
const legacyShape = {
  id: 'ORDER-12-LEGACY',
  fulfillment_type: 'delivery',
  fulfillment_status: 'pending',
  fulfillment_address: 'Legacy Address',
  fulfillment_scheduled_time: '2026-09-09T10:00',
  stock_deducted: 'true',
};
const legacySnapshot = JSON.stringify(legacyShape);
assert.deepEqual(toPhysicalFlow(legacyShape), {
  id: 'order:ORDER-12-LEGACY',
  source: 'sellify.order',
  orderId: 'ORDER-12-LEGACY',
  type: 'delivery',
  status: 'pending',
  destination: 'Legacy Address',
  scheduledAt: '2026-09-09T10:00',
  trackingReference: null,
  proof: null,
  stockDeducted: true,
  final: false,
});
assert.equal(JSON.stringify(legacyShape), legacySnapshot);
assert.equal(toPhysicalFlow({ id: 'NON-PHYSICAL' }), null);

console.log('Phase 12.2 Fulfillment Compatibility Bridge Regression: PASS');
