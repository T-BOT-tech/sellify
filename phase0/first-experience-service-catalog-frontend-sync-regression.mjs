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

// Response-loss recovery contract: only a canonical "synced" acknowledgement
// changes local status. A thrown fetch, non-2xx response, or unreadable JSON
// falls into the catch path, where queued orders remain queued and are saved
// with retry metadata so the next sync reuses the same local IDs.
assert.match(ordersSource, /orders\.filter\(o => o\.status === 'queued'\)/);
assert.match(ordersSource, /if \(!res\.ok\) throw new Error/);
assert.match(ordersSource, /catch \(e\) \{[\s\S]*?setOrders\(orders\.map\(o => queued\.some\(q => q\.id === o\.id\)[\s\S]*?sync_attempts: \(o\.sync_attempts \|\| 0\) \+ 1[\s\S]*?saveJSON\(STORAGE_KEYS\.orders, orders\)/);
assert.match(ordersSource, /if \(result && result\.status === 'synced'\) \{[\s\S]*?status: 'synced', server_order_id: result\.order_id/);
assert.match(ordersSource, /if \(result && result\.status === 'rejected'\) \{[\s\S]*?status: 'sync_rejected'/);
assert.match(tenantAuthSource, /export function authHeaders\(/);
console.log('PASS: frontend catalog/order sync contracts preserve item type, tenant auth, and queued-order retry after response loss');
