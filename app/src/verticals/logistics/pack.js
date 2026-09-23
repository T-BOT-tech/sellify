// Phase 13.10 — Logistics Pack Boundary.
// Formalizes the existing Logistics implementation without creating a second
// order, fulfillment, inventory, customer, location, or payment authority.
import { defineVerticalPack } from '../contract.js';
import { VERTICAL_PACK_MANIFESTS } from '../../../../shared/vertical-pack-manifests.js';

export const LOGISTICS_PACK = defineVerticalPack(VERTICAL_PACK_MANIFESTS.logistics);

export const LOGISTICS_BOUNDARY = Object.freeze({
  pack_id: LOGISTICS_PACK.pack_id,
  existing_modules: Object.freeze({
    fulfillment: 'app/src/logistics/fulfillment.js',
    physical_flow: 'app/src/logistics/physical-flow.js',
    ui: 'app/src/logistics/ui.js',
  }),
  owns: Object.freeze(['Courier', 'Route', 'Shipment', 'Delivery', 'Proof', 'Return']),
  bridges_to_core: Object.freeze({
    order: 'commerce',
    product: 'commerce',
    inventory_stock: 'inventory',
    customer: 'customers',
    organization_location: 'locations',
    fulfillment_lifecycle: 'fulfillment',
    audit: 'audit',
  }),
  forbidden_parallel_authorities: Object.freeze([
    'LogisticsOrder', 'LogisticsInventory', 'LogisticsProduct', 'LogisticsPayment',
    'LogisticsCustomer', 'LogisticsLocation', 'LogisticsFulfillment', 'LogisticsLedger',
  ]),
});

export function isLogisticsPack(value = LOGISTICS_PACK) {
  return value === LOGISTICS_PACK || value?.pack_id === LOGISTICS_PACK.pack_id;
}
