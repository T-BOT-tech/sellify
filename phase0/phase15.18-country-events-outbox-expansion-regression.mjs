import assert from 'node:assert/strict';
import {
  buildExpandedCountryVersionedEvent,
  enqueueExpandedCountryVersionedEvent,
  countryEventExpansionStatus,
  countryEventExpansionContract,
} from '../app/src/country-event-expansion.js';

assert.equal(countryEventExpansionStatus('ET'), 'active_country_pack');
assert.equal(countryEventExpansionStatus('KE'), 'active_country_pack');
assert.equal(countryEventExpansionStatus('TZ'), 'active_country_pack');
assert.equal(countryEventExpansionStatus('NG'), 'active_country_pack');
assert.equal(countryEventExpansionStatus('GH'), 'strategic_candidate');
assert.equal(countryEventExpansionStatus('ZM'), 'strategic_candidate');
assert.equal(countryEventExpansionStatus('UG'), 'regional_country_boundary_only');
assert.equal(countryEventExpansionStatus('US'), 'unknown');

const event = buildExpandedCountryVersionedEvent({
  countryCode: 'TZ',
  eventId: 'country:tz:1',
  eventType: 'inventory.movement.record',
  aggregateType: 'inventory',
  aggregateId: 'movement-1',
  organizationId: 'org-1',
  payload: { quantity: 3 },
});
assert.equal(event.metadata.country_code, 'TZ');
assert.equal(event.event_version, '1.0');

let received = null;
const result = enqueueExpandedCountryVersionedEvent(event, {
  enqueue: (...args) => { received = args; return 'queued'; },
});
assert.equal(result, 'queued');
assert.equal(received[0], 'inventory.movement.record');
assert.equal(received[2].eventId, 'country:tz:1');

assert.throws(
  () => buildExpandedCountryVersionedEvent({
    countryCode: 'GH', eventId: 'candidate:1', eventType: 'customer.upsert',
    aggregateType: 'customer', aggregateId: 'c1', organizationId: 'o1', payload: {},
  }),
  (error) => error.code === 'COUNTRY_EVENT_COUNTRY_INACTIVE'
);

assert.throws(
  () => enqueueExpandedCountryVersionedEvent({ ...event, event_type: 'made.up.event' }, { enqueue: () => 'no' }),
  (error) => error.code === 'COUNTRY_EVENT_UNSUPPORTED'
);

const contract = countryEventExpansionContract();
assert.equal(contract.eventEnvelopeAuthority, 'app/src/events/event-boundary.js');
assert.equal(contract.outboxAuthority, 'app/src/sync/outbox.js#enqueueEvent');
assert.equal(contract.backendConsumerAuthority, 'backend/lib/store-sqlite.js#processSyncEvent');
assert.equal(contract.persistence, 'existing outbox and sync_events only');
assert.equal(contract.ownsEventStore, false);
assert.equal(contract.ownsOutbox, false);
assert.equal(contract.ownsConsumerRegistry, false);
assert.equal(contract.ownsRegionalEventAuthority, false);
assert.equal(contract.failClosed, true);

console.log('Phase 15.18 Country Events / Outbox Expansion Regression: PASS');
