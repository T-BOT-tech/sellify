import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFile(path.join(root, relative), 'utf8');
const [home, inventory, warehouse, main, bridge, ci, pkg] = await Promise.all([
  read('app/src/ui/home.js'),
  read('app/src/warehouse/inventory.js'),
  read('app/src/warehouse/ui.js'),
  read('app/src/main.js'),
  read('app/src/window-bridge.js'),
  read('.github/workflows/ci.yml'),
  read('package.json'),
]);

assert.match(home, /getLowStockProducts\(\)\.length/);
assert.match(home, /getOutOfStockProducts\(\)\.length/);
assert.match(home, /onclick="openLowStockInventory\(\)"/);
assert.doesNotMatch(home, /Number\(p\.stock\)/, 'Home must not invent its own stock projection');
assert.match(inventory, /stock <= \(p\.reorder_point \|\| 0\)/, 'Existing reorder-point rule stays authoritative');
assert.match(inventory, /stock > 0/, 'Low stock excludes zero stock');
assert.match(warehouse, /inventoryFilter === 'low' \? low : physicalProducts/);
assert.match(warehouse, /projectedStock\(p, config\.locationId/);
assert.match(warehouse, /recordCanonicalInventoryMovement\(/, 'Stock adjustments/receipts must use canonical inventory movements');
assert.match(warehouse, /movementType: 'PURCHASE'/, 'Receipt flow remains a canonical purchase movement');
assert.match(main, /openLowStockInventory, clearInventoryFilter/);
assert.match(bridge, /openLowStockInventory, clearInventoryFilter/);
assert.match(ci, /npm run test:j5-canonical-low-stock-journey/);
assert.match(pkg, /"test:j5-canonical-low-stock-journey": "node phase0\/j5-canonical-low-stock-journey-regression\.mjs"/);

console.log('J5 canonical low-stock journey regression: 14 PASS');
