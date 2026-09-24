import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fulfillment = await readFile(path.join(root, 'app/src/logistics/fulfillment.js'), 'utf8');
const ui = await readFile(path.join(root, 'app/src/logistics/ui.js'), 'utf8');

assert.match(fulfillment, /enqueueCommand/);
assert.match(fulfillment, /\/tenants\/.*orders\/.*\/fulfillment/);
assert.match(fulfillment, /['"]Idempotency-Key['"]/);
assert.match(fulfillment, /server_order_id/);
assert.match(fulfillment, /navigator\.onLine/);
assert.match(fulfillment, /queueFulfillmentCommand/);
assert.match(fulfillment, /canonicalFulfillmentPatch/);
assert.doesNotMatch(fulfillment, /applyStockChange/);
assert.doesNotMatch(fulfillment, /saveJSON\(STORAGE_KEYS\.orders, orders\);\s*renderLogistics\(\);\s*$/m, 'local terminal mutation must not be the authority');
assert.match(ui, /advanceFulfillmentOrder/);

console.log('FUX-44 frontend fulfillment authority regression: 8 PASS');
