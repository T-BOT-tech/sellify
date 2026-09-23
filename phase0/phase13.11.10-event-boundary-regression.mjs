import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildVersionedEvent,
  isVersionedEvent,
  toOutboxEvent,
  enqueueVersionedEvent,
  eventBoundaryContract,
} from '../app/src/events/event-boundary.js';

const event = buildVersionedEvent({
  eventId: 'fulfillment:order-13-11-10:delivered',
  eventType: 'fulfillment.status.changed',
  aggregateType: 'order',
  aggregateId: 'order-13-11-10',
  organizationId: 'org-13-11-10',
  payload: { order_id: 'order-13-11-10', status: 'delivered' },
  correlationId: 'corr-13-11-10',
  causationId: 'command-13-11-10',
  idempotencyKey: 'fulfillment:order-13-11-10:delivered',
  metadata: { source: 'core-fulfillment' },
  occurredAt: '2026-09-08T16:00:00.000Z',
});

assert.equal(isVersionedEvent(event), true);
assert.equal(event.event_version, '1.0');
assert.equal(event.event_version_number, 1);
assert.equal(event.organization_id, 'org-13-11-10');
assert.equal(event.idempotency_key, 'fulfillment:order-13-11-10:delivered');

const outbox = toOutboxEvent(event);
assert.equal(outbox.eventId, event.event_id);
assert.equal(outbox.eventType, event.event_type);
assert.equal(outbox.aggregateType, 'order');
assert.equal(outbox.aggregateId, event.aggregate_id);
assert.equal(outbox.payload._event.event_version, '1.0');
assert.equal(outbox.payload._event.organization_id, event.organization_id);
assert.equal(outbox.payload._event.idempotency_key, event.idempotency_key);

let captured = null;
const queued = enqueueVersionedEvent(event, (...args) => {
  captured = args;
  return { eventId: args[2].eventId, status: 'pending' };
});
assert.deepEqual(queued, { eventId: event.event_id, status: 'pending' });
assert.equal(captured[0], event.event_type);
assert.equal(captured[2].eventId, event.event_id);
assert.equal(captured[2].aggregateType, event.aggregate_type);
assert.equal(captured[2].aggregateId, event.aggregate_id);

assert.throws(() => buildVersionedEvent({
  eventId: '', eventType: 'test', aggregateType: 'order', aggregateId: 'o1',
  organizationId: 'org-a', payload: {},
}), /event_id must be a non-empty string/);
assert.throws(() => buildVersionedEvent({
  eventId: 'event-1', eventType: 'test', aggregateType: 'order', aggregateId: 'o1',
  organizationId: 'org-a', payload: [],
}), /payload must be an object/);
assert.throws(() => toOutboxEvent({ event_id: 'bad' }), /Valid versioned event/);
assert.throws(() => enqueueVersionedEvent(event), /Existing outbox enqueue capability/);

const source = fs.readFileSync(new URL('../app/src/events/event-boundary.js', import.meta.url), 'utf8');
assert.match(source, /Transaction → Outbox → Versioned Event → Consumer/);
assert.match(source, /app\/src\/sync\/outbox\.js#enqueueEvent/);
assert.match(source, /backend\/lib\/store-sqlite\.js#processSyncEvent/);
assert.doesNotMatch(source, /CREATE TABLE|DatabaseSync|fetch\(/);
assert.doesNotMatch(source, /new\s+(?:EventBus|EventStore|MessageBroker)/);
assert.doesNotMatch(source, /product\.stock\s*=/);

const contract = eventBoundaryContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.flow, 'Transaction → Outbox → Versioned Event → Consumer');
assert.equal(contract.outbox_authority, 'app/src/sync/outbox.js#enqueueEvent');
assert.equal(contract.backend_event_authority, 'backend/lib/store-sqlite.js#processSyncEvent');
assert.equal(contract.duplicate_event_store, false);
assert.equal(contract.duplicate_domain_authority, false);
assert.equal(contract.persistence, 'existing outbox and sync_events only');

console.log('Phase 13.11.10 Event Boundary Regression: PASS');
console.log('Versioned event envelope: PASS');
console.log('Existing Outbox compatibility bridge: PASS');
console.log('Organization / aggregate / idempotency identity: PASS');
console.log('No new event store / broker / consumer authority: BLOCKED');
console.log('Existing backend sync_events authority preserved: PASS');
console.log('No direct domain persistence or stock mutation: BLOCKED');
