// Phase 13.9.1 — Warehouse Pack Boundary.
// Formalizes the existing Warehouse implementation without moving or rewriting it.
import { defineVerticalPack } from '../contract.js';
import { VERTICAL_PACK_MANIFESTS } from '../../../../shared/vertical-pack-manifests.js';

export const WAREHOUSE_PACK = defineVerticalPack(VERTICAL_PACK_MANIFESTS.warehouse);

export const WAREHOUSE_BOUNDARY = Object.freeze({
  pack_id: WAREHOUSE_PACK.pack_id,
  existing_modules: Object.freeze({
    inventory: 'app/src/warehouse/inventory.js',
    ledger: 'app/src/warehouse/ledger.js',
    locations: 'app/src/warehouse/locations.js',
    ui: 'app/src/warehouse/ui.js',
    fulfillment: 'app/src/logistics/fulfillment.js',
  }),
  owns: Object.freeze(['StorageBin', 'Receiving', 'StockAdjustment']),
  bridges_to_core: Object.freeze({
    product: 'commerce',
    inventory_stock: 'inventory',
    inventory_movement: 'inventory',
    organization_location: 'locations',
    order: 'commerce',
    customer: 'customers',
    fulfillment: 'fulfillment',
    audit: 'audit',
  }),
  forbidden_parallel_authorities: Object.freeze([
    'WarehouseOrder', 'WarehouseInventory', 'WarehouseProduct', 'WarehousePayment',
    'WarehouseCustomer', 'WarehouseLocation', 'WarehouseFulfillment', 'WarehouseLedger',
  ]),
});

export function isWarehousePack(value = WAREHOUSE_PACK) {
  return value === WAREHOUSE_PACK || value?.pack_id === WAREHOUSE_PACK.pack_id;
}
