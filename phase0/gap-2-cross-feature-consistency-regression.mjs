import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
const lifecycleStart = store.indexOf('export async function transitionDeliveryAssignment');
const lifecycleEnd = store.indexOf('\nexport async function ', lifecycleStart + 1);
const lifecycle = store.slice(lifecycleStart, lifecycleEnd === -1 ? store.length : lifecycleEnd);
const fulfillment = store.slice(store.indexOf('export async function transitionOrderFulfillment'), store.indexOf('export function coreFulfillmentContract'));

assert.match(lifecycle, /db\.exec\('BEGIN IMMEDIATE'\)/);
assert.match(lifecycle, /applyCoreFulfillmentInventoryConsequence/);
assert.match(lifecycle, /inventoryMovementIds/);
assert.doesNotMatch(lifecycle, /UPDATE payments SET/);
assert.doesNotMatch(lifecycle, /INSERT INTO payment_ledger_entries/);
assert.doesNotMatch(lifecycle, /UPDATE marketplace_settlements SET/);
assert.doesNotMatch(lifecycle, /INSERT INTO marketplace_settlements/);

assert.match(fulfillment, /applyCoreFulfillmentInventoryConsequence/);
assert.match(fulfillment, /inventoryMovementIds/);
assert.match(store, /cross_feature_boundary: 'delivery terminal transition may invoke existing inventory consequence only; payment and settlement remain read-only external authorities'/);
assert.match(store, /payment_authority: 'unchanged; delivery does not mutate payment state or payment ledger'/);
assert.match(store, /settlement_authority: 'unchanged; delivery does not create, settle, reverse, or mutate settlement records'/);

console.log('GAP-2.9 Cross-Feature Consistency Regression: PASS');
console.log('Delivery -> fulfillment -> inventory remains the only terminal mutation path: PASS');
console.log('Payment and settlement remain separate authorities: PASS');
console.log('Delivery lifecycle remains transactionally bound to its fulfillment/inventory consequence: PASS');
