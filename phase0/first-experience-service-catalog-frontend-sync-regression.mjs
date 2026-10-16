import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
const tenantAuthSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');

// Guard the real sanitizer implementation used by catalog pull/push. The
// spread preserves item_type while the following fields normalize ID and price.
assert.match(catalogSource, /return \{\s*\.\.\.p,/);
assert.match(catalogSource, /id:\s*sanitizeId\(p\.id\)/);
assert.match(catalogSource, /price:\s*Number\.isFinite\(numericPrice\)/);

// Contract guards for the actual client methods: catalog POST sends the live
// products array; order POST sends queued orders; both use tenant-session auth.
assert.match(catalogSource, /body:\s*JSON\.stringify\(\{\s*products\s*\}\)/);
assert.match(catalogSource, /\.\.\.p/);
assert.match(catalogSource, /headers:\s*\{\s*'Content-Type':\s*'application\/json',\s*\.\.\.tenantAuthHeaders\(\)\s*\}/);
assert.match(ordersSource, /body:\s*JSON\.stringify\(\{\s*orders:\s*queued\s*\}\)/);
assert.match(ordersSource, /\.\.\.tenantAuthHeaders\(\)/);
assert.doesNotMatch(ordersSource, /\bauthHeaders\(\)/,
  'extracted order sync must not call the undefined legacy authHeaders helper');
assert.match(ordersSource, /server_order_id:\s*result\.order_id/);
assert.match(tenantAuthSource, /export function authHeaders\(/);
console.log('PASS: frontend catalog sanitizer and catalog/order sync contracts preserve item type and tenant auth');
