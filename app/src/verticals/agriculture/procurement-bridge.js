// Phase 13.7 — Agriculture → canonical B2B procurement bridge.
// Agriculture owns Supply vocabulary; canonical B2B Quote/Purchase Order
// services remain authoritative. This module is transport/persistence neutral.

import { defineAgricultureEntity } from './pack.js';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

function positiveInteger(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0) throw new TypeError(`Agriculture ${field} must be a positive integer`);
  return result;
}

function minorAmount(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) throw new TypeError(`Agriculture ${field} must be a non-negative integer minor amount`);
  return result;
}

function organizationOf(record) {
  return text(record?.organization_id ?? record?.organizationId, 'organization_id');
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Agriculture procurement reference belongs to a different organization');
    }
  }
}

export function defineSupply(input = {}) {
  const entity = defineAgricultureEntity('Supply', input);
  return Object.freeze({
    ...entity,
    supply_id: text(input.supply_id ?? input.supplyId ?? input.id, 'Supply id'),
    farmer_customer_id: text(input.farmer_customer_id ?? input.farmerCustomerId, 'Supply farmer_customer_id'),
    commodity_id: text(input.commodity_id ?? input.commodityId, 'Supply commodity_id'),
    product_id: text(input.product_id ?? input.productId, 'Supply product_id'),
    quantity: positiveInteger(input.quantity, 'Supply quantity'),
    unit_price_minor: minorAmount(input.unit_price_minor ?? input.unitPriceMinor, 'Supply unit_price_minor'),
    currency: text(input.currency, 'Supply currency').toUpperCase(),
  });
}

export function bridgeAgricultureSupplyToB2BQuote({ supply, farmer, buyer, coreProduct } = {}) {
  if (!supply || supply.entity_type !== 'Supply') throw new TypeError('Agriculture Supply is required');
  if (!farmer || farmer.id == null) throw new TypeError('Existing Core Farmer Customer is required');
  if (!buyer || buyer.id == null) throw new TypeError('Existing Core Buyer Customer is required');
  if (!coreProduct || coreProduct.id == null) throw new TypeError('Existing Core Product is required');

  const org = organizationOf(supply);
  assertSameOrganization(org, farmer, buyer, coreProduct);
  if (String(supply.farmer_customer_id) !== String(farmer.id)) throw new TypeError('Supply must reference the supplied Farmer Customer');
  if (String(supply.product_id) !== String(coreProduct.id)) throw new TypeError('Supply must reference the supplied Core Product');

  return Object.freeze({
    customer_id: String(buyer.id),
    items: Object.freeze([Object.freeze({
      product_id: String(coreProduct.id),
      quantity: supply.quantity,
      unit_price_minor: supply.unit_price_minor,
    })]),
    notes: `Agriculture supply ${supply.supply_id}`,
    agriculture: Object.freeze({
      supply_id: supply.supply_id,
      commodity_id: supply.commodity_id,
      farmer_customer_id: supply.farmer_customer_id,
      buyer_customer_id: String(buyer.id),
      organization_id: org,
      currency: supply.currency,
    }),
  });
}

export async function executeAgricultureB2BQuote({ bridge, createQuote } = {}) {
  if (!bridge || typeof bridge !== 'object') throw new TypeError('B2B quote bridge payload is required');
  if (typeof createQuote !== 'function') throw new TypeError('Canonical B2B Quote capability is required');
  return createQuote(bridge);
}

export function bridgeAcceptedQuoteToB2BPurchaseOrder({ quote, organizationId, buyerReference = '', notes = '' } = {}) {
  if (!quote || quote.status !== 'ACCEPTED') throw new TypeError('Only an accepted canonical Quote can become a Purchase Order');
  const org = text(organizationId, 'organization_id');
  assertSameOrganization(org, quote);
  return Object.freeze({
    quoteId: String(quote.id),
    buyerReference: String(buyerReference || '').trim(),
    notes: String(notes || '').trim(),
    agriculture: Object.freeze({
      supply_id: String(quote.agriculture?.supply_id ?? '').trim(),
      commodity_id: String(quote.agriculture?.commodity_id ?? '').trim(),
      organization_id: org,
    }),
  });
}

export async function executeAgricultureB2BPurchaseOrder({ bridge, createPurchaseOrder } = {}) {
  if (!bridge || typeof bridge !== 'object') throw new TypeError('B2B purchase-order bridge payload is required');
  if (typeof createPurchaseOrder !== 'function') throw new TypeError('Canonical B2B Purchase Order capability is required');
  return createPurchaseOrder(bridge);
}

export const AGRICULTURE_PROCUREMENT_CONTRACT = Object.freeze({
  agriculture_owns: Object.freeze(['Supply']),
  b2b_owns: Object.freeze(['Quote', 'PurchaseOrder', 'CreditTerms', 'AccountsReceivable', 'Invoice']),
  payment_owns: 'Payment Core',
  order_owns: 'Core Commerce Order',
  flow: 'Farmer Supply → Commodity → Buyer → B2B Quote → accepted Quote → Purchase Order → later Order/AR/Invoice/Payment stages',
  po_to_order: 'deferred_until_canonical_b2b_order_bridge',
});
