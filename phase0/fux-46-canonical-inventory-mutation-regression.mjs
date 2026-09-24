import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const ui = await readFile(path.join(root, 'app/src/warehouse/ui.js'), 'utf8');
const ledger = await readFile(path.join(root, 'app/src/warehouse/ledger.js'), 'utf8');

assert.match(ui, /recordCanonicalInventoryMovement/);
assert.match(ui, /movementType: 'ADJUSTMENT'/);
assert.match(ui, /movementType: 'PURCHASE'/);
assert.doesNotMatch(ui, /applyStockChange\(/);
assert.match(ledger, /\/inventory\/movements/);
assert.match(ledger, /inventory\.movement\.record/);
assert.match(ledger, /queued: true/);
assert.match(ledger, /Authorization:.*sessionToken/);

console.log('FUX-46 canonical inventory mutation regression: 7 PASS');
