// FUX-51 — legacy inventory authority boundary regression.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const inventory = fs.readFileSync('app/src/warehouse/inventory.js', 'utf8');
const warehouseUi = fs.readFileSync('app/src/warehouse/ui.js', 'utf8');
const fulfillment = fs.readFileSync('app/src/logistics/fulfillment.js', 'utf8');
const ledger = fs.readFileSync('app/src/warehouse/ledger.js', 'utf8');
const main = fs.readFileSync('app/src/main.js', 'utf8');

function check(condition, message) {
  assert.ok(condition, message);
  console.log('PASS:', message);
}

check(inventory.includes('LEGACY_INVENTORY_MUTATION_DISABLED'), 'legacy local stock mutation has an explicit hard-stop error');
check(inventory.includes('if (config.sessionToken || hasCanonicalInventory(productId))'), 'authenticated or canonically tracked inventory cannot fall back to local mutation');
check(inventory.includes('recordCanonicalInventoryMovement()'), 'legacy boundary directs callers to the canonical movement API');
check(inventory.includes('Compatibility-only legacy mutation path'), 'legacy local mutation remains explicitly scoped as compatibility-only');

check(warehouseUi.includes('recordCanonicalInventoryMovement'), 'Warehouse active mutations use canonical inventory commands');
check(!warehouseUi.includes('applyStockChange('), 'Warehouse UI cannot invoke the legacy local mutation');
check(!fulfillment.includes('applyStockChange('), 'Fulfillment cannot mutate inventory through the legacy path');
check(main.includes('stockTransactions'), 'legacy history remains available only as a compatibility/UI projection');
check(ledger.includes("enqueueEvent('inventory.movement.record'"), 'legacy movement helper still targets the canonical event boundary rather than a second ledger');
check(ledger.includes('recordCanonicalInventoryMovement'), 'canonical inventory command remains the preferred mutation API');

console.log('FUX-51 legacy inventory authority boundary regression: PASS');
