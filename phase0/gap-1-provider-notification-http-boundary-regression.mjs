import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
const start = source.indexOf('async function handlePaymentProviderNotification');
const end = source.indexOf('async function handlePaymentProviderMetadata', start);

assert.ok(start >= 0, 'provider notification handler must exist');
assert.ok(end > start, 'provider notification handler boundary must be discoverable');

const handler = source.slice(start, end);

assert.match(handler, /notificationPaymentCore\.ingestProviderNotification\(/);
assert.doesNotMatch(handler, /provider\.authenticateNotification\(/);
assert.doesNotMatch(handler, /provider\.parseEvidence\(/);
assert.doesNotMatch(handler, /notificationPaymentCore\.submitEvidence\(/);
assert.doesNotMatch(handler, /resolved\.paymentIntent/);
assert.doesNotMatch(handler, /paymentIntentId:/);
assert.doesNotMatch(handler, /organizationId:/);
assert.doesNotMatch(handler, /locationId:/);

console.log('GAP-1 provider notification HTTP boundary regression: PASS');
