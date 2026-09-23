import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  buildPhysicalCommerceSpine,
  isPhysicalCommerceSpine,
  physicalCommerceSpineContract,
} from '../app/src/verticals/physical-commerce/spine-contract.js';

const deliveryOrder = {
  id: 'ORDER-13.11.3-DELIVERY',
  organization_id: 'org-physical-1',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  delivery_address: 'Bole',
  scheduled_time: '2026-09-08T18:00',
  shipment_id: 'SHIP-13.11.3',
  tracking_reference: 'TRK-13.11.3',
  fulfillment_proof: { type: 'photo', ref: 'proof-13.11.3' },
  stock_deducted: true,
};

const spine = buildPhysicalCommerceSpine(deliveryOrder, { organizationId: 'org-physical-1' });
assert.equal(isPhysicalCommerceSpine(spine), true);
assert.equal(spine.spine_id, 'physical-order:ORDER-13.11.3-DELIVERY');
assert.equal(spine.order.authority, 'commerce');
assert.equal(spine.fulfillment.status, 'delivered');
assert.equal(spine.fulfillment.mutation_authority, 'app/src/logistics/fulfillment.js');
assert.equal(spine.warehouse.role, 'consume_and_integrate');
assert.equal(spine.warehouse.stock_deducted, true);
assert.equal(spine.warehouse.stock_mutation_authority, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(spine.warehouse.dispatch_boundary, 'semantic_only');
assert.equal(spine.logistics.role, 'coordinate_and_project');
assert.equal(spine.logistics.shipment_id, 'SHIP-13.11.3');
assert.equal(spine.logistics.tracking_reference, 'TRK-13.11.3');
assert.equal(spine.final, true);
assert.equal(spine.persistence, 'none');
assert.equal(spine.idempotency, 'physical-order:ORDER-13.11.3-DELIVERY');
assert.equal(spine.dispatch.implemented, false);
assert.equal(spine.dispatch.authority, null);

const pickupOrder = {
  id: 'ORDER-13.11.3-PICKUP',
  organizationId: 'org-physical-1',
  fulfillment_type: 'pickup',
  fulfillment_status: 'ready_for_pickup',
  pickup_location: 'Main Store',
  stock_deducted: false,
};
const pickupSpine = buildPhysicalCommerceSpine(pickupOrder, { organizationId: 'org-physical-1' });
assert.equal(pickupSpine.final, false);
assert.equal(pickupSpine.fulfillment.status, 'ready_for_pickup');
assert.equal(pickupSpine.warehouse.stock_deducted, false);
assert.equal(pickupSpine.logistics.fulfillment_status, 'ready_for_pickup');

// Organization isolation: a caller cannot project a Core Order into another
// organization's physical flow.
assert.throws(
  () => buildPhysicalCommerceSpine(deliveryOrder, { organizationId: 'org-other' }),
  /different organization/
);

// Cross-reference isolation: the projection cannot mix lifecycle states from
// separate sources because every context is derived from the same Order.
const statusConflictOrder = { ...deliveryOrder, fulfillment_status: 'out_for_delivery' };
const conflictSpine = buildPhysicalCommerceSpine(statusConflictOrder, { organizationId: 'org-physical-1' });
assert.equal(conflictSpine.fulfillment.status, 'out_for_delivery');
assert.equal(conflictSpine.warehouse.fulfillment_status, 'out_for_delivery');
assert.equal(conflictSpine.logistics.fulfillment_status, 'out_for_delivery');

const contract = physicalCommerceSpineContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.organization_scope, 'Core Order organization_id / organizationId');
assert.equal(contract.idempotency_key, 'physical-order:<core-order-id>');
assert.equal(contract.event_behavior, 'projection_only; no event publication');
assert.equal(contract.dispatch_authority, null);
assert.equal(contract.dispatch_implemented, false);
assert.equal(contract.duplicate_order_authority, false);
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.duplicate_logistics_authority, false);
assert.equal(contract.persistence, 'none');

// Architectural guard: Phase 13.11.3 must not introduce a second physical
// lifecycle, dispatch engine, or cross-pack god service.
const source = fs.readFileSync(new URL('../app/src/verticals/physical-commerce/spine-contract.js', import.meta.url), 'utf8');
for (const forbidden of ['PhysicalCommerceOrder', 'PhysicalCommerceFulfillment', 'WarehouseDispatch', 'PhysicalCommerceOrchestrator', 'RouteEngine']) {
  assert.doesNotMatch(source, new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${forbidden}\\b`), `Forbidden authority declared: ${forbidden}`);
}

console.log('Phase 13.11.3 Physical Commerce Spine: PASS');
console.log('Canonical Order -> Fulfillment -> Warehouse integration -> Logistics projection: PASS');
console.log('Organization isolation: PASS');
console.log('No duplicate physical authority / dispatch implementation: PASS');
