import assert from 'node:assert/strict';
import { buildCountryVersionedEvent, enqueueCountryVersionedEvent, countryEventIntegrationContract } from '../app/src/country-event-integration.js';

const event = buildCountryVersionedEvent({ countryCode: 'ET', eventId: 'country:1', eventType: 'inventory.movement.record', aggregateType: 'inventory', aggregateId: 'm1', organizationId: 'o1', payload: { quantity: 2 } });
assert.equal(event.metadata.country_code, 'ET');
let received = null;
const result = enqueueCountryVersionedEvent(event, { enqueue: (...args) => { received = args; return 'queued'; } });
assert.equal(result, 'queued');
assert.equal(received[0], 'inventory.movement.record');
assert.equal(received[2].eventId, 'country:1');
assert.throws(() => buildCountryVersionedEvent({ countryCode: 'US', eventId: 'x', eventType: 'x', aggregateType: 'x', aggregateId: '1', organizationId: 'o', payload: {} }));
const contract = countryEventIntegrationContract();
assert.equal(contract.persistence, 'existing outbox and sync_events only');
assert.equal(contract.duplicate_event_store, false);
console.log('Phase 14.11 Country Events / Outbox Regression: PASS');
