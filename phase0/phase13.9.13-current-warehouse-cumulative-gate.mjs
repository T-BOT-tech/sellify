import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();
const canonicalSources = {
  inventory: 'app/src/warehouse/inventory.js',
  ledger: 'app/src/warehouse/ledger.js',
  locations: 'app/src/warehouse/locations.js',
  ui: 'app/src/warehouse/ui.js',
  fulfillment: 'app/src/logistics/fulfillment.js',
};
const source = Object.fromEntries(Object.entries(canonicalSources).map(([key, rel]) => {
  const full = path.join(root, rel);
  assert.equal(fs.existsSync(full), true, `Canonical source missing: ${rel}`);
  return [key, fs.readFileSync(full, 'utf8')];
}));
const currentAuthorityAnchors = [
  [source.inventory, /export\s+(?:async\s+)?function applyStockChange\(/, 'Inventory mutation interface missing'],
  [source.inventory, /export\s+(?:async\s+)?function projectedStock\(/, 'Inventory projection interface missing'],
  [source.ledger, /export\s+(?:async\s+)?function recordCanonicalInventoryMovement\(/, 'Canonical inventory movement interface missing'],
  [source.ledger, /export\s+(?:async\s+)?function getInventoryBalance\(/, 'Inventory balance projection interface missing'],
  [source.locations, /export\s+(?:async\s+)?function loadOrganizationLocations\(/, 'Organization location loading interface missing'],
  [source.locations, /export\s+(?:async\s+)?function selectOrganizationLocation\(/, 'Organization location selection interface missing'],
  [source.ui, /export\s+(?:async\s+)?function applyWarehouseUI\(/, 'Warehouse UI boundary missing'],
  [source.ui, /export\s+(?:async\s+)?function renderWarehouseInventory\(/, 'Warehouse inventory projection missing'],
  [source.fulfillment, /export\s+(?:async\s+)?function transitionDeliveryAssignmentForOrder\(/, 'Canonical fulfillment transition interface missing'],
];
for (const [content, pattern, message] of currentAuthorityAnchors) assert.match(content, pattern, message);


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
    console.error(`Phase 13.9.13 Current Cumulative Gate: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 13.9.13 cumulative check: PASS — ${label}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.engines?.node, '>=24');
assert.equal(packageJson.scripts['test:phase13.9.13'], 'node phase0/phase13.9.13-warehouse-cumulative-gate.mjs');

console.log('Phase 13.9.13 Current Warehouse Cumulative Gate: PASS');
console.log(`Observed runtime: ${process.version}`);
console.log('Node >=24 remains a declared release requirement; runtime certification is deferred to Phase 13.9.14.');
