import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCountryVersionedEvent, enqueueCountryVersionedEvent, countryEventIntegrationContract } from '../app/src/country-event-integration.js';
import { isVersionedEvent } from '../app/src/events/event-boundary.js';

for (const eventType of ['inventory.movement.record', 'customer.upsert']) {
  const event = buildCountryVersionedEvent({
    countryCode: 'ET',
    eventId: `ET:test:${eventType.replaceAll('.', '-')}:1`,
    eventType,
    aggregateType: eventType === 'customer.upsert' ? 'customer' : 'inventory_movement',
    aggregateId: 'et-test-1',
    organizationId: 'org-et-1',
    payload: { countryCode: 'ET' },
  });
  assert.equal(isVersionedEvent(event), true);
  assert.equal(event.metadata.country_code, 'ET');
  let captured = null;
  const result = enqueueCountryVersionedEvent(event, {
    enqueue: (...args) => { captured = args; return { eventId: args[2].eventId, status: 'pending' }; },
  });
  assert.deepEqual(result, { eventId: event.event_id, status: 'pending' });
  assert.equal(captured[0], event.event_type);
}

assert.throws(() => buildCountryVersionedEvent({
  countryCode: 'US', eventId: 'US:test:1', eventType: 'customer.upsert',
  aggregateType: 'customer', aggregateId: 'c1', organizationId: 'org-1', payload: {},
}), /Unsupported country|Unknown country/);

const unsupported = buildCountryVersionedEvent({
  countryCode: 'ET', eventId: 'ET:test:unsupported:1', eventType: 'payment.country.initiated',
  aggregateType: 'payment', aggregateId: 'p1', organizationId: 'org-et-1', payload: {},
});
assert.throws(() => enqueueCountryVersionedEvent(unsupported, { enqueue: () => { throw new Error('must not enqueue'); } }),
  error => error?.code === 'COUNTRY_EVENT_UNSUPPORTED');

const source = fs.readFileSync(new URL('../app/src/country-event-integration.js', import.meta.url), 'utf8');
assert.match(source, /buildVersionedEvent/);
assert.match(source, /enqueueVersionedEvent/);
assert.doesNotMatch(source, /CREATE TABLE|DatabaseSync|EventBus|EventStore|MessageBroker/);
assert.doesNotMatch(source, /fetch\(/);

const contract = countryEventIntegrationContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.country_code, 'ET');
assert.equal(contract.outbox_authority, 'app/src/sync/outbox.js#enqueueEvent');
assert.equal(contract.backend_consumer_authority, 'backend/lib/store-sqlite.js#processSyncEvent');
assert.deepEqual(contract.currently_supported_backend_event_types, ['inventory.movement.record', 'customer.upsert']);
assert.equal(contract.unsupported_event_behavior, 'fail_closed_until_backend_consumer_exists');
assert.equal(contract.duplicate_event_store, false);
assert.equal(contract.duplicate_consumer_registry, false);
assert.equal(contract.duplicate_country_domain_authority, false);

console.log('Phase 14.12 Ethiopia Integration Regression: PASS');
console.log('ET country identity on canonical event envelope: PASS');
console.log('Existing outbox/backend consumer boundary preserved: PASS');
console.log('Unsupported event types fail closed: PASS');
console.log('No country event store/broker/consumer authority: BLOCKED');
