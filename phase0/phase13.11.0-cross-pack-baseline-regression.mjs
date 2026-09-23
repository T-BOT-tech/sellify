import assert from 'node:assert/strict';

const fs = await import('node:fs');
const { AGRICULTURE_PACK } = await import('../app/src/verticals/agriculture/pack.js');
const { RESTAURANT_PACK, RESTAURANT_BOUNDARY } = await import('../app/src/verticals/restaurant/pack.js');
const { WAREHOUSE_PACK, WAREHOUSE_BOUNDARY } = await import('../app/src/verticals/warehouse/pack.js');
const { LOGISTICS_PACK, LOGISTICS_BOUNDARY } = await import('../app/src/verticals/logistics/pack.js');
const { LOGISTICS_AUTHORITY_MAP, LOGISTICS_FORBIDDEN_AUTHORITIES } = await import('../app/src/verticals/logistics/authority-map.js');
const { warehouseFulfillmentBoundaryContract } = await import('../app/src/verticals/warehouse/fulfillment-boundary.js');
const { logisticsFulfillmentBoundaryContract } = await import('../app/src/verticals/logistics/fulfillment-boundary.js');

function hasAll(list, expected, label) {
  for (const value of expected) assert.ok(list.includes(value), `${label} missing ${value}`);
}
function source(path) { return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }

assert.equal(AGRICULTURE_PACK.pack_id, 'agriculture');
assert.equal(RESTAURANT_PACK.pack_id, 'restaurant');
assert.equal(WAREHOUSE_PACK.pack_id, 'warehouse');
assert.equal(LOGISTICS_PACK.pack_id, 'logistics');

for (const pack of [AGRICULTURE_PACK, RESTAURANT_PACK, WAREHOUSE_PACK, LOGISTICS_PACK]) {
  assert.ok(pack.core_dependencies.includes('commerce'), `${pack.pack_id} must consume Commerce`);
  assert.ok(pack.core_dependencies.includes('inventory'), `${pack.pack_id} must consume Inventory`);
  assert.ok(pack.core_dependencies.includes('fulfillment'), `${pack.pack_id} must consume Fulfillment`);
}

hasAll(RESTAURANT_BOUNDARY.forbidden_parallel_authorities, ['RestaurantOrder', 'RestaurantInventory', 'RestaurantPayment', 'RestaurantFulfillment'], 'Restaurant forbidden authorities');
hasAll(WAREHOUSE_BOUNDARY.forbidden_parallel_authorities, ['WarehouseOrder', 'WarehouseInventory', 'WarehousePayment', 'WarehouseFulfillment'], 'Warehouse forbidden authorities');
hasAll(LOGISTICS_FORBIDDEN_AUTHORITIES, ['LogisticsOrder', 'LogisticsInventory', 'LogisticsPayment', 'LogisticsFulfillment', 'LogisticsLedger'], 'Logistics forbidden authorities');

assert.equal(warehouseFulfillmentBoundaryContract().fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(warehouseFulfillmentBoundaryContract().duplicate_fulfillment_authority, false);
assert.equal(logisticsFulfillmentBoundaryContract().fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(logisticsFulfillmentBoundaryContract().duplicate_fulfillment_authority, false);

assert.equal(LOGISTICS_AUTHORITY_MAP.core.order, 'commerce');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.stock, 'inventory');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.payment, 'payments');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.customer, 'customers');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.location, 'locations');
assert.equal(LOGISTICS_AUTHORITY_MAP.core.fulfillment_lifecycle, 'app/src/logistics/fulfillment.js');
assert.deepEqual(LOGISTICS_PACK.routes, []);

const restaurantPayment = source('app/src/verticals/restaurant/order-payment-compatibility.js');
assert.match(restaurantPayment, /order_authority:\s*'commerce'/);
assert.match(restaurantPayment, /payment_authority:\s*'payments'/);
assert.match(restaurantPayment, /duplicate_order_authority:\s*false/);
assert.match(restaurantPayment, /duplicate_payment_authority:\s*false/);

const restaurantInventory = source('app/src/verticals/restaurant/inventory-consumption.js');
assert.match(restaurantInventory, /mutation_authority:\s*'app\/src\/warehouse\/inventory\.js'/);
assert.match(restaurantInventory, /ledger_authority:\s*'app\/src\/warehouse\/ledger\.js'/);
assert.match(restaurantInventory, /idempotency:\s*'event_id'/);

const agricultureInventory = source('app/src/verticals/agriculture/inventory-bridge.js');
assert.match(agricultureInventory, /authority:\s*'core_inventory'/);
assert.match(agricultureInventory, /stock_mutation:\s*'applyStockChange'/);
assert.match(agricultureInventory, /ledger:\s*'recordInventoryMovement'/);

const agricultureCommerce = source('app/src/verticals/agriculture/commerce-contract.js');
assert.match(agricultureCommerce, /idempotency_key:/);
assert.match(agricultureCommerce, /commerce_owns:.*Order/);

const agricultureProcurement = source('app/src/verticals/agriculture/procurement-bridge.js');
assert.match(agricultureProcurement, /agriculture_owns:/);
assert.match(agricultureProcurement, /b2b_owns:/);
assert.match(agricultureProcurement, /Core Commerce Order/);

const manifests = source('shared/vertical-pack-manifests.js');
assert.match(manifests, /logistics:[\s\S]*routes: Object\.freeze\(\[\]\)/);
const logisticsPack = source('app/src/verticals/logistics/pack.js');
assert.doesNotMatch(logisticsPack, /route_engine|optimizer|maps_provider|route_ledger/);

console.log('Phase 13.11.0 Cross-Pack Baseline: PASS');
console.log('Authority matrix invariants: PASS');
console.log('Existing cross-pack contract boundaries: PASS');
console.log('Cross-pack bridge ownership declarations: PASS');
console.log('Route non-build lock: PASS');
