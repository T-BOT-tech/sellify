import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ui = await readFile(path.join(root, 'app/src/warehouse/ui.js'), 'utf8');
const ledger = await readFile(path.join(root, 'app/src/warehouse/ledger.js'), 'utf8');

assert.match(ui, /inventoryMovements/);
assert.match(ui, /loadInventoryMovements/);
assert.match(ui, /canonicalTxItemMarkup/);
assert.match(ui, /movementType/);
assert.match(ui, /syncStatus/);
assert.match(ui, /stockTransactions/);
assert.match(ui, /legacy/);
assert.match(ledger, /loadInventoryMovements/);
assert.match(ledger, /\/inventory\/movements\?/);
assert.match(ledger, /byEvent/);
assert.match(ledger, /syncStatus: 'synced'/);

console.log('FUX-48 canonical warehouse history regression: 10 PASS');
