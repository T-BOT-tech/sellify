import assert from 'node:assert/strict';
import fs from 'node:fs';
import { eventReplayFingerprint, decideEventReplay } from '../backend/lib/event-replay.js';

const incoming = {
  organizationId: 'org-13-11-11',
  eventType: 'fulfillment.status.changed',
  aggregateType: 'order',
  aggregateId: 'order-13-11-11',
  payload: {
    order_id: 'order-13-11-11',
    status: 'delivered',
    _event: { event_version: '1.0', idempotency_key: 'fulfillment:order-13-11-11:delivered' },
  },
};

const existing = {
  event_id: 'fulfillment:order-13-11-11:delivered',
  organization_id: incoming.organizationId,
  event_type: incoming.eventType,
  aggregate_type: incoming.aggregateType,
  aggregate_id: incoming.aggregateId,
  payload_json: JSON.stringify(incoming.payload),
  status: 'processed',
};

assert.equal(decideEventReplay(null, incoming).decision, 'new');
assert.equal(decideEventReplay(existing, incoming).decision, 'duplicate');
assert.equal(decideEventReplay(existing, {
  ...incoming,
  payload: { ...incoming.payload, status: 'cancelled' },
}).decision, 'conflict');
assert.equal(decideEventReplay(existing, {
  ...incoming,
  organizationId: 'org-other',
}).decision, 'conflict');

const reordered = {
  organizationId: incoming.organizationId,
  eventType: incoming.eventType,
  aggregateType: incoming.aggregateType,
  aggregateId: incoming.aggregateId,
  payload: {
    _event: { idempotency_key: 'fulfillment:order-13-11-11:delivered', event_version: '1.0' },
    status: 'delivered',
    order_id: 'order-13-11-11',
  },
};
assert.equal(eventReplayFingerprint(incoming), eventReplayFingerprint(reordered));

const source = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(source, /BEGIN IMMEDIATE/);
assert.match(source, /decideEventReplay\(existing/);
assert.match(source, /EVENT_ID_REUSED/);
assert.match(source, /different event payload/);
assert.match(source, /replay: true/);

const helper = fs.readFileSync(new URL('../backend/lib/event-replay.js', import.meta.url), 'utf8');
assert.match(helper, /sha256/);
assert.match(helper, /canonicalize/);
assert.doesNotMatch(helper, /CREATE TABLE|DatabaseSync|INSERT INTO|UPDATE .*sync_events/);

console.log('Phase 13.11.11 Idempotency / Replay Regression: PASS');
console.log('First-seen event accepted: PASS');
console.log('Exact replay recognized as duplicate: PASS');
console.log('Same event_id with different payload rejected: PASS');
console.log('Cross-organization event_id reuse rejected: PASS');
console.log('Key-order-independent fingerprint: PASS');
console.log('Existing sync_events remains persistence authority: PASS');
console.log('No duplicate replay store / broker introduced: BLOCKED');
