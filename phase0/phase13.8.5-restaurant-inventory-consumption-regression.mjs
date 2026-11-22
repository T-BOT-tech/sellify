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
assert.match(ledger, /export async function recordCanonicalInventoryMovementBatch/);
assert.match(ledger, /eventType: 'inventory.movement.batch.record'/);
assert.match(ledger, /\/events\/\$\{encodeURIComponent\(config.chatId\)\}/);
assert.match(ledger, /enqueueEvent\(batchEvent.eventType/);
const consumptionSource = fs.readFileSync(path.join(root, 'app/src/verticals/restaurant/inventory-consumption.js'), 'utf8');
assert.doesNotMatch(consumptionSource, /applyStockChange/);
assert.match(consumptionSource, /recordCanonicalInventoryMovementBatch/);
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
assert.equal(plan.lines[0].event_id, 'restaurant:organization:org-1:preparation:prep-42:ingredient:tomato');

const calls = [];
const result = await consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [],
  async recordCanonicalInventoryMovementBatch(command) {
    calls.push(command);
    return { queued: false, movements: command.lines };
  },
});
assert.equal(result.applied_count, 2);
assert.equal(result.queued, false);
assert.equal(result.sync_status, 'confirmed');
assert.equal(result.skipped_idempotent_count, 0);
assert.equal(calls.length, 1, 'all recipe ingredients must use one canonical batch command');
assert.equal(calls[0].commandId, 'restaurant:preparation:prep-42:inventory-batch');
assert.equal(calls[0].locationId, 'loc-1');
assert.deepEqual(calls[0].lines.map(line => line.quantity), [-6, -2]);
assert.deepEqual(calls[0].lines.map(line => line.movementType), ['SALE', 'SALE']);
assert.deepEqual(calls[0].lines.map(line => line.eventId), [
  'restaurant:organization:org-1:preparation:prep-42:ingredient:tomato',
  'restaurant:organization:org-1:preparation:prep-42:ingredient:oil',
]);

const idempotent = await consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [
    { eventId: 'restaurant:organization:org-1:preparation:prep-42:ingredient:tomato', productId: 'tomato', quantity: -6, movementType: 'SALE', locationId: 'loc-1', organizationId: 'org-1', syncStatus: 'synced' },
    { eventId: 'restaurant:organization:org-1:preparation:prep-42:ingredient:oil', productId: 'oil', quantity: -2, movementType: 'SALE', locationId: 'loc-1', organizationId: 'org-1', syncStatus: 'synced' },
  ],
  recordCanonicalInventoryMovementBatch() { throw new Error('must not execute a fully confirmed replay'); },
});
assert.equal(idempotent.applied_count, 0);
assert.equal(idempotent.skipped_idempotent_count, 2);

let pendingRetryCalls = 0;
const pendingRetry = await consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [
    { eventId: 'restaurant:organization:org-1:preparation:prep-42:ingredient:tomato', productId: 'tomato', quantity: -6, movementType: 'SALE', locationId: 'loc-1', organizationId: 'org-1', syncStatus: 'pending' },
  ],
  async recordCanonicalInventoryMovementBatch(command) {
    pendingRetryCalls += 1;
    assert.equal(command.lines.length, 2);
    return { queued: true };
  },
});
assert.equal(pendingRetryCalls, 1, 'pending local movement evidence must not suppress canonical replay');
assert.equal(pendingRetry.sync_status, 'pending');

assert.throws(() => consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [
    { eventId: 'restaurant:organization:org-1:preparation:prep-42:ingredient:tomato', productId: 'tomato', quantity: -5, movementType: 'SALE', locationId: 'loc-1', organizationId: 'org-1', syncStatus: 'synced' },
  ],
  recordCanonicalInventoryMovementBatch() { throw new Error('must reject conflicting confirmed movement'); },
}), /already confirmed with different intent/);

const replayedAtServer = await consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [],
  async recordCanonicalInventoryMovementBatch() { return { queued: false, duplicate: true, movements: [] }; },
});
assert.equal(replayedAtServer.applied_count, 0);
assert.equal(replayedAtServer.replayed_count, 2);

const queued = await consumeThroughCoreInventory(plan, {
  products,
  inventoryMovements: [],
  async recordCanonicalInventoryMovementBatch() { return { queued: true }; },
});
assert.equal(queued.applied_count, 0);
assert.equal(queued.queued_count, 2);
assert.equal(queued.sync_status, 'pending');

assert.throws(() => buildConsumptionPlan(preparation, { organizationId: 'org-2', locationId: 'loc-1', coreProducts: products }), /different organization/);
assert.throws(() => buildConsumptionPlan({ ...preparation, ingredients: [{ product_id: 'missing', quantity: 1, unit: 'kg' }] }, { organizationId: 'org-1', locationId: 'loc-1', coreProducts: products }), /does not exist/);
assert.throws(() => buildConsumptionPlan({ ...preparation, ingredients: [{ product_id: 'tomato', quantity: 0, unit: 'kg' }] }, { organizationId: 'org-1', locationId: 'loc-1', coreProducts: products }), /positive number/);
await assert.rejects(
  consumeThroughCoreInventory(plan, {
    products: [{ ...products[0], stock: 20 }, products[1]],
    inventoryMovements: [],
    getInventoryBalance(productId) { return productId === 'tomato' ? 2 : 10; },
    recordCanonicalInventoryMovementBatch() { throw new Error('must not execute after failed canonical preflight'); },
  }),
  /Insufficient canonical stock/,
);

const staleLegacyStock = await consumeThroughCoreInventory(plan, {
  products: [{ ...products[0], stock: 0 }, products[1]],
  inventoryMovements: [],
  getInventoryBalance(productId) { return productId === 'tomato' ? 20 : 10; },
  async recordCanonicalInventoryMovementBatch() { return { queued: false, movements: [] }; },
});
assert.equal(staleLegacyStock.sync_status, 'confirmed',
  'stale legacy product.stock must not block a preparation when canonical balance is sufficient');

const contract = inventoryConsumptionContract();
assert.equal(contract.recipe_authority, 'restaurant');
assert.equal(contract.preparation_authority, 'restaurant');
assert.equal(contract.product_authority, 'commerce');
assert.equal(contract.stock_authority, 'inventory');
assert.equal(contract.mutation_authority, 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovementBatch');
assert.equal(contract.ledger_authority, 'app/src/warehouse/ledger.js');
assert.equal(contract.movement_type, 'SALE');
assert.equal(contract.duplicate_authority, false);
assert.equal(contract.atomic_multi_ingredient_execution, true);
assert.equal(contract.partial_consumption_preflight, true);

console.log('Phase 13.8.5 Restaurant Inventory Consumption Regression: PASS');
