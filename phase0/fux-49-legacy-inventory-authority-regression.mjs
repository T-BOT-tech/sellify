import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = {
  inventory: await readFile(path.join(root, 'app/src/warehouse/inventory.js'), 'utf8'),
  ledger: await readFile(path.join(root, 'app/src/warehouse/ledger.js'), 'utf8'),
  ui: await readFile(path.join(root, 'app/src/warehouse/ui.js'), 'utf8'),
  state: await readFile(path.join(root, 'app/src/state.js'), 'utf8'),
};

assert.match(files.inventory, /Compatibility-only legacy mutation path/);
assert.match(files.inventory, /recordCanonicalInventoryMovement/);
assert.doesNotMatch(files.ui, /applyStockChange\s*\(/);
assert.doesNotMatch(files.ui, /recordInventoryMovement\s*\(/);
assert.doesNotMatch(files.ui, /stockTransactions\.(unshift|push|splice)/);
assert.match(files.ledger, /recordCanonicalInventoryMovement/);
assert.match(files.ledger, /inventory\/movements/);
assert.match(files.ledger, /syncStatus: 'synced'/);
assert.match(files.state, /inventoryMovements/);
assert.match(files.state, /stockTransactions/);
assert.match(files.state, /compatibility\/UI history/);

console.log('FUX-49 legacy inventory authority regression: 10 PASS');