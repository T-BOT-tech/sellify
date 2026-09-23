import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const required = [
  'app/src/restaurant/tables.js',
  'app/src/restaurant/kitchen.js',
  'app/src/products/modifiers.js',
  'app/src/verticals/restaurant/pack.js',
  'app/src/verticals/restaurant/table-integration.js',
  'app/src/verticals/restaurant/kitchen-integration.js',
  'app/src/verticals/restaurant/recipe-ingredient-bridge.js',
  'app/src/verticals/restaurant/inventory-consumption.js',
  'app/src/verticals/restaurant/order-payment-compatibility.js',
];
for (const rel of required) assert(fs.existsSync(path.join(root, rel)), `Missing required source: ${rel}`);

const forbidden = [
  'RestaurantOrder',
  'RestaurantInventory',
  'RestaurantPayment',
  'RestaurantCustomer',
  'RestaurantLocation',
  'RestaurantFulfillment',
];
const productionSources = [
  'app/src/verticals/restaurant/table-integration.js',
  'app/src/verticals/restaurant/kitchen-integration.js',
  'app/src/verticals/restaurant/recipe-ingredient-bridge.js',
  'app/src/verticals/restaurant/inventory-consumption.js',
  'app/src/verticals/restaurant/order-payment-compatibility.js',
];
for (const rel of productionSources) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  for (const token of forbidden) {
    const declaration = new RegExp(`(?:export\\s+)?(?:const|let|var|class|function)\\s+${token}\\b`);
    assert(!declaration.test(text), `${rel} declares forbidden parallel authority ${token}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(packageJson.scripts['phase13.8.7:restaurant-regression'], 'node phase0/phase13.8.7-restaurant-regression-gate.mjs');
assert.equal(packageJson.engines.node, '>=24');

const checks = [
  ['Phase 13.8.1 Restaurant Pack Boundary', 'phase13.8.1:restaurant-boundary-test'],
  ['Phase 13.8.2 Restaurant Tables Integration', 'phase13.8.2:restaurant-tables-test'],
  ['Phase 13.8.3 Restaurant Kitchen Integration', 'phase13.8.3:restaurant-kitchen-test'],
  ['Phase 13.8.4 Restaurant Recipe / Ingredient Bridge', 'phase13.8.4:restaurant-recipe-test'],
  ['Phase 13.8.5 Restaurant Inventory Consumption', 'phase13.8.5:restaurant-inventory-test'],
  ['Phase 13.8.6 Restaurant Order / Payment Compatibility', 'phase13.8.6:restaurant-order-payment-test'],
  ['Phase 12.8 Physical Commerce Regression Gate', 'phase12.8:regression-gate'],
];
for (const [label, script] of checks) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    console.error(`Phase 13.8.7 Restaurant Regression Gate: FAIL — ${label}`);
    process.exit(result.status || 1);
  }
  console.log(`Phase 13.8.7 gate check: PASS — ${label}`);
}

console.log('Phase 13.8.7 Restaurant Pack Regression Gate: PASS');
console.log(`Verified runtime: ${process.version}`);
console.log('Supported release runtime remains Node >=24; this gate does not override that requirement.');
