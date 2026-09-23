import assert from 'node:assert/strict';
import {
  defineCommodity,
  defineOffer,
  defineBuyerDemand,
  bridgeAgricultureOfferToCommerceOrder,
  executeAgricultureCommerceOrder,
  AGRICULTURE_COMMERCE_CONTRACT,
} from '../app/src/verticals/agriculture/commerce-contract.js';

const org = 'org-13-6';
const commodity = defineCommodity({
  id: 'commodity-1', organization_id: org, name: 'Coffee', product_id: 'product-1', unit: 'kg',
});
const offer = defineOffer({
  id: 'offer-1', organization_id: org, commodity_id: commodity.id, product_id: 'product-1',
  seller_id: 'seller-chat-1', quantity: 500, unit_price_minor: 2500, currency: 'ETB',
});
const demand = defineBuyerDemand({
  id: 'demand-1', organization_id: org, buyer_customer_id: 'customer-1',
  commodity_id: commodity.id, quantity: 120, currency: 'ETB',
});
const customer = { id: 'customer-1', organization_id: org, name: 'Buyer Co', phone: '+251900000000' };
const product = { id: 'product-1', name: 'Coffee' };

const bridge = bridgeAgricultureOfferToCommerceOrder({ offer, demand, buyerCustomer: customer, coreProduct: product });
assert.equal(bridge.buyer_id, 'customer-1');
assert.equal(bridge.items[0].seller_id, 'seller-chat-1');
assert.equal(bridge.items[0].item_id, 'product-1');
assert.equal(bridge.items[0].qty, 120);
assert.equal(bridge.idempotency_key, 'agriculture-demand:demand-1:offer:offer-1');
assert.equal(bridge.agriculture.commodity_id, 'commodity-1');
assert.equal(bridge.agriculture.unit_price_minor, 2500);

let called = null;
const result = await executeAgricultureCommerceOrder({ bridge, createOrder: async payload => { called = payload; return { id: 'core-order-1' }; } });
assert.deepEqual(result, { id: 'core-order-1' });
assert.equal(called, bridge);

assert.equal(AGRICULTURE_COMMERCE_CONTRACT.order_authority, 'core_commerce');
assert.equal(AGRICULTURE_COMMERCE_CONTRACT.fulfillment_authority, 'core_fulfillment');
assert.equal(AGRICULTURE_COMMERCE_CONTRACT.payment_authority, 'payment_core');
assert(!AGRICULTURE_COMMERCE_CONTRACT.agriculture_owns.includes('Order'));
assert(!AGRICULTURE_COMMERCE_CONTRACT.agriculture_owns.includes('Payment'));

assert.throws(
  () => bridgeAgricultureOfferToCommerceOrder({ offer, demand: { ...demand, organization_id: 'other-org' }, buyerCustomer: customer, coreProduct: product }),
  /different organization/,
);
assert.throws(
  () => bridgeAgricultureOfferToCommerceOrder({ offer, demand: { ...demand, quantity: 600 }, buyerCustomer: customer, coreProduct: product }),
  /insufficient/,
);
assert.throws(
  () => bridgeAgricultureOfferToCommerceOrder({ offer, demand: { ...demand, currency: 'USD' }, buyerCustomer: customer, coreProduct: product }),
  /currency must match/,
);
assert.throws(
  () => defineOffer({ id: 'offer-2', organization_id: org, commodity_id: commodity.id, product_id: 'product-1', seller_id: 'seller-chat-1', quantity: 0, unit_price_minor: 2500, currency: 'ETB' }),
  /positive integer/,
);

console.log('Phase 13.6 Agriculture Commerce Bridge Regression: PASS');
