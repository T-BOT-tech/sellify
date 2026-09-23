// Phase 13.10 — Logistics authority map.
// Logistics coordinates physical movement; it does not become authoritative
// for Core Commerce orders, stock, payments, customers, locations, or the
// fulfillment lifecycle state machine.

export const LOGISTICS_AUTHORITY_MAP = Object.freeze({
  logistics: Object.freeze({
    courier: 'logistics-pack',
    route: 'logistics-pack',
    shipment: 'logistics-pack',
    delivery: 'logistics-pack',
    proof: 'logistics-pack',
    return: 'logistics-pack',
  }),
  core: Object.freeze({
    order: 'commerce',
    stock: 'inventory',
    payment: 'payments',
    customer: 'customers',
    location: 'locations',
    fulfillment_lifecycle: 'app/src/logistics/fulfillment.js',
    audit: 'audit',
  }),
});

export const LOGISTICS_FORBIDDEN_AUTHORITIES = Object.freeze([
  'LogisticsOrder',
  'LogisticsInventory',
  'LogisticsPayment',
  'LogisticsCustomer',
  'LogisticsLocation',
  'LogisticsFulfillment',
  'LogisticsLedger',
]);

export function logisticsAuthorityContract() {
  return Object.freeze({
    logistics_owned: Object.freeze(['Courier', 'Route', 'Shipment', 'Delivery', 'Proof', 'Return']),
    core_order_authority: 'commerce',
    core_inventory_authority: 'inventory',
    core_payment_authority: 'payments',
    core_customer_authority: 'customers',
    core_location_authority: 'locations',
    fulfillment_lifecycle_authority: 'app/src/logistics/fulfillment.js',
    stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    persistence: 'existing_order_and_core_state_only',
    duplicate_authority: false,
  });
}
