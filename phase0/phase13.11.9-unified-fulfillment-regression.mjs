import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildUnifiedFulfillmentContext,
  isUnifiedFulfillmentContext,
  unifiedFulfillmentContract,
} from '../app/src/logistics/unified-fulfillment-contract.js';
import { buildRestaurantWarehouseLogisticsContext } from '../app/src/verticals/restaurant/warehouse-logistics-contract.js';
import { buildAgricultureLogisticsFulfillmentHandoff } from '../app/src/verticals/agriculture/warehouse-logistics-contract.js';
import { bridgeAgricultureOfferToCommerceOrder, defineOffer, defineBuyerDemand } from '../app/src/verticals/agriculture/commerce-contract.js';

const ORG = 'org-13-11-9';
const LOC = 'loc-13-11-9';
const order = {
  id: 'order-unified-1', organization_id: ORG, location_id: LOC,
  items: [{ id: 'product-1', name: 'Meal', qty: 2, price: 500 }], total: 1000, currency: 'ETB',
  fulfillment_type: 'delivery', fulfillment_status: 'out_for_delivery',
  delivery_address: 'Unified destination', scheduled_time: '2026-09-08T18:00:00Z',
  shipment_id: 'shipment-unified-1', tracking_reference: 'track-unified-1',
  fulfillment_proof: null, stock_deducted: false, kitchen_status: 'ready',
};

const restaurant = buildRestaurantWarehouseLogisticsContext(order, {
  organizationId: ORG, locationId: LOC,
});

const agricultureOffer = defineOffer({ id: 'offer-unified-1', organization_id: ORG, commodity_id: 'commodity-1', product_id: 'product-1', seller_id: 'farmer-1', quantity: 2, unit_price_minor: 500, currency: 'ETB' });
const agricultureDemand = defineBuyerDemand({ id: 'demand-unified-1', organization_id: ORG, buyer_customer_id: 'buyer-1', commodity_id: 'commodity-1', quantity: 2, currency: 'ETB' });
const agricultureCustomer = { id: 'buyer-1', organization_id: ORG };
const agricultureOrderHandoff = { order: bridgeAgricultureOfferToCommerceOrder({ offer: agricultureOffer, demand: agricultureDemand, buyerCustomer: agricultureCustomer, coreProduct: { id: 'product-1', organization_id: ORG } }) };
const agriculture = buildAgricultureLogisticsFulfillmentHandoff({ organizationId: ORG, agricultureOrderHandoff, order });
const context = buildUnifiedFulfillmentContext({
  order, organizationId: ORG, locationId: LOC, restaurant, agriculture,
});

assert.equal(isUnifiedFulfillmentContext(context), true);
assert.equal(context.fulfillment_id, 'unified-fulfillment:order-unified-1');
assert.equal(context.order.authority, 'commerce');
assert.equal(context.fulfillment.authority, 'app/src/logistics/fulfillment.js');
assert.equal(context.fulfillment.status, 'out_for_delivery');
assert.equal(context.warehouse.stock_mutation_authority, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(context.logistics.tracking_reference, 'track-unified-1');
assert.equal(context.restaurant.kitchen_ticket_id, 'kitchen:order-unified-1');
assert.equal(context.restaurant.kitchen_ready, true);
assert.equal(context.agriculture.order_id, order.id);
assert.equal(context.agriculture.organization_id, ORG);
assert.equal(context.persistence, 'none');
assert.equal(context.dispatch.implemented, false);
assert.equal(context.route_implementation, false);

assert.throws(() => buildUnifiedFulfillmentContext({
  order: { ...order, organization_id: 'other-org' }, organizationId: ORG, locationId: LOC,
}), /different organization/);
assert.throws(() => buildUnifiedFulfillmentContext({
  order, organizationId: ORG, locationId: 'other-location', restaurant,
}), /different location/);
assert.throws(() => buildUnifiedFulfillmentContext({
  order: { ...order, fulfillment_status: 'unknown' }, organizationId: ORG, locationId: LOC,
}), /Unsupported fulfillment status/);
assert.throws(() => buildUnifiedFulfillmentContext({
  order, organizationId: ORG, locationId: LOC,
  restaurant: { ...restaurant, order_id: 'other-order' },
}), /(?:does not share Core Order scope|Valid Restaurant)/);
assert.throws(() => buildUnifiedFulfillmentContext({
  order, organizationId: ORG, locationId: LOC,
  restaurant: { ...restaurant, location_id: 'other-location' },
}), /(?:different location|Valid Restaurant)/);

const source = fs.readFileSync(new URL('../app/src/logistics/unified-fulfillment-contract.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /\bnew\s+(?:Fulfillment|UnifiedFulfillment|WarehouseFulfillment|LogisticsFulfillment|RestaurantFulfillment|AgricultureFulfillment)\b/);
assert.doesNotMatch(source, /\bproduct\.stock\s*=/);
assert.doesNotMatch(source, /\b(?:orders|products)\.(?:push|splice|findIndex)\b/);
assert.match(source, /app\/src\/logistics\/fulfillment\.js/);
assert.match(source, /app\/src\/warehouse\/inventory\.js#applyStockChange/);
assert.match(source, /persistence: 'none'/);
assert.match(source, /route_implementation: false/);

const contract = unifiedFulfillmentContract();
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(contract.duplicate_fulfillment_authority, false);
assert.equal(contract.duplicate_order_authority, false);
assert.equal(contract.duplicate_inventory_authority, false);
assert.equal(contract.dispatch_implemented, false);
assert.equal(contract.route_implementation, false);
assert.equal(contract.persistence, 'none');

console.log('Phase 13.11.9 Unified Fulfillment Contract Regression: PASS');
console.log('Canonical Commerce Order → Core Fulfillment continuity: PASS');
console.log('Warehouse / Inventory authority preserved: PASS');
console.log('Logistics coordination authority preserved: PASS');
console.log('Agriculture and Restaurant vertical projection continuity: PASS');
console.log('Organization / location isolation: PASS');
console.log('Duplicate Fulfillment / Order / Inventory authority: BLOCKED');
console.log('Direct stock mutation / persistence: BLOCKED');
console.log('Dispatch and route implementation: BLOCKED');
