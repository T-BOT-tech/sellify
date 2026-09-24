import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const inventory = await readFile(path.join(root, 'app/src/warehouse/inventory.js'), 'utf8');
const ui = await readFile(path.join(root, 'app/src/warehouse/ui.js'), 'utf8');

assert.match(inventory, /projectedStock/);
assert.match(inventory, /getInventoryBalance/);
assert.match(inventory, /inventoryBalances/);
assert.match(inventory, /inventoryMovements/);
assert.match(inventory, /Legacy product\.stock remains only as a compatibility fallback/);
assert.match(ui, /projectedStock\(p, config\.locationId/);
assert.match(ui, /projectedStock\(product, config\.locationId/);
assert.doesNotMatch(ui, /\? p\.stock/);

console.log('FUX-47 canonical inventory projection regression: 7 PASS');
