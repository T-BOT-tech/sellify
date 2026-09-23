import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildVerticalVersionedEvent,
  enqueueVerticalVersionedEvent,
  verticalEventIntegrationContract,
} from '../app/src/verticals/event-integration.js';
import { isVersionedEvent } from '../app/src/events/event-boundary.js';

const packs = ['agriculture', 'restaurant', 'warehouse', 'logistics'];
for (const packId of packs) {
  const event = buildVerticalVersionedEvent({
    packId,
    eventId: `${packId}:inventory:movement:1`,
    eventType: 'inventory.movement.record',
    aggregateType: 'inventory_movement',
    aggregateId: `${packId}-movement-1`,
    organizationId: 'org-13-12-14',
    payload: { productId: 'p1', quantity: 1, movementType: 'adjustment' },
  });
  assert.equal(isVersionedEvent(event), true);
  assert.equal(event.metadata.pack_id, packId);
  assert.equal(event.organization_id, 'org-13-12-14');

  let captured = null;
  const queued = enqueueVerticalVersionedEvent(event, {
    enqueue: (...args) => {
      captured = args;
      return { eventId: args[2].eventId, status: 'pending' };
    },
  });
  assert.deepEqual(queued, { eventId: event.event_id, status: 'pending' });
  assert.equal(captured[0], 'inventory.movement.record');
  assert.equal(captured[2].eventId, event.event_id);
}

assert.throws(() => buildVerticalVersionedEvent({
  packId: 'unknown', eventId: 'unknown:1', eventType: 'inventory.movement.record',
  aggregateType: 'inventory_movement', aggregateId: 'm1', organizationId: 'org-1', payload: {},
}), /Unknown vertical pack/);

const unsupported = buildVerticalVersionedEvent({
  packId: 'logistics',
  eventId: 'logistics:return:1',
  eventType: 'logistics.return.transitioned',
  aggregateType: 'logistics_return',
  aggregateId: 'return-1',
  organizationId: 'org-13-12-14',
  payload: { order_id: 'order-1' },
});
assert.throws(
  () => enqueueVerticalVersionedEvent(unsupported, { enqueue: () => { throw new Error('must not enqueue'); } }),
  (error) => error?.code === 'VERTICAL_EVENT_UNSUPPORTED',
);

const source = fs.readFileSync(new URL('../app/src/verticals/event-integration.js', import.meta.url), 'utf8');
assert.match(source, /buildVersionedEvent/);
assert.match(source, /enqueueVersionedEvent/);
assert.match(source, /app\/src\/sync\/outbox\.js/);
assert.doesNotMatch(source, /CREATE TABLE|DatabaseSync|new\s+(?:EventBus|EventStore|MessageBroker)/);
assert.doesNotMatch(source, /fetch\(/);
assert.doesNotMatch(source, /authorize\(/);

const contract = verticalEventIntegrationContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.outbox_authority, 'app/src/sync/outbox.js#enqueueEvent');
assert.equal(contract.backend_consumer_authority, 'backend/lib/store-sqlite.js#processSyncEvent');
assert.deepEqual(contract.supported_packs, packs);
assert.deepEqual(contract.currently_supported_backend_event_types, ['inventory.movement.record', 'customer.upsert']);
assert.equal(contract.unsupported_event_behavior, 'fail_closed_until_backend_consumer_exists');
assert.equal(contract.duplicate_event_store, false);
assert.equal(contract.duplicate_consumer_registry, false);
assert.equal(contract.duplicate_domain_authority, false);

console.log('Phase 13.12.14 Events / Outbox Integration Regression: PASS');
console.log('Four vertical pack boundaries: PASS');
console.log('Canonical versioned event envelope: PASS');
console.log('Existing outbox handoff: PASS');
console.log('Unsupported event types fail closed: PASS');
console.log('Existing backend consumer boundary preserved: PASS');
console.log('No duplicate event / broker / consumer authority: BLOCKED');
console.log('No event authorization evaluator introduced: BLOCKED');
