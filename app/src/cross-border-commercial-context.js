// Phase 20.6 — Cross-Border Commercial Terms Context.
// Composition-only boundary over existing Commerce/B2B and Supplier Network
// commercial authorities. It never creates pricing, quote, PO, credit, invoice,
// procurement, payment, or settlement authority.

import { CURRENCY_MONEY_CONTRACT_VERSION } from './currency-money-contract.js';
import { SUPPLIER_NETWORK_COMMERCIAL_CONTRACT_VERSION } from './supplier-network/commercial-contract.js';

export const CROSS_BORDER_COMMERCIAL_CONTEXT_VERSION = '1.0';

export const CROSS_BORDER_COMMERCIAL_SOURCES = Object.freeze([
  'commerce',
  'b2b_pricing',
  'b2b_quote',
  'supplier_network_commercial',
  'procurement',
]);

export const CROSS_BORDER_COMMERCIAL_FORBIDDEN_AUTHORITIES = Object.freeze([
  'pricing', 'quotes', 'purchaseOrders', 'credit', 'invoices', 'procurement',
  'payments', 'settlement', 'inventory', 'ledger', 'persistence', 'database',
]);

const text = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) throw Object.assign(new TypeError(`${field} must be a non-empty string`), { code: 'CROSS_BORDER_COMMERCIAL_INVALID' });
  return result;
};

const optionalText = (value) => value == null ? null : text(value, 'value');

const reference = (value, field) => {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object or null`);
  return Object.freeze({ ...value });
};

function assertNoAuthorityClaims(input = {}) {
  for (const authority of CROSS_BORDER_COMMERCIAL_FORBIDDEN_AUTHORITIES) {
    const key = `owns${authority[0].toUpperCase()}${authority.slice(1)}`;
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      throw Object.assign(new Error(`Cross-border commercial context cannot declare ${key}`), { code: 'CROSS_BORDER_DUPLICATE_AUTHORITY' });
    }
  }
}

export function buildCommercialObservation({
  source,
  reference: sourceReference = null,
  currency = null,
  unitPriceMinor = null,
  quantity = null,
  paymentTerms = null,
  deliveryTerms = null,
  validity = null,
  status = null,
  provenance = null,
  observedAt = null,
  validUntil = null,
} = {}) {
  const sourceName = text(source, 'source');
  if (!CROSS_BORDER_COMMERCIAL_SOURCES.includes(sourceName)) {
    throw Object.assign(new Error(`Unsupported commercial source: ${sourceName}`), { code: 'CROSS_BORDER_COMMERCIAL_SOURCE_INVALID' });
  }
  if (unitPriceMinor != null && (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0)) throw new TypeError('unitPriceMinor must be a non-negative integer or null');
  if (quantity != null && (!Number.isInteger(quantity) || quantity <= 0)) throw new TypeError('quantity must be a positive integer or null');
  return Object.freeze({
    version: CROSS_BORDER_COMMERCIAL_CONTEXT_VERSION,
    source: sourceName,
    reference: reference(sourceReference, 'reference'),
    currency: optionalText(currency)?.toUpperCase() || null,
    unitPriceMinor,
    quantity,
    paymentTerms: optionalText(paymentTerms),
    deliveryTerms: optionalText(deliveryTerms),
    validity: optionalText(validity),
    status: optionalText(status),
    provenance: reference(provenance, 'provenance'),
    observedAt: optionalText(observedAt),
    validUntil: optionalText(validUntil),
  });
}

export function buildCrossBorderCommercialContext({
  origin,
  destination,
  currencyContext = null,
  observations = [],
  quoteReference = null,
  purchaseOrderReference = null,
  supplierCommercialReference = null,
  customerReference = null,
  provenance = null,
  ...input
} = {}) {
  assertNoAuthorityClaims(input);
  const from = text(origin, 'origin').toUpperCase();
  const to = text(destination, 'destination').toUpperCase();
  if (from === to) throw Object.assign(new Error('Commercial context must cross country boundaries'), { code: 'CROSS_BORDER_SAME_COUNTRY' });
  if (!Array.isArray(observations)) throw new TypeError('observations must be an array');
  return Object.freeze({
    version: CROSS_BORDER_COMMERCIAL_CONTEXT_VERSION,
    origin: from,
    destination: to,
    currencyContext: reference(currencyContext, 'currencyContext'),
    observations: Object.freeze(observations.map((item) => buildCommercialObservation(item))),
    references: Object.freeze({
      quote: reference(quoteReference, 'quoteReference'),
      purchaseOrder: reference(purchaseOrderReference, 'purchaseOrderReference'),
      supplierCommercial: reference(supplierCommercialReference, 'supplierCommercialReference'),
      customer: reference(customerReference, 'customerReference'),
    }),
    provenance: reference(provenance, 'provenance'),
    persistent: false,
    authoritative: false,
    mutation: 'none',
    pricingAuthority: 'existing_commerce_or_b2b_pricing',
    quoteAuthority: 'existing_b2b_quote_authority',
    purchaseOrderAuthority: 'existing_b2b_purchase_order_authority',
    supplierCommercialAuthority: 'existing_supplier_network_commercial_authority',
    moneyContractVersion: CURRENCY_MONEY_CONTRACT_VERSION,
    supplierCommercialContractVersion: SUPPLIER_NETWORK_COMMERCIAL_CONTRACT_VERSION,
  });
}

export function crossBorderCommercialContextContract() {
  return Object.freeze({
    version: CROSS_BORDER_COMMERCIAL_CONTEXT_VERSION,
    authority: 'cross_border_coordination',
    persistence: 'none',
    mutation: 'none',
    ownsPricing: false,
    ownsQuotes: false,
    ownsPurchaseOrders: false,
    ownsCredit: false,
    ownsInvoices: false,
    ownsProcurement: false,
    ownsPayments: false,
    ownsSettlement: false,
    ownsInventory: false,
    ownsLedger: false,
    calculationAuthority: 'existing_commerce_b2b_money_authorities',
  });
}
