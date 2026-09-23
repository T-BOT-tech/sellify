import assert from 'node:assert/strict';
import {
  normalizeShipmentTracking,
  isShipmentTrackingContract,
  logisticsShipmentTrackingContract,
} from '../app/src/verticals/logistics/shipment-tracking-contract.js';

const order = {
  id: 'ORDER-13.10.9-1',
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
};

const first = normalizeShipmentTracking({
  order,
  shipmentId: 'SHIP-001',
  trackingReference: 'TRK-001',
});
assert.deepEqual(first, {
  order_id: 'ORDER-13.10.9-1',
  fulfillment_type: 'delivery',
  shipment_id: 'SHIP-001',
  tracking_reference: 'TRK-001',
  tracking_source: 'sellify',
  authority: 'commerce_order',
  external_tracking_authority: null,
  persistence: 'existing_core_order_fields_only',
});
assert.equal(isShipmentTrackingContract(first), true);

// Existing Core Order values are projected without mutation.
const existing = {
  id: 'ORDER-13.10.9-2',
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
  shipment_id: 'SHIP-002',
  tracking_reference: 'TRK-002',
};
const snapshot = JSON.stringify(existing);
const replay = normalizeShipmentTracking({ order: existing });
assert.equal(replay.shipment_id, 'SHIP-002');
assert.equal(replay.tracking_reference, 'TRK-002');
assert.equal(JSON.stringify(existing), snapshot);
assert.deepEqual(normalizeShipmentTracking({
  order: existing,
  shipmentId: 'SHIP-002',
  trackingReference: 'TRK-002',
}), replay);

// A provider/carrier reference is accepted as metadata only; the external
// system remains the authority for externally-owned tracking state.
const carrier = normalizeShipmentTracking({
  order,
  shipmentId: 'SHIP-003',
  trackingReference: 'CARRIER-003',
  source: 'carrier',
});
assert.equal(carrier.external_tracking_authority, 'carrier');
assert.equal(carrier.authority, 'commerce_order');

assert.throws(() => normalizeShipmentTracking({
  order: { id: 'O', fulfillment_type: 'delivery' },
}), /Shipment must have shipment_id or tracking_reference/);
assert.throws(() => normalizeShipmentTracking({
  order: existing,
  trackingReference: 'TRK-CONFLICT',
}), /conflicts with existing Core Order tracking_reference/);
assert.throws(() => normalizeShipmentTracking({
  order: existing,
  shipmentId: 'SHIP-CONFLICT',
}), /conflicts with existing Core Order shipment_id/);
assert.throws(() => normalizeShipmentTracking({
  order,
  shipmentId: 'SHIP-004',
  source: 'unknown',
}), /Unsupported tracking source/);
assert.throws(() => normalizeShipmentTracking({
  order: { id: 'O', fulfillment_type: 'freight' },
  shipmentId: 'SHIP-005',
}), /Unsupported fulfillment type/);

const contract = logisticsShipmentTrackingContract();
assert.equal(contract.shipment_authority, 'commerce_order');
assert.equal(contract.tracking_reference_authority, 'commerce_order');
assert.equal(contract.external_tracking_authority, 'carrier_or_provider_when_external');
assert.equal(contract.replay_policy, 'same_reference_is_safe_replay');
assert.equal(contract.duplicate_shipment_store, false);
assert.equal(contract.duplicate_tracking_ledger, false);

console.log('Phase 13.10.9 Logistics Shipment / Tracking Reference Regression: PASS');
