// Phase 13.6 — Agriculture → Commerce contract.
// Agriculture owns Commodity vocabulary; Offer and BuyerDemand use canonical
// Commerce contracts. Commerce remains the
// authority for Order, Fulfillment and Payment. This contract is persistence- and
// transport-neutral so it can be consumed by server or offline orchestration.

import { defineAgricultureEntity } from './pack.js';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

function positiveInteger(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result <= 0) {
    throw new TypeError(`Agriculture ${field} must be a positive integer`);
  }
  return result;
}

function nonNegativeMinor(value, field) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 0) {
    throw new TypeError(`Agriculture ${field} must be a non-negative integer minor-unit amount`);
  }
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Agriculture commerce reference belongs to a different organization');
    }
  }
}

export function defineCommodity(input = {}) {
  const entity = defineAgricultureEntity('Commodity', input);
  return Object.freeze({
    ...entity,
    name: text(input.name, 'Commodity name'),
    product_id: text(input.product_id ?? input.productId, 'Commodity product_id'),
    unit: text(input.unit, 'Commodity unit'),
  });
}

export function defineOffer(input = {}) {
  const organizationId = organizationOf(input);
  const offerId = text(input.offer_id ?? input.offerId ?? input.id, 'Offer id');
  return Object.freeze({
    entity_type: 'Offer',
    id: offerId,
    organization_id: organizationId,
    status: String(input.status ?? 'active').trim().toLowerCase(),
    commodity_id: text(input.commodity_id ?? input.commodityId, 'Offer commodity_id'),
    product_id: text(input.product_id ?? input.productId, 'Offer product_id'),
    seller_id: text(input.seller_id ?? input.sellerId, 'Offer seller_id'),
    quantity: positiveInteger(input.quantity, 'Offer quantity'),
    unit_price_minor: nonNegativeMinor(input.unit_price_minor ?? input.unitPriceMinor, 'Offer unit_price_minor'),
    currency: text(input.currency, 'Offer currency').toUpperCase(),
  });
}

export function defineBuyerDemand(input = {}) {
  const organizationId = organizationOf(input);
  const demandId = text(input.demand_id ?? input.demandId ?? input.id, 'Buyer Demand id');
  return Object.freeze({
    entity_type: 'BuyerDemand',
    id: demandId,
    organization_id: organizationId,
    status: String(input.status ?? 'active').trim().toLowerCase(),
    buyer_customer_id: text(input.buyer_customer_id ?? input.buyerCustomerId, 'Buyer Demand buyer_customer_id'),
    commodity_id: text(input.commodity_id ?? input.commodityId, 'Buyer Demand commodity_id'),
    quantity: positiveInteger(input.quantity, 'Buyer Demand quantity'),
    currency: text(input.currency, 'Buyer Demand currency').toUpperCase(),
  });
}

export function bridgeAgricultureOfferToCommerceOrder({ offer, demand, buyerCustomer, coreProduct } = {}) {
  if (!offer || offer.entity_type !== 'Offer') throw new TypeError('Commerce Offer is required');
  if (!demand || demand.entity_type !== 'BuyerDemand') throw new TypeError('Commerce Buyer Demand is required');
  if (!buyerCustomer || buyerCustomer.id == null) throw new TypeError('Existing Core Customer is required');
  if (!coreProduct || coreProduct.id == null) throw new TypeError('Existing Core Product is required');

  const org = organizationOf(offer);
  assertSameOrganization(org, demand, buyerCustomer);
  if (String(offer.commodity_id) !== String(demand.commodity_id)) {
    throw new TypeError('Offer and Buyer Demand must reference the same Commodity');
  }
  if (String(offer.product_id) !== String(coreProduct.id)) {
    throw new TypeError('Offer must reference the supplied Core Product');
  }
  if (offer.quantity < demand.quantity) {
    throw new TypeError('Offer quantity is insufficient for Buyer Demand');
  }
  if (String(offer.currency) !== String(demand.currency)) {
    throw new TypeError('Offer and Buyer Demand currency must match');
  }

  const quantity = demand.quantity;
  return Object.freeze({
    buyer_id: String(buyerCustomer.id),
    buyer_identity: String(buyerCustomer.id),
    customer_name: String(buyerCustomer.name ?? '').trim(),
    customer_phone: String(buyerCustomer.phone ?? '').trim(),
    items: Object.freeze([Object.freeze({
      seller_id: offer.seller_id,
      item_id: String(coreProduct.id),
      qty: quantity,
    })]),
    idempotency_key: `agriculture-demand:${demand.id}:offer:${offer.id}`,
    agriculture: Object.freeze({
      commodity_id: offer.commodity_id,
      offer_id: offer.id,
      demand_id: demand.id,
      organization_id: org,
      unit_price_minor: offer.unit_price_minor,
      currency: offer.currency,
    }),
  });
}

export async function executeAgricultureCommerceOrder({ bridge, createOrder } = {}) {
  if (!bridge || typeof bridge !== 'object') throw new TypeError('Commerce bridge payload is required');
  if (typeof createOrder !== 'function') throw new TypeError('Core Commerce order capability is required');
  return createOrder(bridge);
}

export const AGRICULTURE_COMMERCE_CONTRACT = Object.freeze({
  agriculture_owns: Object.freeze(['Commodity']),
  commerce_contracts: Object.freeze(['Offer', 'BuyerDemand', 'Order']),
  commerce_owns: Object.freeze(['Order', 'Fulfillment']),
  payment_owns: 'Payment Core',
  order_authority: 'core_commerce',
  fulfillment_authority: 'core_fulfillment',
  payment_authority: 'payment_core',
  adapter_boundary: 'Agriculture → Commerce capability → existing Order service',
});
