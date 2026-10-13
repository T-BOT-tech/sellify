import fs from 'node:fs';
import assert from 'node:assert/strict';

const fulfillment = fs.readFileSync('app/src/logistics/fulfillment.js', 'utf8');

// Queueing records the requested canonical target without optimistically
// changing fulfillment_status.
assert.match(fulfillment, /order\.fulfillment_sync_status = 'queued';[\s\S]*?order\.fulfillment_sync_target = next;/);
assert.doesNotMatch(fulfillment, /order\.fulfillment_status\s*=\s*next/);

// A GET response for the previous state must not clear the queued marker.
// Reconciliation only confirms after the canonical state reaches the target.
assert.match(fulfillment, /const expectedStatus = String\(order\.fulfillment_sync_target \|\| nextFulfillmentStatus\(order\) \|\| ''\)\.toLowerCase\(\);[\s\S]*?const canonicalStatus = String\(data\.fulfillment\.status \|\| ''\)\.toLowerCase\(\);[\s\S]*?if \(!expectedStatus \|\| canonicalStatus !== expectedStatus\) continue;[\s\S]*?canonicalFulfillmentPatch\(order, data\.fulfillment\);[\s\S]*?delete order\.fulfillment_sync_target;[\s\S]*?delete order\.fulfillment_sync_reason;/);

console.log('PASS fulfillment queued-target reconciliation regression');
