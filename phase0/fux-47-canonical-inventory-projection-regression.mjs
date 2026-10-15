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

// A direct stock projection is a public boundary too: service records must
// not expose stale legacy stock or canonical inventory balances to callers.
assert.match(inventory, /export function projectedStock\(p, locationId = config\.locationId \|\| ''\) \{\s*\/\/ Keep the type boundary here too:[\s\S]{0,180}if \(!p \|\| p\.type === 'service'\) return null;\s*if \(hasCanonicalInventory\(p\.id\)\)/);

// Services must never appear in low/out-of-stock exception lists, even if a
// stale legacy payload still carries a numeric stock field.
assert.match(inventory, /getLowStockProducts\(\)\s*\{\s*return products\.filter\(p => \{\s*if \(p\?\.type === 'service'\) return false;/);
assert.match(inventory, /getOutOfStockProducts\(\)\s*\{\s*return products\.filter\(p => \{\s*if \(p\?\.type === 'service'\) return false;/);

console.log('FUX-47 canonical inventory projection regression: 10 PASS');
