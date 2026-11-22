import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const forbidden = [
  'WarehouseOrder', 'WarehouseInventory', 'WarehouseProduct', 'WarehousePayment',
  'WarehouseCustomer', 'WarehouseLocation', 'WarehouseFulfillment', 'WarehouseLedger',
];
const productionSources = [
  'app/src/verticals/warehouse/pack.js',
  'app/src/verticals/warehouse/authority-map.js',
  'app/src/verticals/warehouse/inventory-bridge.js',
  'app/src/verticals/warehouse/location-bridge.js',
  'app/src/verticals/warehouse/fulfillment-boundary.js',
  'app/src/verticals/warehouse/receiving-contract.js',
  'app/src/verticals/warehouse/stock-adjustment-contract.js',
  'app/src/verticals/warehouse/config-contract.js',
];
for (const rel of productionSources) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const token of forbidden) {
    const declaration = new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${token}\\b`);
    assert(!declaration.test(text), `${rel} declares forbidden parallel authority ${token}`);
  }
}

const checks = [
  ['13.9.1 Current Warehouse Pack Boundary', 'node:phase13.9.1-current'],
  ['13.9.2 Warehouse Authority Map', 'test:phase13.9.2'],
  ['13.9.3 Current Existing Module Boundary', 'node:phase13.9.3-current'],
  ['13.9.4 Inventory Bridge', 'test:phase13.9.4'],
  ['13.9.5 Location Bridge', 'test:phase13.9.5'],
  ['13.9.6 Fulfillment Boundary', 'test:phase13.9.6'],
  ['13.9.7 Receiving Contract', 'test:phase13.9.7'],
  ['13.9.8 Stock Adjustment Contract', 'test:phase13.9.8'],
  ['13.9.9 Configuration', 'test:phase13.9.9'],
];
for (const [label, script] of checks) {
  const directNodePath = {
    'node:phase13.9.1-current': 'phase0/phase13.9.1-current-warehouse-pack-boundary-regression.mjs',
    'node:phase13.9.3-current': 'phase0/phase13.9.3-current-warehouse-existing-module-boundary-regression.mjs',
  }[script] || null;
  const result = spawnSync(
    directNodePath ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm'),
    directNodePath ? [directNodePath] : ['run', script],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 13.9.10 Targeted Regression: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 13.9.10 targeted check: PASS — ${label}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.engines?.node, '>=24');
assert.equal(packageJson.scripts['test:phase13.9.10'], 'node phase0/phase13.9.10-warehouse-targeted-regression.mjs');

console.log('Phase 13.9.10 Warehouse Targeted Regression: PASS');
console.log(`Observed runtime: ${process.version}`);
console.log('Node >=24 remains a declared release requirement; runtime certification is deferred to Phase 13.9.14.');
