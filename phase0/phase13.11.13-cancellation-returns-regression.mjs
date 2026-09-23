import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildCancellationHandoff,
  buildReturnHandoff,
  transitionReturnHandoff,
  buildCancellationReturnContext,
  buildCancellationReturnEvent,
  isCancellationReturnContext,
  cancellationReturnContract,
} from '../app/src/verticals/logistics/cancellation-return-contract.js';
import { eventBoundaryContract, isVersionedEvent } from '../app/src/events/event-boundary.js';

const order = {
  id: 'ORDER-13.11.13-1',
  organization_id: 'ORG-13.11.13',
  location_id: 'LOC-13.11.13',
  status: 'confirmed',
  fulfillment_type: 'delivery',
  fulfillment_status: 'delivered',
  stock_deducted: true,
};

const cancellation = buildCancellationHandoff({
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
  reason: 'customer_request',
});
assert.equal(cancellation.kind, 'cancellation');
assert.equal(cancellation.mutation_authority, 'commerce');
assert.equal(cancellation.fulfillment_mutation_authority, null);
assert.equal(cancellation.inventory_mutation, 'none');

assert.throws(
  () => buildCancellationHandoff({ order, organizationId: 'OTHER-ORG', locationId: order.location_id }),
  /different organization/
);
assert.throws(
  () => buildCancellationHandoff({ order, organizationId: order.organization_id, locationId: 'OTHER-LOC' }),
  /different location/
);

const requested = buildReturnHandoff({
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
  logisticsReturn: {
    id: 'RET-13.11.13-1',
    order_id: order.id,
    status: 'requested',
    reason: 'damaged_item',
  },
});
assert.equal(requested.return.status, 'requested');
assert.equal(requested.return_authority, 'logistics-pack');
assert.equal(requested.inventory_authority, 'inventory');
assert.equal(requested.inventory_mutation, 'explicit_injected_capability_only');

const approved = transitionReturnHandoff({
  current: requested.return,
  nextStatus: 'approved',
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
});
assert.equal(approved.return.status, 'approved');
assert.equal(approved.return.replay, false);

const transit = transitionReturnHandoff({
  current: approved.return,
  nextStatus: 'in_transit',
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
});
const received = transitionReturnHandoff({
  current: transit.return,
  nextStatus: 'received',
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
});
assert.equal(received.return.status, 'received');
assert.equal(received.terminal, true);
assert.equal(received.inventory_disposition_required, true);

assert.throws(() => transitionReturnHandoff({
  current: received.return,
  nextStatus: 'cancelled',
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
}), /Invalid return transition/);

const unified = buildCancellationReturnContext({
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
  cancellation: { reason: 'customer_request' },
  logisticsReturn: requested.return,
});
assert.equal(isCancellationReturnContext(unified), true);
assert.equal(unified.fulfillment.order.order_id, order.id);
assert.equal(unified.fulfillment.fulfillment.status, 'delivered');
assert.equal(unified.cancellation.order_id, order.id);
assert.equal(unified.return.return.order_id, order.id);
assert.equal(unified.authorities.fulfillment, 'app/src/logistics/fulfillment.js');
assert.equal(unified.authorities.return, 'logistics-pack');
assert.equal(unified.authorities.inventory, 'inventory');
assert.equal(unified.duplicate_return_authority, false);
assert.equal(unified.dispatch.implemented, false);
assert.equal(unified.route_implementation, false);

assert.throws(() => buildReturnHandoff({
  order,
  organizationId: order.organization_id,
  locationId: order.location_id,
  logisticsReturn: { id: 'RET-WRONG', order_id: 'OTHER-ORDER', status: 'requested' },
}), /does not reference the Core Order/);

const event = buildCancellationReturnEvent({
  handoff: received,
  eventId: 'logistics:return:13.11.13:1',
  correlationId: order.id,
  causationId: 'logistics:return:13.11.13:requested',
});
assert.equal(isVersionedEvent(event), true);
assert.equal(event.event_type, 'logistics.return.transitioned');
assert.equal(event.aggregate_type, 'logistics_return');
assert.equal(event.aggregate_id, received.return.id);
assert.equal(event.organization_id, order.organization_id);
assert.equal(event.idempotency_key, event.event_id);
assert.equal(event.metadata.publish_supported, false);

const contract = cancellationReturnContract();
assert.equal(contract.cancellation_authority, 'commerce');
assert.equal(contract.return_authority, 'logistics-pack');
assert.equal(contract.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(contract.inventory_authority, 'inventory');
assert.equal(contract.return_received_stock_behavior, 'explicit_injected_capability_only');
assert.equal(contract.event_envelope_authority, 'app/src/events/event-boundary.js');
assert.equal(contract.event_publication, 'not_supported_by_current_backend_handlers');
assert.equal(contract.duplicate_return_authority, false);
assert.equal(contract.dispatch_implemented, false);
assert.equal(contract.route_implementation, false);

const eventContract = eventBoundaryContract();
assert.equal(eventContract.persistence, 'existing outbox and sync_events only');

const source = fs.readFileSync(new URL('../app/src/verticals/logistics/cancellation-return-contract.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /product\.stock\s*=|applyStockChange\(/);
assert.doesNotMatch(source, /CREATE TABLE|INSERT INTO|UPDATE |DELETE FROM/);
assert.match(source, /buildUnifiedFulfillmentContext/);
assert.match(source, /buildVersionedEvent/);

const proofReturn = fs.readFileSync(new URL('../app/src/verticals/logistics/proof-return-contract.js', import.meta.url), 'utf8');
assert.match(proofReturn, /return_transition_authority: 'logistics-pack'/);
assert.match(proofReturn, /stock_authority: 'inventory'/);

const unifiedSource = fs.readFileSync(new URL('../app/src/logistics/unified-fulfillment-contract.js', import.meta.url), 'utf8');
assert.match(unifiedSource, /fulfillment_authority: 'app\/src\/logistics\/fulfillment\.js'/);
assert.match(unifiedSource, /duplicate_fulfillment_authority: false/);

const backendStore = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(backendStore, /eventType === 'inventory\.movement\.record'/);
assert.match(backendStore, /eventType === 'customer\.upsert'/);
assert.doesNotMatch(backendStore, /eventType === 'logistics\.return\.transitioned'/);

console.log('Phase 13.11.13 Cancellation / Returns Regression: PASS');
console.log('Cancellation remains Core Commerce-owned: PASS');
console.log('Logistics Return workflow remains Logistics-owned: PASS');
console.log('Unified Fulfillment continuity preserved: PASS');
console.log('Organization / location isolation: PASS');
console.log('Return received requires explicit Inventory disposition: PASS');
console.log('No direct Return stock mutation / persistence: BLOCKED');
console.log('Versioned event envelope compatibility: PASS');
console.log('Unsupported backend return-event publication: BLOCKED');
console.log('Dispatch / route implementation: BLOCKED');
