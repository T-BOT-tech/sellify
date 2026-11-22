import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const packageJson = JSON.parse(read('package.json'));

const requiredScripts = [
  'phase13.9.1:warehouse-boundary-test',
  'test:phase13.9.2',
  'test:phase13.9.3',
  'test:phase13.9.4',
  'test:phase13.9.5',
  'test:phase13.9.6',
  'test:phase13.9.7',
  'test:phase13.9.8',
  'test:phase13.9.9',
];
for (const script of requiredScripts) assert.equal(typeof packageJson.scripts[script], 'string', `Missing Warehouse regression script: ${script}`);

const currentSources = [
  ['app/src/warehouse/inventory.js', ['applyStockChange', 'projectedStock']],
  ['app/src/warehouse/ledger.js', ['recordCanonicalInventoryMovement', 'getInventoryBalance']],
  ['app/src/warehouse/locations.js', ['loadOrganizationLocations', 'selectOrganizationLocation']],
  ['app/src/warehouse/ui.js', ['applyWarehouseUI', 'renderWarehouseInventory']],
  ['app/src/logistics/fulfillment.js', ['transitionDeliveryAssignmentForOrder']],
];
for (const [rel, names] of currentSources) {
  const source = read(rel);
  for (const name of names) {
    const pattern = new RegExp('export\\s+(?:async\\s+)?function\\s+' + name + '\\s*\\(');
    assert.match(source, pattern, `Current canonical interface missing: ${rel}#${name}`);
  }
}

const requiredProduction = [
  'app/src/verticals/warehouse/pack.js',
  'app/src/verticals/warehouse/authority-map.js',
  'app/src/verticals/warehouse/inventory-bridge.js',
  'app/src/verticals/warehouse/location-bridge.js',
  'app/src/verticals/warehouse/fulfillment-boundary.js',
  'app/src/verticals/warehouse/receiving-contract.js',
  'app/src/verticals/warehouse/stock-adjustment-contract.js',
  'app/src/verticals/warehouse/config-contract.js',
];
const forbidden = ['WarehouseOrder','WarehouseInventory','WarehouseProduct','WarehousePayment','WarehouseCustomer','WarehouseLocation','WarehouseFulfillment','WarehouseLedger'];
for (const rel of requiredProduction) {
  const source = read(rel);
  for (const token of forbidden) {
    const declaration = new RegExp('(?:export\\s+)?(?:const|let|var|class|function)\\s+' + token + '\\b');
    assert(!declaration.test(source), `${rel} declares forbidden parallel authority ${token}`);
  }
}

assert.equal(packageJson.engines?.node, '>=24');
assert.equal(packageJson.scripts['test:phase13.9.10'], 'node phase0/phase13.9.10-warehouse-targeted-regression.mjs');
console.log('Phase 13.9.10 Current Warehouse Targeted Regression: PASS');
console.log('Current canonical Warehouse interfaces: PASS');
console.log('Warehouse regression aliases retained and exercised by the enclosing cumulative gate: PASS');
console.log('Duplicate Core authority declarations: BLOCKED');
