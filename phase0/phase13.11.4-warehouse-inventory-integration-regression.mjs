import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildWarehouseInventoryReceiveHandoff,
  buildWarehouseInventoryAdjustmentHandoff,
  executeWarehouseInventoryHandoff,
  isWarehouseInventoryHandoff,
  warehouseInventoryContract,
} from '../app/src/verticals/warehouse/inventory-contract.js';

const orgA = 'org-a';
const orgB = 'org-b';
const productA = { id: 'p-1', organization_id: orgA, name: 'Rice' };
const productB = { id: 'p-2', organization_id: orgB, name: 'Oil' };
const locationA = { id: 'loc-a', organization_id: orgA, type: 'WAREHOUSE', status: 'active' };
const locationB = { id: 'loc-b', organization_id: orgB, type: 'WAREHOUSE', status: 'active' };

const receiving = {
  id: 'recv-1', organization_id: orgA, product_id: 'p-1', quantity: 5,
  event_id: 'evt-recv-1', batch_number: 'B-1', storage_bin: 'BIN-1',
};
const adjustment = {
  id: 'adj-1', organization_id: orgA, product_id: 'p-1', delta: -2,
  event_id: 'evt-adj-1', notes: 'cycle count',
};

const receive = buildWarehouseInventoryReceiveHandoff({ receiving, product: productA, location: locationA });
const adjust = buildWarehouseInventoryAdjustmentHandoff({ adjustment, product: productA, location: locationA });

assert.equal(receive.operation, 'receive');
assert.equal(receive.quantity, 5);
assert.equal(receive.movement_type, 'received');
assert.equal(receive.reference_type, 'warehouse_receiving');
assert.equal(receive.reference_id, 'recv-1');
assert.equal(receive.event_id, 'evt-recv-1');
assert.equal(adjust.quantity, -2);
assert.equal(adjust.movement_type, 'adjusted');
assert.equal(adjust.reference_type, 'warehouse_stock_adjustment');
assert.equal(adjust.event_id, 'evt-adj-1');
assert.equal(isWarehouseInventoryHandoff(receive), true);
assert.equal(isWarehouseInventoryHandoff(adjust), true);

assert.throws(() => buildWarehouseInventoryReceiveHandoff({ receiving, product: productB, location: locationA }), /different organization/);
assert.throws(() => buildWarehouseInventoryAdjustmentHandoff({ adjustment, product: productA, location: locationB }), /different organization/);
assert.throws(() => buildWarehouseInventoryReceiveHandoff({ receiving: { ...receiving, product_id: 'p-other' }, product: productA, location: locationA }), /must reference/);
assert.throws(() => buildWarehouseInventoryAdjustmentHandoff({ adjustment: { ...adjustment, delta: 0 }, product: productA, location: locationA }), /finite non-zero/);

const calls = [];
const recordCanonicalInventoryMovement = async input => {
  calls.push(input);
  return { queued: false, movement: { eventId: input.eventId } };
};
const confirmed = await executeWarehouseInventoryHandoff(receive, { recordCanonicalInventoryMovement });
assert.equal(confirmed.status, 'confirmed');
assert.equal(confirmed.queued, false);
assert.equal(confirmed.event_id, 'evt-recv-1');
const adjusted = await executeWarehouseInventoryHandoff(adjust, { recordCanonicalInventoryMovement });
assert.equal(adjusted.status, 'confirmed');
assert.equal(calls.length, 2);
assert.equal(calls[0].productId, 'p-1');
assert.equal(calls[0].quantity, 5);
assert.equal(calls[0].movementType, 'PURCHASE');
assert.equal(calls[0].eventId, 'evt-recv-1');
assert.equal(calls[0].referenceId, 'recv-1');
assert.equal(calls[0].locationId, 'loc-a');
assert.equal(calls[1].movementType, 'ADJUSTMENT');
assert.equal(calls[1].quantity, -2);

const queued = await executeWarehouseInventoryHandoff(receive, {
  async recordCanonicalInventoryMovement() { return { queued: true, movement: null }; },
});
assert.equal(queued.status, 'pending', 'queued Inventory movement must not be reported as confirmed');

const contract = warehouseInventoryContract();
assert.equal(contract.stock_authority, 'inventory');
assert.equal(contract.mutation_authority, 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement');
assert.equal(contract.ledger_authority, 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement');
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.duplicate_ledger_authority, false);
assert.equal(contract.direct_stock_mutation_by_warehouse, false);

const source = fs.readFileSync(path.join(process.cwd(), 'app/src/verticals/warehouse/inventory-contract.js'), 'utf8');
assert(!/product\.stock\s*=/.test(source), 'Integration contract must not mutate product.stock directly');
assert(!/\bnew\s+(?:Inventory|WarehouseInventory)\b/.test(source), 'Integration contract must not instantiate a second Inventory authority');
assert(!/WarehouseInventory\s*=/.test(source), 'Integration contract must not declare WarehouseInventory authority');

console.log('Phase 13.11.4 Warehouse ↔ Inventory Integration Regression: PASS');
console.log('Warehouse workflow semantics remain Warehouse-owned: PASS');
console.log('Core Product remains Commerce-owned: PASS');
console.log('Core stock mutation remains Inventory-owned: PASS');
console.log('Core movement ledger remains Inventory-owned: PASS');
console.log('Organization isolation: PASS');
console.log('Event identity / replay handoff: PASS');
console.log('Direct Warehouse stock mutation: BLOCKED');
console.log('Duplicate Inventory / Ledger authority: BLOCKED');
