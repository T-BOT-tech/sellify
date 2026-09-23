import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const locked = {
  'app/src/warehouse/inventory.js': 'ee5799eab8a22a53d6a98756caf32ae013fbd995c3c3501d371615790b5940b9',
  'app/src/warehouse/ledger.js': 'd6206c4f42d53f86e625b63956445d73babfd78f55b61de9c90985a95884b9d8',
  'app/src/warehouse/locations.js': 'fd3d7bfd253775177130acff2feb3de2667a6bbb0009f1a20735662d12ca9eeb',
  'app/src/warehouse/ui.js': '23b82bcb252e70187b246e710a1e4057f5da586b3f9705b99244d9a9462ab9e9',
  'app/src/logistics/fulfillment.js': 'cdfbd8acad71f936175fa2ed94a94b375e2452184807ff18f00422012737a7c6',
};

for (const [rel, expected] of Object.entries(locked)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  assert.equal(actual, expected, `Locked source changed: ${rel}`);
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
  'app/src/verticals/warehouse/adversarial-contract.js',
  'app/src/verticals/warehouse/legacy-bin-compatibility.js',
];
for (const rel of requiredProduction) {
  assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing production contract: ${rel}`);
}

const forbidden = [
  'WarehouseOrder', 'WarehouseInventory', 'WarehouseProduct', 'WarehousePayment',
  'WarehouseCustomer', 'WarehouseLocation', 'WarehouseFulfillment', 'WarehouseLedger',
];
for (const rel of requiredProduction) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const token of forbidden) {
    const declaration = new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${token}\\b`);
    assert(!declaration.test(text), `${rel} declares forbidden parallel authority ${token}`);
  }
}

const checks = [
  ['13.9.1 Warehouse Pack Boundary', 'phase13.9.1:warehouse-boundary-test'],
  ['13.9.2 Warehouse Authority Map', 'test:phase13.9.2'],
  ['13.9.3 Existing Module Boundary', 'test:phase13.9.3'],
  ['13.9.4 Inventory Bridge', 'test:phase13.9.4'],
  ['13.9.5 Location Bridge', 'test:phase13.9.5'],
  ['13.9.6 Fulfillment Boundary', 'test:phase13.9.6'],
  ['13.9.7 Receiving Contract', 'test:phase13.9.7'],
  ['13.9.8 Stock Adjustment Contract', 'test:phase13.9.8'],
  ['13.9.9 Configuration', 'test:phase13.9.9'],
  ['13.9.10 Targeted Regression', 'test:phase13.9.10'],
  ['13.9.11 Adversarial / Idempotency / Isolation', 'test:phase13.9.11'],
  ['13.9.12 Legacy Bin Compatibility', 'test:phase13.9.12'],
];

for (const [label, script] of checks) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 13.9.13 Cumulative Gate: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 13.9.13 cumulative check: PASS — ${label}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.engines?.node, '>=24');
assert.equal(packageJson.scripts['test:phase13.9.13'], 'node phase0/phase13.9.13-warehouse-cumulative-gate.mjs');

console.log('Phase 13.9.13 Warehouse Cumulative Phase 13.9 Gate: PASS');
console.log(`Observed runtime: ${process.version}`);
console.log('Node >=24 remains a declared release requirement; runtime certification is deferred to Phase 13.9.14.');
