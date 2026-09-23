import assert from 'node:assert/strict';
import { AGRICULTURE_PACK } from '../app/src/verticals/agriculture/pack.js';
import {
  AGRICULTURE_PROCUREMENT_CONTRACT,
  defineSupply,
  bridgeAgricultureSupplyToB2BQuote,
  bridgeAcceptedQuoteToB2BPurchaseOrder,
  executeAgricultureB2BQuote,
  executeAgricultureB2BPurchaseOrder,
} from '../app/src/verticals/agriculture/procurement-bridge.js';

const org = 'org-13-7';
const supply = defineSupply({ id: 'supply-1', organization_id: org, farmer_customer_id: 'cust-farmer', commodity_id: 'commodity-maize', product_id: 'product-maize', quantity: 100, unit_price_minor: 1250, currency: 'ETB' });
const farmer = { id: 'cust-farmer', organizationId: org };
const buyer = { id: 'cust-buyer', organizationId: org };
const product = { id: 'product-maize', organizationId: org };

assert.equal(supply.entity_type, 'Supply');
assert.ok(AGRICULTURE_PACK.domain_entities.includes('Supply'));
assert.deepEqual(AGRICULTURE_PROCUREMENT_CONTRACT.agriculture_owns, ['Supply']);
assert.equal(AGRICULTURE_PROCUREMENT_CONTRACT.po_to_order, 'deferred_until_canonical_b2b_order_bridge');

const quoteBridge = bridgeAgricultureSupplyToB2BQuote({ supply, farmer, buyer, coreProduct: product });
assert.equal(quoteBridge.customer_id, buyer.id);
assert.equal(quoteBridge.items[0].product_id, product.id);
assert.equal(quoteBridge.items[0].quantity, 100);
assert.equal(quoteBridge.items[0].unit_price_minor, 1250);

let quoteArgs;
await executeAgricultureB2BQuote({ bridge: quoteBridge, createQuote: async payload => { quoteArgs = payload; return { id: 'quote-1', status: 'ACCEPTED', organizationId: org, agriculture: payload.agriculture }; } });
assert.equal(quoteArgs.customer_id, buyer.id);

const poBridge = bridgeAcceptedQuoteToB2BPurchaseOrder({ quote: { id: 'quote-1', status: 'ACCEPTED', organizationId: org, agriculture: { supply_id: 'supply-1', commodity_id: 'commodity-maize' } }, organizationId: org, buyerReference: 'FARM-PO-1' });
assert.equal(poBridge.quoteId, 'quote-1');
assert.equal(poBridge.buyerReference, 'FARM-PO-1');

let poArgs;
await executeAgricultureB2BPurchaseOrder({ bridge: poBridge, createPurchaseOrder: async payload => { poArgs = payload; return { id: 'po-1' }; } });
assert.equal(poArgs.quoteId, 'quote-1');

assert.throws(() => bridgeAgricultureSupplyToB2BQuote({ supply, farmer: { ...farmer, organizationId: 'other-org' }, buyer, coreProduct: product }), /different organization/);
assert.throws(() => bridgeAcceptedQuoteToB2BPurchaseOrder({ quote: { id: 'q', status: 'DRAFT', organizationId: org }, organizationId: org }), /accepted/);
assert.throws(() => bridgeAcceptedQuoteToB2BPurchaseOrder({ quote: { id: 'q', status: 'ACCEPTED', organizationId: 'other-org' }, organizationId: org }), /different organization/);

console.log('Phase 13.7 Agriculture Procurement Bridge Regression: PASS');
