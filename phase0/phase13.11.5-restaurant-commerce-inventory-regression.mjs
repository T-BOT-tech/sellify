import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildRestaurantCommerceHandoff,
  buildRestaurantInventoryHandoff,
  buildRestaurantCommerceInventoryContext,
  isRestaurantCommerceInventoryContext,
  executeRestaurantInventoryHandoff,
  restaurantCommerceInventoryContract,
} from '../app/src/verticals/restaurant/commerce-inventory-contract.js';

const orgA = 'org-a';
const orgB = 'org-b';
const locationA = 'loc-a';
const locationB = 'loc-b';
const products = [
  { id: 'p-rice', organization_id: orgA, name: 'Rice', stock: 20, unit: 'kg' },
  { id: 'p-oil', organization_id: orgB, name: 'Oil', stock: 20, unit: 'l' },
];
const order = {
  id: 'order-1', organization_id: orgA, location_id: locationA,
  items: [{ id: 'p-rice', qty: 2, price: 100 }], total: 200, currency: 'ETB',
  table_id: 'table-1', kitchen_status: 'pending',
};
const preparation = {
  id: 'prep-1', recipe_id: 'recipe-1', quantity: 2,
  ingredients: [{ product_id: 'p-rice', quantity: 1, unit: 'kg' }],
};

const commerce = buildRestaurantCommerceHandoff(order, { organizationId: orgA, locationId: locationA });
assert.equal(commerce.order_id, 'order-1');
assert.equal(commerce.order_authority, 'commerce');
assert.equal(commerce.product_authority, 'commerce');
assert.equal(commerce.persistence, 'existing Core Commerce order');
assert.equal(commerce.duplicate_order_authority, false);

const inventory = buildRestaurantInventoryHandoff(preparation, {
  organizationId: orgA, locationId: locationA, coreProducts: products,
});
assert.equal(inventory.stock_authority, 'inventory');
assert.equal(inventory.mutation_authority, 'app/src/warehouse/inventory.js');
assert.equal(inventory.ledger_authority, 'app/src/warehouse/ledger.js');
assert.equal(inventory.lines[0].quantity, 2);
assert.equal(inventory.lines[0].event_id, 'restaurant:preparation:prep-1:ingredient:p-rice');
assert.equal(inventory.duplicate_inventory_authority, false);

const context = buildRestaurantCommerceInventoryContext(order, preparation, {
  organizationId: orgA, locationId: locationA, coreProducts: products,
});
assert.equal(isRestaurantCommerceInventoryContext(context), true);
assert.equal(context.commerce.organization_id, context.inventory.organization_id);
assert.equal(context.commerce.location_id, context.inventory.location_id);
assert.equal(context.payment.order_id, context.commerce.order_id);
assert.equal(context.payment.payment_authority, 'payments');

const commerceOtherOrg = buildRestaurantCommerceHandoff(order, { organizationId: orgB, locationId: locationA });
assert.equal(commerceOtherOrg.organization_id, orgB);
assert.throws(() => buildRestaurantInventoryHandoff(preparation, {
  organizationId: orgA, locationId: locationA, coreProducts: [products[1]],
}), /does not exist|different organization/);
const tamperedContext = { ...context, inventory: { ...context.inventory, location_id: locationB } };
assert.equal(isRestaurantCommerceInventoryContext(tamperedContext), false);

const calls = [];
const applyStockChange = (...args) => { calls.push(args); return { ok: true, eventId: args[3]?.eventId }; };
const result = executeRestaurantInventoryHandoff(inventory, {
  products,
  inventoryMovements: [],
  applyStockChange,
});
assert.equal(result.applied_count, 1);
assert.equal(calls[0][0], 'p-rice');
assert.equal(calls[0][1], -2);
assert.equal(calls[0][2], 'sold');
assert.equal(calls[0][3].eventId, 'restaurant:preparation:prep-1:ingredient:p-rice');
assert.equal(calls[0][3].locationId, locationA);

const contract = restaurantCommerceInventoryContract();
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.product_authority, 'commerce');
assert.equal(contract.stock_authority, 'inventory');
assert.equal(contract.payment_authority, 'payments');
assert.equal(contract.duplicate_order_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.duplicate_payment_authority, false);
assert.equal(contract.direct_stock_mutation_by_restaurant, false);
assert.equal(contract.persistence_added, false);

const source = fs.readFileSync(path.join(process.cwd(), 'app/src/verticals/restaurant/commerce-inventory-contract.js'), 'utf8');
assert(!/product\.stock\s*=/.test(source), 'Restaurant integration contract must not mutate product.stock directly');
assert(!/\bnew\s+(?:Inventory|RestaurantInventory)\b/.test(source), 'Restaurant contract must not instantiate a second Inventory authority');
assert(!/\b(?:const|let|var|class|function)\s+Restaurant(?:Order|Inventory|Payment)\b/.test(source), 'Restaurant contract must not declare parallel authorities');

console.log('Phase 13.11.5 Restaurant ↔ Commerce / Inventory Integration Regression: PASS');
console.log('Commerce Order / Product authority preserved: PASS');
console.log('Payment authority preserved: PASS');
console.log('Inventory stock / movement authority preserved: PASS');
console.log('Organization / location isolation: PASS');
console.log('Event identity / replay handoff: PASS');
console.log('Direct Restaurant stock mutation: BLOCKED');
console.log('Duplicate Restaurant Order / Inventory / Payment authority: BLOCKED');
