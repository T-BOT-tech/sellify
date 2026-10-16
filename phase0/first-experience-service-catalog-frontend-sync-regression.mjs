import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const catalogSource = await readFile(new URL('../app/src/sync/catalog.js', import.meta.url), 'utf8');
const ordersSource = await readFile(new URL('../app/src/sync/orders.js', import.meta.url), 'utf8');
const tenantAuthSource = await readFile(new URL('../app/src/auth/tenant.js', import.meta.url), 'utf8');

// Runtime-check the real sanitizer used by catalog pull and push. It must not
// discard item_type when normalizing remote product prices and IDs.
const { sanitizeRemoteProducts } = await import('../app/src/sync/catalog.js');
const sanitized = sanitizeRemoteProducts([
  { id: 'svc-client', name: 'Consultation', price: 25000, item_type: 'service' },
  { id: 'prd-client', name: 'Soap', price: 5000, item_type: 'product' },
]);
assert.equal(sanitized.find(p => p.id === 'svc-client').item_type, 'service');
assert.equal(sanitized.find(p => p.id === 'prd-client').item_type, 'product');

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
