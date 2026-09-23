import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PLATFORM_EVENT_OUTBOX_CONTRACT_VERSION,
  listPlatformSupportedEventTypes,
  isPlatformSupportedEventType,
  buildPlatformVersionedEvent,
  enqueuePlatformVersionedEvent,
  assertPlatformEventOutboxBoundary,
  platformEventOutboxContract,
  definePlatformEventOutboxContract,
} from '../app/src/platform/event-outbox-platform.js';
import { isVersionedEvent } from '../app/src/events/event-boundary.js';

assert.equal(PLATFORM_EVENT_OUTBOX_CONTRACT_VERSION, '1.0');
assert.deepEqual(listPlatformSupportedEventTypes(), ['inventory.movement.record', 'customer.upsert']);
assert.equal(isPlatformSupportedEventType('inventory.movement.record'), true);
assert.equal(isPlatformSupportedEventType('orders.created'), false);

const event = buildPlatformVersionedEvent({
  eventId: 'platform:inventory:1',
  eventType: 'inventory.movement.record',
  aggregateType: 'inventory_movement',
  aggregateId: 'movement-1',
  organizationId: 'org-platform-16-7',
  payload: { productId: 'p1', quantity: 2 },
});
assert.equal(isVersionedEvent(event), true);
assert.equal(event.event_version, '1.0');

let captured = null;
const queued = enqueuePlatformVersionedEvent(event, (...args) => {
  captured = args;
  return { eventId: args[2].eventId, status: 'pending' };
});
assert.deepEqual(queued, { eventId: event.event_id, status: 'pending' });
assert.equal(captured[0], 'inventory.movement.record');
assert.equal(captured[2].eventId, event.event_id);

assert.throws(() => buildPlatformVersionedEvent({
  eventId: 'platform:orders:1', eventType: 'orders.created', aggregateType: 'order',
  aggregateId: 'o1', organizationId: 'org-1', payload: {},
}), (error) => error?.code === 'PLATFORM_EVENT_UNSUPPORTED');

assert.throws(() => enqueuePlatformVersionedEvent({ ...event, event_type: 'orders.created' }, () => {
  throw new Error('must not enqueue');
}), (error) => error?.code === 'PLATFORM_EVENT_UNSUPPORTED');

const contract = assertPlatformEventOutboxBoundary();
assert.equal(contract.version, '1.0');
assert.equal(contract.outbox_authority, 'app/src/sync/outbox.js#enqueueEvent');
assert.equal(contract.backend_consumer_authority, 'backend/lib/store-sqlite.js#processSyncEvent');
assert.deepEqual(contract.supported_event_types, ['inventory.movement.record', 'customer.upsert']);
assert.equal(contract.persistence, 'existing outbox and sync_events only');
assert.equal(contract.duplicate_event_store, false);
assert.equal(contract.duplicate_broker, false);
assert.equal(contract.duplicate_consumer_registry, false);
assert.equal(contract.duplicate_domain_authority, false);
assert.deepEqual(platformEventOutboxContract().canonical_event_contract, contract.canonical_event_contract);

assert.deepEqual(definePlatformEventOutboxContract({ name: 'safe', persistence: 'none' }).persistence, 'none');
assert.throws(() => definePlatformEventOutboxContract({ ownsEventStore: true }), /forbidden authority claim/);
assert.throws(() => definePlatformEventOutboxContract({ database: 'x' }), /storage/);
assert.throws(() => definePlatformEventOutboxContract({ broker: 'x' }), /event infrastructure/);

const source = fs.readFileSync(new URL('../app/src/platform/event-outbox-platform.js', import.meta.url), 'utf8');
assert.match(source, /buildVersionedEvent/);
assert.match(source, /enqueueVersionedEvent/);
assert.match(source, /app\/src\/sync\/outbox\.js#enqueueEvent/);
assert.match(source, /backend\/lib\/store-sqlite\.js#processSyncEvent/);
assert.doesNotMatch(source, /CREATE TABLE|DatabaseSync|new\s+(?:EventBus|EventStore|MessageBroker)/);
assert.doesNotMatch(source, /fetch\(/);

console.log('Phase 16.7 Event / Outbox Platformization Regression: PASS');
console.log('Canonical versioned event boundary: PASS');
console.log('Existing outbox authority preserved: PASS');
console.log('Existing backend consumer preserved: PASS');
console.log('Unsupported event types fail closed: PASS');
console.log('No duplicate event store / broker / consumer registry: PASS');
