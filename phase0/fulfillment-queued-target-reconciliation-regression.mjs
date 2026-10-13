import fs from 'node:fs';
import assert from 'node:assert/strict';

const fulfillment = fs.readFileSync('app/src/logistics/fulfillment.js', 'utf8');

// Queueing records the requested canonical target without optimistically
// changing fulfillment_status.
assert.match(fulfillment, /order\.fulfillment_sync_status = 'queued';[\s\S]*?order\.fulfillment_sync_target = next;/);
assert.doesNotMatch(fulfillment, /order\.fulfillment_status\s*=\s*next/);

// A GET response for the previous state must not clear the queued marker.
// A canonical state later than the queued target may clear it, but only on
// the same valid delivery/pickup progression.
assert.match(fulfillment, /function hasReachedFulfillmentTarget\(type, canonicalStatus, targetStatus\)[\s\S]*?return targetIndex >= 0 && currentIndex >= targetIndex;/);
assert.match(fulfillment, /if \(!hasReachedFulfillmentTarget\(data\.fulfillment\.fulfillment_type \|\| order\.fulfillment_type, canonicalStatus, expectedStatus\)\) continue;[\s\S]*?canonicalFulfillmentPatch\(order, data\.fulfillment\);[\s\S]*?delete order\.fulfillment_sync_target;[\s\S]*?delete order\.fulfillment_sync_reason;/);

console.log('PASS fulfillment queued-target reconciliation regression');
