import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const start = store.indexOf('export async function transitionOrderFulfillment(');
const end = store.indexOf('export function coreFulfillmentContract()', start);
assert.ok(start >= 0 && end > start, 'canonical fulfillment transition must remain discoverable');
const transition = store.slice(start, end);

const fingerprintStart = transition.indexOf('const commandFingerprint = crypto.createHash');
const fingerprintEnd = transition.indexOf("if (!CORE_FULFILLMENT_TRANSITIONS[type])", fingerprintStart);
assert.ok(fingerprintStart >= 0 && fingerprintEnd > fingerprintStart, 'command fingerprint must remain explicit');
const fingerprint = transition.slice(fingerprintStart, fingerprintEnd);
assert.doesNotMatch(fingerprint, /orderJson\.(delivery_address|pickup_location|scheduled_time|tracking_reference|fulfillment_proof)/,
  'durable fulfillment command identity must not depend on mutable order fallback values');
assert.match(fingerprint, /destination: input\.destination === undefined \? null : input\.destination/,
  'explicit destination intent must remain part of the command identity');
assert.match(fingerprint, /proof: input\.proof === undefined \? null : input\.proof/,
  'explicit proof intent must remain part of the command identity');

const freshFingerprintStart = transition.indexOf('const freshCommandFingerprint = crypto.createHash');
const freshFingerprintEnd = transition.indexOf("if (freshCommandFingerprint !== commandFingerprint)", freshFingerprintStart);
assert.ok(freshFingerprintStart >= 0 && freshFingerprintEnd > freshFingerprintStart, 'fresh command fingerprint must remain explicit');
const freshFingerprint = transition.slice(freshFingerprintStart, freshFingerprintEnd);
assert.doesNotMatch(freshFingerprint, /freshOrderJson\.(delivery_address|pickup_location|scheduled_time|tracking_reference|fulfillment_proof)/,
  'fresh replay validation must not reinterpret omitted mutable order fields');
assert.match(transition, /const priorCommand = db\.prepare\([\s\S]*?FROM fulfillment_commands/,
  'fulfillment replay must consult durable command history');
assert.ok(transition.indexOf('const priorCommand = db.prepare') < freshFingerprintStart,
  'durable replay must happen before fresh mutable-state validation');

const consequenceStart = store.indexOf('function applyCoreFulfillmentInventoryConsequence(');
const consequenceEnd = store.indexOf('export async function ', consequenceStart + 30);
assert.ok(consequenceStart >= 0 && consequenceEnd > consequenceStart, 'canonical inventory consequence must remain discoverable');
const consequence = store.slice(consequenceStart, consequenceEnd);
assert.match(consequence, /const eventId = `fulfillment-sale:\$\{fulfillmentRow\.id\}:\$\{productId\}`/,
  'inventory event identity must remain stable per fulfillment and product');
assert.match(consequence, /SELECT \* FROM inventory_movements WHERE event_id = \?/,
  'inventory movement replay must resolve by stable event identity');
assert.match(consequence, /FULFILLMENT_INVENTORY_REPLAY_CONFLICT/,
  'event identity collisions with different intent must fail closed');
assert.match(consequence, /String\(existing\.organization_id\) === String\(fulfillmentRow\.organization_id\)/,
  'inventory replay must enforce tenant organization scope');
assert.match(consequence, /String\(existing\.location_id\) === locationId/,
  'inventory replay must enforce location matching');
assert.match(consequence, /Number\(existing\.quantity\) === -quantity/,
  'inventory replay must enforce aggregated quantity matching');
assert.ok(consequence.indexOf('SELECT * FROM inventory_movements WHERE event_id = ?')
  < consequence.indexOf('FULFILLMENT_INSUFFICIENT_INVENTORY'),
  'replay must be resolved before stock validation');
assert.match(store, /event_id TEXT NOT NULL UNIQUE/,
  'database uniqueness must prevent duplicate inventory movements');

console.log('GAP-2 inventory exactly-once regression: PASS');
console.log('Stable fulfillment command identity across mutable order edits: PASS');
console.log('Replay-before-stock validation and tenant/location/quantity matching: PASS');
console.log('Duplicate movement prevention through stable unique event identity: PASS');
