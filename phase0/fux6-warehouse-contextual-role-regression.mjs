import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const auth = fs.readFileSync(path.join(root, 'backend/lib/authorization.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'backend/lib/store-sqlite.js'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'app/src/authorization/role-catalog.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');

for (const role of ['warehouse_receiving','warehouse_picker_packer','warehouse_inventory_staff']) {
  assert.match(auth, new RegExp(`${role}: new Set\\(\\[`));
  assert.match(auth, new RegExp(`${role}: 'warehouse'`));
  assert.match(store, new RegExp(role));
  assert.match(catalog, new RegExp(role));
}
assert.match(store, /requiredPack = normalizedRole\.startsWith\('warehouse_'\) \? 'warehouse' : normalizedRole\.startsWith\('restaurant_'\) \? 'restaurant' : null/);
assert.match(store, /pack_id = \?/);
assert.match(store, /state !== 'ACTIVE'/);
assert.match(server, /membership-contextual-role/);

const receiving = auth.slice(auth.indexOf('warehouse_receiving:'), auth.indexOf('warehouse_picker_packer:'));
assert.ok(receiving.includes('inventory:add'));
assert.ok(receiving.includes('inventory:view'));
assert.ok(!receiving.includes('inventory:edit'));

const picker = auth.slice(auth.indexOf('warehouse_picker_packer:'), auth.indexOf('warehouse_inventory_staff:'));
assert.ok(picker.includes('inventory:view'));
assert.ok(!picker.includes('inventory:add'));

const inventory = auth.slice(auth.indexOf('warehouse_inventory_staff:'), auth.indexOf('});', auth.indexOf('warehouse_inventory_staff:')));
assert.ok(inventory.includes('inventory:add') && inventory.includes('inventory:edit'));

console.log('FUX-6 Warehouse contextual role regression: PASS');
