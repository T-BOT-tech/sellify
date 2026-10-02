import assert from 'node:assert/strict';
import {
  buildLogisticsMovementProjection,
  isLogisticsMovementProjection,
  logisticsMovementShipmentContract,
} from '../app/src/verticals/logistics/movement-shipment-contract.js';

const order = {
  id: 'ORDER-13.10.19-1',
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
  shipment_id: 'SHIP-001',
  tracking_reference: 'TRK-001',
};

const projection = buildLogisticsMovementProjection({ order });
assert.equal(projection.movement_id, 'movement:ORDER-13.10.19-1');
assert.equal(projection.order_id, order.id);
assert.equal(projection.shipment_id, 'SHIP-001');
assert.equal(projection.tracking_reference, 'TRK-001');
assert.equal(projection.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(projection.shipment_reference_authority, 'commerce_order');
assert.equal(projection.persistence, 'none');
assert.equal(projection.mutation_authority, 'none');
assert.deepEqual(projection.legs, []);
assert.equal(isLogisticsMovementProjection(projection), true);

// A pending fulfillment may legitimately exist before shipment/tracking data.
const pending = buildLogisticsMovementProjection({
  order: {
    id: 'ORDER-13.10.19-2',
    fulfillment_type: 'delivery',
    fulfillment_status: 'pending',
  },
});
assert.equal(pending.shipment_id, null);
assert.equal(pending.tracking_reference, null);
assert.equal(isLogisticsMovementProjection(pending), true);

// The projection must not silently attach a fulfillment from another order.
assert.throws(() => buildLogisticsMovementProjection({
  order,
  fulfillment: {
    order_id: 'OTHER-ORDER',
    fulfillment_type: 'delivery',
    fulfillment_status: 'out_for_delivery',
    shipment_id: 'SHIP-001',
  },
}), /same Core Order/);

// A non-pending movement cannot claim an execution reference that does not exist.
assert.throws(() => buildLogisticsMovementProjection({
  order: {
    id: 'ORDER-13.10.19-3',
    fulfillment_type: 'delivery',
    fulfillment_status: 'out_for_delivery',
  },
}), /requires shipment_id or tracking_reference/);

const contract = logisticsMovementShipmentContract();
assert.equal(contract.relationship, 'core_fulfillment_to_shipment_reference');
assert.equal(contract.movement_authority, 'logistics-pack-coordination-projection');
assert.equal(contract.shipment_reference_authority, 'commerce_order');
assert.equal(contract.leg_model, 'deferred_until_real_multi_leg_requirement');
assert.equal(contract.persistence, 'none');
assert.equal(contract.mutation_authority, 'none');
assert.equal(contract.duplicate_shipment_store, false);
assert.equal(contract.duplicate_movement_ledger, false);
assert.equal(contract.duplicate_fulfillment_authority, false);

console.log('Phase 13.10.19 Logistics Movement / Shipment Relationship Regression: PASS');
