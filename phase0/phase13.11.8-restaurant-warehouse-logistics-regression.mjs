import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRestaurantWarehouseLogisticsContext, isRestaurantWarehouseLogisticsContext, restaurantWarehouseLogisticsContract } from '../app/src/verticals/restaurant/warehouse-logistics-contract.js';

const order = {
  id: 'order-rwl-1',
  organization_id: 'org-1',
  location_id: 'loc-restaurant-1',
  items: [{ id: 'product-1', name: 'Meal', qty: 2, price: 500 }],
  total: 1000,
  currency: 'ETB',
  fulfillment_type: 'delivery',
  fulfillment_status: 'out_for_delivery',
  delivery_address: 'Customer destination',
  scheduled_time: 1700000000000,
  kitchen_status: 'ready',
  priority: 'normal',
};

const context = buildRestaurantWarehouseLogisticsContext(order, {
  organizationId: 'org-1',
  locationId: 'loc-restaurant-1',
});

assert.equal(isRestaurantWarehouseLogisticsContext(context), true);
assert.equal(context.order_id, 'order-rwl-1');
assert.equal(context.organization_id, 'org-1');
assert.equal(context.location_id, 'loc-restaurant-1');
assert.equal(context.restaurant.kitchen_ticket_id, 'kitchen:order-rwl-1');
assert.equal(context.restaurant.kitchen_ready, true);
assert.equal(context.warehouse.fulfillment_status, 'out_for_delivery');
assert.equal(context.logistics.fulfillment_status, 'out_for_delivery');
assert.equal(context.order_authority, 'commerce');
assert.equal(context.product_authority, 'commerce');
assert.equal(context.inventory_authority, 'inventory');
assert.equal(context.stock_mutation_authority, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(context.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(context.persistence, 'none');

assert.throws(() => buildRestaurantWarehouseLogisticsContext(
  { ...order, fulfillment_type: 'dine_in' },
  { organizationId: 'org-1', locationId: 'loc-restaurant-1' },
), /pickup or delivery/);

assert.throws(() => buildRestaurantWarehouseLogisticsContext(
  order,
  { organizationId: 'org-2', locationId: 'loc-restaurant-1' },
), /different|scope|organization|mismatch/);

assert.throws(() => buildRestaurantWarehouseLogisticsContext(
  { ...order, fulfillment_status: 'unknown' },
  { organizationId: 'org-1', locationId: 'loc-restaurant-1' },
), /Unsupported fulfillment status/);

const crossLocation = buildRestaurantWarehouseLogisticsContext(
  { ...order, location_id: 'loc-order-1' },
  { organizationId: 'org-1', locationId: 'loc-order-1' },
);
assert.equal(crossLocation.location_id, 'loc-order-1');
assert.equal(crossLocation.restaurant.kitchen_ticket_id, 'kitchen:order-rwl-1');

const source = fs.readFileSync('app/src/verticals/restaurant/warehouse-logistics-contract.js', 'utf8');
assert.doesNotMatch(source, /\bnew\s+(?:RestaurantOrder|RestaurantInventory|RestaurantFulfillment|RestaurantLogistics)\b/);
assert.doesNotMatch(source, /\bproduct\.stock\s*=/);
assert.doesNotMatch(source, /\bnew\s+(?:Inventory|WarehouseInventory|LogisticsFulfillment)\b/);
assert.match(source, /app\/src\/warehouse\/inventory\.js#applyStockChange/);
assert.match(source, /app\/src\/logistics\/fulfillment\.js/);
assert.match(source, /persistence:\s*'none'/);

const contract = restaurantWarehouseLogisticsContract();
assert.equal(contract.duplicate_restaurant_fulfillment_authority, false);
assert.equal(contract.duplicate_restaurant_inventory_authority, false);
assert.equal(contract.duplicate_restaurant_order_authority, false);
assert.equal(contract.route_implementation, 'not introduced');

console.log('Phase 13.11.8 Restaurant ↔ Warehouse / Logistics Integration Regression: PASS');
console.log('Restaurant kitchen → physical fulfillment continuity: PASS');
console.log('Commerce Order / Product authority preserved: PASS');
console.log('Warehouse / Inventory authority preserved: PASS');
console.log('Logistics / Fulfillment authority preserved: PASS');
console.log('Organization / location continuity: PASS');
console.log('Direct Restaurant stock mutation: BLOCKED');
console.log('Duplicate Restaurant Fulfillment / Inventory / Order authority: BLOCKED');
console.log('Route implementation: BLOCKED');
