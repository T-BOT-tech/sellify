import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildConsumptionPlan,
  consumeThroughCoreInventory,
  isConsumptionPlan,
  inventoryConsumptionContract,
} from '../app/src/verticals/restaurant/inventory-consumption.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const paths = [
  'app/src/restaurant/kitchen.js',
  'app/src/warehouse/inventory.js',
  'app/src/warehouse/ledger.js',
  'app/src/verticals/restaurant/recipe-ingredient-bridge.js',
  'app/src/verticals/restaurant/inventory-consumption.js',
  'app/src/verticals/restaurant/pack.js',
];
for (const rel of paths) assert(fs.existsSync(path.join(root, rel)));

const inventory = fs.readFileSync(path.join(root, 'app/src/warehouse/inventory.js'), 'utf8');
const ledger = fs.readFileSync(path.join(root, 'app/src/warehouse/ledger.js'), 'utf8');
const pack = fs.readFileSync(path.join(root, 'app/src/verticals/restaurant/pack.js'), 'utf8');
assert.match(inventory, /export function applyStockChange/);
assert.match(inventory, /recordInventoryMovement\(product, delta/);
assert.match(ledger, /export function recordInventoryMovement/);
assert.match(pack, /inventory_consumption_bridge: 'app\/src\/verticals\/restaurant\/inventory-consumption\.js'/);

const products = [
  { id: 'tomato', name: 'Tomato', stock: 20, organization_id: 'org-1', unit: 'kg' },
  { id: 'oil', name: 'Oil', stock: 10, organization_id: 'org-1', unit: 'L' },
];
const preparation = {
  id: 'prep-42', recipe_id: 'recipe-7', quantity: 2,
  ingredients: [
    { product_id: 'tomato', quantity: 3, unit: 'kg' },
    { product_id: 'oil', quantity: 1, unit: 'L' },
  ],
};
const plan = buildConsumptionPlan(preparation, { organizationId: 'org-1', locationId: 'loc-1', coreProducts: products });
assert.equal(isConsumptionPlan(plan), true);
assert.equal(plan.lines[0].quantity, 6);
assert.equal(plan.lines[1].quantity, 2);
assert.equal(plan.lines[0].event_id, 'restaurant:preparation:prep-42:ingredient:tomato');

const calls = [];
const result = consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [],
  applyStockChange(productId, delta, type, meta) {
    calls.push({ productId, delta, type, meta });
    return { id: `tx-${calls.length}`, product_id: productId, quantity: delta };
  },
});
assert.equal(result.applied_count, 2);
assert.equal(result.skipped_idempotent_count, 0);
assert.deepEqual(calls.map(x => x.delta), [-6, -2]);
assert.deepEqual(calls.map(x => x.type), ['sold', 'sold']);
assert.equal(calls[0].meta.eventId, 'restaurant:preparation:prep-42:ingredient:tomato');
assert.equal(calls[0].meta.locationId, 'loc-1');

const idempotent = consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [
    { eventId: 'restaurant:preparation:prep-42:ingredient:tomato' },
    { eventId: 'restaurant:preparation:prep-42:ingredient:oil' },
  ],
  applyStockChange() { throw new Error('should not mutate on duplicate'); },
});
assert.equal(idempotent.applied_count, 0);
assert.equal(idempotent.skipped_idempotent_count, 2);

assert.throws(() => buildConsumptionPlan(preparation, { organizationId: 'org-2', locationId: 'loc-1', coreProducts: products }), /different organization/);
assert.throws(() => buildConsumptionPlan({ ...preparation, ingredients: [{ product_id: 'missing', quantity: 1, unit: 'kg' }] }, { organizationId: 'org-1', locationId: 'loc-1', coreProducts: products }), /does not exist/);
assert.throws(() => buildConsumptionPlan({ ...preparation, ingredients: [{ product_id: 'tomato', quantity: 0, unit: 'kg' }] }, { organizationId: 'org-1', locationId: 'loc-1', coreProducts: products }), /positive number/);
assert.throws(() => consumeThroughCoreInventory(plan, { products: [{ ...products[0], stock: 2 }, products[1]], inventoryMovements: [], applyStockChange() {} }), /Insufficient stock/);

const contract = inventoryConsumptionContract();
assert.equal(contract.recipe_authority, 'restaurant');
assert.equal(contract.preparation_authority, 'restaurant');
assert.equal(contract.product_authority, 'commerce');
assert.equal(contract.stock_authority, 'inventory');
assert.equal(contract.mutation_authority, 'app/src/warehouse/inventory.js');
assert.equal(contract.movement_ledger, 'app/src/warehouse/ledger.js');
assert.equal(contract.movement_type, 'sold');
assert.equal(contract.duplicate_authority, false);
assert.equal(contract.partial_consumption_preflight, true);

console.log('Phase 13.8.5 Restaurant Inventory Consumption Regression: PASS');
