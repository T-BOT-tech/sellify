import assert from 'node:assert/strict';
import {
  buildAgricultureCommerceHandoff,
  buildAgricultureInventoryHandoff,
  buildAgricultureCommerceInventoryContext,
  executeAgricultureCommerceHandoff,
  executeAgricultureInventoryHandoff,
  isAgricultureCommerceInventoryContext,
  AGRICULTURE_COMMERCE_INVENTORY_CONTRACT,
} from '../app/src/verticals/agriculture/commerce-inventory-contract.js';
import { AGRICULTURE_PACK } from '../app/src/verticals/agriculture/pack.js';

const org = 'org-13-11-6';
const commodity = { id: 'commodity-1', organization_id: org };
const offer = {
  entity_type: 'Offer', id: 'offer-1', organization_id: org,
  commodity_id: commodity.id, product_id: 'product-1', seller_id: 'seller-1',
  quantity: 500, unit_price_minor: 2500, currency: 'ETB',
};
const demand = {
  entity_type: 'BuyerDemand', id: 'demand-1', organization_id: org,
  buyer_customer_id: 'customer-1', commodity_id: commodity.id,
  quantity: 120, currency: 'ETB',
};
const customer = { id: 'customer-1', organization_id: org, name: 'Buyer Co' };
const product = { id: 'product-1', organization_id: org, name: 'Coffee' };
const harvest = {
  entity_type: 'Harvest', id: 'harvest-1', organization_id: org,
  crop_id: 'crop-1', collection_center_id: 'cc-1', product_id: 'product-1',
  quantity: 120, event_id: 'agriculture:harvest:harvest-1:received',
};
const location = { id: 'location-1', organization_id: org, status: 'active' };

const commerce = buildAgricultureCommerceHandoff({ offer, demand, buyerCustomer: customer, coreProduct: product });
assert.equal(commerce.context, 'agriculture');
assert.equal(commerce.organization_id, org);
assert.equal(commerce.order_authority, 'commerce');
assert.equal(commerce.product_authority, 'commerce');
assert.equal(commerce.payment_authority, 'payments');
assert.equal(commerce.order.idempotency_key, 'agriculture-demand:demand-1:offer:offer-1');
assert.equal(commerce.order.items[0].item_id, 'product-1');

const inventory = buildAgricultureInventoryHandoff({ harvest, product, collectionCenterLocation: location });
assert.equal(inventory.context, 'agriculture');
assert.equal(inventory.organization_id, org);
assert.equal(inventory.inventory.product_id, 'product-1');
assert.equal(inventory.inventory.quantity, 120);
assert.equal(inventory.inventory.event_id, harvest.event_id);
assert.equal(inventory.stock_authority, 'inventory');
assert.equal(inventory.mutation_authority, 'app/src/warehouse/inventory.js#applyStockChange');
assert.equal(inventory.ledger_authority, 'app/src/warehouse/ledger.js#recordInventoryMovement');
assert.equal(inventory.idempotency, 'event_id');

const context = buildAgricultureCommerceInventoryContext({
  offer, demand, buyerCustomer: customer, harvest,
  coreProduct: product, collectionCenterLocation: location,
});
assert.equal(isAgricultureCommerceInventoryContext(context), true);
assert.equal(context.commerce.organization_id, context.inventory.organization_id);
assert.equal(context.commerce.order.items[0].item_id, context.inventory.inventory.product_id);

let createdOrder;
const orderResult = await executeAgricultureCommerceHandoff(context.commerce, {
  createOrder: async payload => { createdOrder = payload; return { id: 'core-order-1' }; },
});
assert.deepEqual(orderResult, { id: 'core-order-1' });
assert.equal(createdOrder, context.commerce.order);

let receivedHarvest;
const inventoryResult = await executeAgricultureInventoryHandoff(context.inventory, {
  receiveHarvest: async payload => { receivedHarvest = payload; return { accepted: true }; },
});
assert.deepEqual(inventoryResult, { accepted: true });
assert.equal(receivedHarvest, context.inventory.inventory);

assert.deepEqual(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.agriculture_semantic_authority, AGRICULTURE_PACK.domain_entities);
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.order_authority, 'commerce');
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.product_authority, 'commerce');
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.stock_authority, 'inventory');
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.duplicate_order_authority, false);
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.duplicate_inventory_authority, false);
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.duplicate_payment_authority, false);
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.direct_stock_mutation_by_agriculture, false);
assert.equal(AGRICULTURE_COMMERCE_INVENTORY_CONTRACT.persistence_added, false);

assert.throws(
  () => buildAgricultureCommerceInventoryContext({
    offer, demand, buyerCustomer: customer, harvest,
    coreProduct: product, collectionCenterLocation: { ...location, organization_id: 'other-org' },
  }), /different organization/,
);
assert.throws(
  () => buildAgricultureCommerceInventoryContext({
    offer, demand: { ...demand, organization_id: 'other-org' }, buyerCustomer: customer,
    harvest, coreProduct: product, collectionCenterLocation: location,
  }), /different organization/,
);
assert.throws(
  () => buildAgricultureInventoryHandoff({ harvest, product: { ...product, id: 'other-product' }, collectionCenterLocation: location }),
  /supplied Product/,
);
await assert.rejects(
  () => executeAgricultureCommerceHandoff(context.commerce, {}), /Core Commerce order capability/,
);
await assert.rejects(
  () => executeAgricultureInventoryHandoff(context.inventory, {}), /Existing Agriculture Inventory bridge/,
);

// Static authority locks: this phase must not introduce duplicate domain stores.
const fs = await import('node:fs/promises');
const source = await fs.readFile(new URL('../app/src/verticals/agriculture/commerce-inventory-contract.js', import.meta.url), 'utf8');
const executableSource = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
assert(!/\bnew\s+Agriculture(?:Order|Inventory|Product|Payment)\b/.test(executableSource));
assert(!/\b(?:AgricultureOrder|AgricultureInventory|AgricultureProduct|AgriculturePayment)\b/.test(executableSource));
assert(!/product\.stock\s*=/.test(source));

console.log('Phase 13.11.6 Agriculture ↔ Commerce / Inventory Integration Regression: PASS');
console.log('Agriculture semantic authority preserved: PASS');
console.log('Commerce Order / Product authority preserved: PASS');
console.log('Inventory stock / movement authority preserved: PASS');
console.log('Organization isolation: PASS');
console.log('Product identity continuity: PASS');
console.log('Event identity / replay handoff: PASS');
console.log('Direct Agriculture stock mutation: BLOCKED');
console.log('Duplicate Agriculture Order / Inventory / Payment authority: BLOCKED');
