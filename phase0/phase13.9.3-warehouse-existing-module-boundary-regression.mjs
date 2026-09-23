import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const storage = new Map();
globalThis.localStorage = { getItem(k){ return storage.has(k) ? storage.get(k) : null; }, setItem(k,v){ storage.set(k,String(v)); }, removeItem(k){ storage.delete(k); } };
globalThis.window = globalThis;
globalThis.__APP_CONFIG__ = {};
globalThis.document = { getElementById(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){}, createElement(){ return { set textContent(v){ this._v=v; }, get innerHTML(){ return this._v || ''; } }; } };
Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: false });
const { WAREHOUSE_PACK, WAREHOUSE_BOUNDARY } = await import('../app/src/verticals/warehouse/pack.js');
const { WAREHOUSE_AUTHORITY_MAP, getWarehouseAuthority } = await import('../app/src/verticals/warehouse/authority-map.js');
const inventory = await import('../app/src/warehouse/inventory.js');
const ledger = await import('../app/src/warehouse/ledger.js');
const locations = await import('../app/src/warehouse/locations.js');
const ui = await import('../app/src/warehouse/ui.js');
const fulfillment = await import('../app/src/logistics/fulfillment.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 13.9.3 verifies the boundary against the actual existing modules.
// It does not introduce replacement implementations or mutate application state.
const expectedModules = {
  inventory: ['app/src/warehouse/inventory.js', ['isWarehouseEnabled', 'isStockTracked', 'applyStockChange']],
  ledger: ['app/src/warehouse/ledger.js', ['recordInventoryMovement', 'loadInventoryMovements', 'loadInventoryBalances', 'getInventoryBalance', 'localInventoryBalance']],
  locations: ['app/src/warehouse/locations.js', ['saveWarehouseLocations', 'addWarehouseLocation', 'removeWarehouseLocation', 'loadOrganizationLocations', 'getActiveOrganizationLocation', 'selectOrganizationLocation']],
  ui: ['app/src/warehouse/ui.js', ['applyWarehouseUI', 'switchWarehouseSubtab', 'renderWarehouseInventory', 'renderWarehouseReceiving', 'renderWarehouseTransactions', 'renderWarehouseLocationsList', 'openStockAdjustModal', 'saveStockAdjustModal', 'openReceiveModal', 'saveReceiveModal', 'renderCanonicalLocationSelect', 'selectWarehouseLocation']],
  fulfillment: ['app/src/logistics/fulfillment.js', ['isLogisticsEnabled', 'nextFulfillmentStatus', 'isFulfillmentFinal', 'advanceFulfillmentOrder']],
};

const modules = { inventory, ledger, locations, ui, fulfillment };
for (const [key, [relativePath, exports]] of Object.entries(expectedModules)) {
  const absolutePath = path.join(root, relativePath);
  assert(fs.existsSync(absolutePath), `missing existing module: ${relativePath}`);
  for (const name of exports) {
    assert.equal(typeof modules[key][name], 'function', `${relativePath} missing export ${name}()`);
  }
  assert.equal(WAREHOUSE_BOUNDARY.existing_modules[key], relativePath);
}

// Warehouse continues to own only its declared operational concepts.
assert.deepEqual(WAREHOUSE_PACK.domain_entities, ['StorageBin', 'Receiving', 'StockAdjustment']);
for (const forbidden of WAREHOUSE_BOUNDARY.forbidden_parallel_authorities) {
  assert(!WAREHOUSE_PACK.domain_entities.includes(forbidden), `parallel authority declared: ${forbidden}`);
}

// The authority map must resolve every Core-facing bridge declared by the boundary.
for (const concept of ['product', 'inventory_stock', 'inventory_movement', 'organization_location', 'order', 'customer', 'fulfillment', 'audit']) {
  assert(getWarehouseAuthority(concept), `missing authority entry: ${concept}`);
}
assert.equal(getWarehouseAuthority('storage_bin').owner, 'warehouse');
assert.equal(getWarehouseAuthority('inventory_stock').owner, 'inventory');
assert.equal(getWarehouseAuthority('inventory_movement').owner, 'inventory');
assert.equal(getWarehouseAuthority('organization_location').owner, 'locations');
assert.equal(getWarehouseAuthority('order').owner, 'commerce');
assert.equal(getWarehouseAuthority('fulfillment').owner, 'fulfillment');

// Existing implementation boundaries remain distinct: bins are not organization locations,
// and fulfillment remains outside the Warehouse module directory.
assert.notEqual(WAREHOUSE_BOUNDARY.existing_modules.locations, 'app/src/warehouse/organization-locations.js');
assert.equal(WAREHOUSE_BOUNDARY.existing_modules.fulfillment, 'app/src/logistics/fulfillment.js');
assert.equal(WAREHOUSE_AUTHORITY_MAP.length, 9);

console.log('Phase 13.9.3 Warehouse Existing Module Boundary Regression: PASS');
