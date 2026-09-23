import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const auth = fs.readFileSync(path.join(root, 'backend/lib/authorization.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'backend/lib/store-sqlite.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'app/src/authorization/role-catalog.js'), 'utf8');

assert.match(auth, /restaurant_waiter: new Set\(\[/);
assert.match(auth, /restaurant_kitchen_staff: new Set\(\[/);
assert.match(auth, /requiredPackForRole/);
assert.match(store, /assignMembershipContextualRole/);
assert.match(store, /Pack must be ACTIVE before assigning/);
assert.match(store, /restaurant_waiter.*restaurant_kitchen_staff/s);
assert.match(store, /pack_id = 'restaurant'/);
assert.match(store, /state = 'ACTIVE'/);
assert.match(server, /membership-contextual-role/);
assert.match(catalog, /restaurant_waiter/);
assert.match(catalog, /restaurant_kitchen_staff/);

const waiter = auth.slice(auth.indexOf('restaurant_waiter:'), auth.indexOf('restaurant_kitchen_staff:'));
assert.ok(waiter.includes('orders:create') && waiter.includes('tables:status'));
assert.ok(!waiter.includes('kitchen:manage'), 'waiter must not receive kitchen management');

const kitchen = auth.slice(auth.indexOf('restaurant_kitchen_staff:'), auth.indexOf('});', auth.indexOf('restaurant_kitchen_staff:')));
assert.ok(kitchen.includes('kitchen:manage') && kitchen.includes('orders:view'));
assert.ok(!kitchen.includes('payments:manage'), 'kitchen role must not receive payment management');

console.log('FUX-6 Restaurant contextual role regression: PASS');
