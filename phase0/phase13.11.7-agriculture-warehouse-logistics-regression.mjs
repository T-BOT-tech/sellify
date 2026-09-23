import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bridgeAgricultureOfferToCommerceOrder, defineOffer, defineBuyerDemand } from '../app/src/verticals/agriculture/commerce-contract.js';
import { defineHarvest } from '../app/src/verticals/agriculture/inventory-contract.js';
import {
  AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT,
  buildAgricultureWarehouseReceivingHandoff,
  buildAgricultureLogisticsFulfillmentHandoff,
  buildAgricultureWarehouseLogisticsContext,
  isAgricultureWarehouseReceivingHandoff,
  isAgricultureLogisticsFulfillmentHandoff,
} from '../app/src/verticals/agriculture/warehouse-logistics-contract.js';
import { warehouseReceivingContract } from '../app/src/verticals/warehouse/receiving-contract.js';
import { logisticsFulfillmentBoundaryContract } from '../app/src/verticals/logistics/fulfillment-boundary.js';

const ORG = 'org-13-11-7';
const PRODUCT_ID = 'product-coffee-1';
const harvest = defineHarvest({
  id: 'harvest-1', organization_id: ORG, crop_id: 'crop-1',
  collection_center_id: 'cc-1', product_id: PRODUCT_ID, quantity: 100,
  unit: 'kg', event_id: 'agriculture:harvest:harvest-1:received',
});
const product = { id: PRODUCT_ID, organization_id: ORG };
const collectionCenterLocation = { id: 'location-collection-1', organization_id: ORG };
const warehouseLocation = { id: 'location-warehouse-1', organization_id: ORG };
const receiving = {
  id: 'receiving-1', organization_id: ORG, product_id: PRODUCT_ID, quantity: 100,
  event_id: 'warehouse:receiving:receiving-1:received',
};

const receivingHandoff = buildAgricultureWarehouseReceivingHandoff({
  harvest, product, collectionCenterLocation, receiving, warehouseLocation,
});
assert.equal(isAgricultureWarehouseReceivingHandoff(receivingHandoff), true);
assert.equal(receivingHandoff.product_id, PRODUCT_ID);
assert.equal(receivingHandoff.agriculture_inventory.location_id, collectionCenterLocation.id);
assert.equal(receivingHandoff.warehouse_location_id, warehouseLocation.id);
assert.equal(receivingHandoff.stock_authority, 'inventory');
assert.equal(receivingHandoff.direct_stock_mutation_by_agriculture, false);
assert.equal(receivingHandoff.agriculture_inventory.event_id, harvest.event_id);
assert.equal(receivingHandoff.warehouse_receiving.event_id, receiving.event_id);

const offer = defineOffer({ id: 'offer-1', organization_id: ORG, commodity_id: 'commodity-1', product_id: PRODUCT_ID, seller_id: 'farmer-1', quantity: 100, unit_price_minor: 500, currency: 'ETB' });
const demand = defineBuyerDemand({ id: 'demand-1', organization_id: ORG, buyer_customer_id: 'buyer-1', commodity_id: 'commodity-1', quantity: 20, currency: 'ETB' });
const buyerCustomer = { id: 'buyer-1', organization_id: ORG };
const agricultureOrderHandoff = { order: bridgeAgricultureOfferToCommerceOrder({ offer, demand, buyerCustomer, coreProduct: product }) };
const order = {
  id: 'order-1', organization_id: ORG, fulfillment_type: 'delivery', fulfillment_status: 'pending',
  delivery_address: 'Warehouse-to-buyer destination', scheduled_time: '2026-09-08T18:00:00Z',
  shipment_id: 'shipment-1', tracking_reference: 'track-1', stock_deducted: false,
};
const logisticsHandoff = buildAgricultureLogisticsFulfillmentHandoff({ organizationId: ORG, agricultureOrderHandoff, order });
assert.equal(isAgricultureLogisticsFulfillmentHandoff(logisticsHandoff), true);
assert.equal(logisticsHandoff.fulfillment.order_id, order.id);
assert.equal(logisticsHandoff.fulfillment.order_authority, 'commerce');
assert.equal(logisticsHandoff.fulfillment.fulfillment_authority, 'app/src/logistics/fulfillment.js');
assert.equal(logisticsHandoff.route_implementation, false);
assert.equal(logisticsHandoff.agriculture.commodity_id, offer.commodity_id);

const composed = buildAgricultureWarehouseLogisticsContext({
  harvest, product, collectionCenterLocation, receiving, warehouseLocation,
  organizationId: ORG, agricultureOrderHandoff, order,
});
assert.equal(composed.receiving.organization_id, ORG);
assert.equal(composed.logistics.organization_id, ORG);

assert.throws(() => buildAgricultureWarehouseReceivingHandoff({
  harvest, product, collectionCenterLocation,
  receiving: { ...receiving, organization_id: 'other-org' }, warehouseLocation,
}), /different organization/);
assert.throws(() => buildAgricultureWarehouseReceivingHandoff({
  harvest, product: { ...product, id: 'other-product' }, collectionCenterLocation, receiving, warehouseLocation,
}), /same Core Product|supplied Core Product/);
assert.throws(() => buildAgricultureLogisticsFulfillmentHandoff({
  organizationId: ORG, agricultureOrderHandoff, order: { ...order, fulfillment_status: 'unknown' },
}), /Unsupported fulfillment status/);
assert.throws(() => buildAgricultureLogisticsFulfillmentHandoff({
  organizationId: ORG, agricultureOrderHandoff, order: { ...order, organization_id: 'other-org' },
}), /different organization/);

const source = fs.readFileSync(new URL('../app/src/verticals/agriculture/warehouse-logistics-contract.js', import.meta.url), 'utf8');
assert.match(source, /applyStockChange/);
assert.match(source, /recordInventoryMovement/);
assert.doesNotMatch(source, /product\.stock\s*=/);
assert.doesNotMatch(source, /new\s+(?:Inventory|AgricultureInventory|WarehouseInventory|LogisticsFulfillment)/);
assert.match(source, /route_implementation:\s*false/);
assert.equal(AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT.duplicate_inventory_authority, false);
assert.equal(AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT.duplicate_order_authority, false);
assert.equal(AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT.duplicate_fulfillment_authority, false);
assert.equal(AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT.persistence_added, false);
assert.equal(warehouseReceivingContract().duplicate_inventory_authority, false);
assert.equal(logisticsFulfillmentBoundaryContract().duplicate_fulfillment_authority, false);

console.log('Phase 13.11.7 Agriculture ↔ Warehouse / Logistics Integration Regression: PASS');
console.log('Harvest → Warehouse Receiving continuity: PASS');
console.log('Commerce Order → Logistics Fulfillment continuity: PASS');
console.log('Product / location / organization isolation: PASS');
console.log('Event identity and replay boundaries preserved: PASS');
console.log('Core Inventory / Fulfillment authorities preserved: PASS');
console.log('Duplicate cross-pack authority: BLOCKED');
console.log('Direct Agriculture stock mutation: BLOCKED');
console.log('Route implementation: BLOCKED');
