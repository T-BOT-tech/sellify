import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const home = await readFile(path.join(root, 'app/src/ui/home.js'), 'utf8');
const inventory = await readFile(path.join(root, 'app/src/warehouse/inventory.js'), 'utf8');
const warehouse = await readFile(path.join(root, 'app/src/warehouse/ui.js'), 'utf8');
const main = await readFile(path.join(root, 'app/src/main.js'), 'utf8');
const bridge = await readFile(path.join(root, 'app/src/window-bridge.js'), 'utf8');

assert.match(home, /getLowStockProducts\(\)\.length/);
assert.match(home, /getOutOfStockProducts\(\)\.length/);
assert.match(home, /onclick="openLowStockInventory\(\)"/);
assert.doesNotMatch(home, /Number\(p\.stock\)/, 'Home must not invent its own stock projection');
assert.match(inventory, /stock <= \(p\.reorder_point \|\| 0\)/, 'Existing reorder-point rule stays authoritative');
assert.match(inventory, /stock > 0/, 'Low stock excludes zero stock');
assert.match(warehouse, /inventoryFilter === 'low' \? low : products/);
assert.match(warehouse, /projectedStock\(p, config\.locationId/);
assert.match(warehouse, /recordCanonicalInventoryMovement\(/, 'Stock adjustments/receipts must use canonical inventory movements');
assert.match(warehouse, /movementType: 'PURCHASE'/, 'Receipt flow remains a canonical purchase movement');
assert.match(main, /openLowStockInventory, clearInventoryFilter/);
assert.match(bridge, /openLowStockInventory, clearInventoryFilter/);

console.log('J5 canonical low-stock journey regression: 12 PASS');
