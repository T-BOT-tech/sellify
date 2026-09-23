import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOGISTICS_PACK } from '../app/src/verticals/logistics/pack.js';
import { LOGISTICS_AUTHORITY_MAP, logisticsAuthorityContract } from '../app/src/verticals/logistics/authority-map.js';
import { getLogisticsFulfillmentContext, logisticsFulfillmentBoundaryContract } from '../app/src/verticals/logistics/fulfillment-boundary.js';
import { normalizeShipmentTracking, logisticsShipmentTrackingContract } from '../app/src/verticals/logistics/shipment-tracking-contract.js';
import {
  captureDeliveryProof,
  normalizeDeliveryProof,
  normalizeLogisticsReturn,
  transitionLogisticsReturn,
  logisticsProofReturnContract,
} from '../app/src/verticals/logistics/proof-return-contract.js';
import {
  assignCourier,
  normalizeCourier,
  logisticsCourierAssignmentContract,
} from '../app/src/verticals/logistics/courier-assignment-contract.js';

// Phase 13.10.14 intentionally hardens the composition of the already-built
// Logistics contracts. It must not add production persistence or another
// authority. Each scenario below crosses two or more feature boundaries.

const deliveredOrder = {
  id: 'ORDER-13.10.14-1',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  shipment_id: 'SHIP-14',
  tracking_reference: 'TRK-14',
  delivery_address: 'Destination A',
};
const deliveredSnapshot = JSON.stringify(deliveredOrder);

// Shipment/tracking + fulfillment projection must agree on the same Core Order.
const tracking = normalizeShipmentTracking({ order: deliveredOrder, source: 'carrier' });
const fulfillment = getLogisticsFulfillmentContext(deliveredOrder);
assert.equal(tracking.order_id, fulfillment.order_id);
assert.equal(tracking.shipment_id, fulfillment.shipment_id);
assert.equal(tracking.tracking_reference, fulfillment.tracking_reference);
assert.equal(fulfillment.fulfillment_status, 'delivered');
assert.equal(fulfillment.final, true);
assert.equal(JSON.stringify(deliveredOrder), deliveredSnapshot);

// Proof may consume the delivered boundary, but must not mutate the order.
const proof = captureDeliveryProof({
  order: deliveredOrder,
  proof: { type: 'PHOTO', ref: 'proof-14', captured_at: '2026-09-08T16:00:00Z' },
});
assert.equal(proof.order_id, deliveredOrder.id);
assert.equal(proof.mutation_authority, 'commerce_order');
assert.equal(proof.replay, false);
assert.equal(JSON.stringify(deliveredOrder), deliveredSnapshot);

// Replaying the exact proof is safe; replacing it is not.
const proofOrder = { ...deliveredOrder, fulfillment_proof: normalizeDeliveryProof({ type: 'photo', ref: 'proof-14' }) };
const proofReplay = captureDeliveryProof({ order: proofOrder, proof: { type: 'photo', ref: 'proof-14' } });
assert.equal(proofReplay.replay, true);
assert.throws(
  () => captureDeliveryProof({ order: proofOrder, proof: { type: 'signature', ref: 'proof-other' } }),
  /conflicts with existing fulfillment_proof/,
);

// Courier + fulfillment: a courier assignment must stay tied to the same delivery/order.
const outForDelivery = {
  id: deliveredOrder.id,
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
};
const courier = normalizeCourier({ id: 'COURIER-14', name: 'Courier 14', source: 'manual' });
const assignment = assignCourier({
  delivery: { id: 'DEL-14', order_id: deliveredOrder.id, ...outForDelivery },
  courier,
});
assert.equal(assignment.order_id, deliveredOrder.id);
assert.equal(assignment.assignment_status, 'assigned');
assert.equal(assignment.persistence, 'coordination_contract_only');
assert.throws(
  () => assignCourier({
    delivery: { id: 'DEL-14', order_id: deliveredOrder.id, fulfillment_type: 'delivery' },
    courier,
    existingAssignment: { delivery_id: 'DEL-14', order_id: 'ORDER-WRONG', courier_id: courier.id },
  }),
  /conflicts with existing order/,
);

// Return + order identity: return transitions must not create inventory/payment authority.
const returnBase = normalizeLogisticsReturn({
  id: 'RET-14',
  order_id: deliveredOrder.id,
  status: 'requested',
  reason: 'customer_request',
  proof: { type: 'code', ref: 'RET-CODE-14' },
});
const approved = transitionLogisticsReturn({ current: returnBase, nextStatus: 'approved' });
const inTransit = transitionLogisticsReturn({ current: approved, nextStatus: 'in_transit' });
const received = transitionLogisticsReturn({ current: inTransit, nextStatus: 'received' });
assert.equal(received.order_id, deliveredOrder.id);
assert.equal(received.status, 'received');
assert.equal(transitionLogisticsReturn({ current: received, nextStatus: 'received' }).replay, true);
assert.throws(
  () => transitionLogisticsReturn({ current: received, nextStatus: 'cancelled' }),
  /Invalid return transition/,
);

// Cross-feature identity mismatch must never be silently reconciled.
assert.throws(
  () => normalizeShipmentTracking({
    order: { ...deliveredOrder, shipment_id: 'SHIP-OTHER' },
    shipmentId: 'SHIP-14',
  }),
  /conflicts with existing Core Order shipment_id/,
);
// A proof reference is scoped to the supplied Core Order; Logistics must not
// invent a global proof registry that makes identical references collide across orders.
const otherOrderProof = captureDeliveryProof({
  order: { ...deliveredOrder, id: 'ORDER-OTHER' },
  proof: { type: 'photo', ref: 'proof-14' },
});
assert.equal(otherOrderProof.order_id, 'ORDER-OTHER');

// Authority contracts must remain mutually consistent.
const authority = logisticsAuthorityContract();
const fulfillmentContract = logisticsFulfillmentBoundaryContract();
const shipmentContract = logisticsShipmentTrackingContract();
const proofReturnContract = logisticsProofReturnContract();
const courierContract = logisticsCourierAssignmentContract();
assert.equal(authority.core_order_authority, 'commerce');
assert.equal(fulfillmentContract.order_authority, authority.core_order_authority);
assert.equal(shipmentContract.shipment_authority, 'commerce_order');
assert.equal(proofReturnContract.order_authority, authority.core_order_authority);
assert.equal(courierContract.order_authority, authority.core_order_authority);
assert.equal(fulfillmentContract.fulfillment_authority, authority.fulfillment_lifecycle_authority);
assert.equal(shipmentContract.adapter_boundary, 'canonical_contract -> adapter -> provider');
assert.equal(courierContract.adapter_boundary, 'Canonical Contract → Adapter → Provider');
assert.equal(authority.duplicate_authority, false);
assert.equal(fulfillmentContract.duplicate_fulfillment_authority, false);
assert.equal(proofReturnContract.duplicate_inventory_authority, false);
assert.equal(courierContract.duplicate_fulfillment_authority, false);

// Route remains a semantic-only concept. Cross-feature hardening must not turn
// it into an operational authority.
assert.ok(LOGISTICS_PACK.domain_entities.includes('Route'));
assert.ok(LOGISTICS_PACK.capabilities.includes('logistics-routes'));
assert.deepEqual(LOGISTICS_PACK.routes, []);
assert.equal(LOGISTICS_AUTHORITY_MAP.logistics.route, 'logistics-pack');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logisticsDir = path.join(root, 'app/src/verticals/logistics');
const sourceFiles = fs.readdirSync(logisticsDir).filter(name => name.endsWith('.js'));
assert.equal(sourceFiles.some(name => /(^|[-_])route(s)?([-.]|$)/i.test(name)), false);
for (const name of sourceFiles) {
  const content = fs.readFileSync(path.join(logisticsDir, name), 'utf8');
  assert.doesNotMatch(content, /route[-_ ]?(engine|planner|optimizer)/i);
  assert.doesNotMatch(content, /maps?[-_ ]?(api|provider|sdk)/i);
  assert.doesNotMatch(content, /carrier[-_ ]?route/i);
}

// Production sources must not gain cross-feature persistence keys from this test.
const migration = fs.readFileSync(path.join(root, 'app/src/storage/migration.js'), 'utf8');
const constants = fs.readFileSync(path.join(root, 'app/src/constants.js'), 'utf8');
assert.doesNotMatch(migration, /route/i);
assert.doesNotMatch(constants, /route/i);

console.log('Phase 13.10.14 Logistics Cross-Feature Adversarial Regression: PASS');
