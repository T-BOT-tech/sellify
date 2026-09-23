// Phase 13.5 — Agriculture Inventory Bridge.
// Agriculture records harvests, but the existing Inventory authority remains
// responsible for stock mutation and the canonical inventory movement ledger.
// This bridge is deliberately persistence-neutral and does not create an
// AgricultureInventory authority.

import { config, inventoryMovements, products } from '../../state.js';
import { applyStockChange, isWarehouseEnabled } from '../../warehouse/inventory.js';
import { defineHarvest, bridgeHarvestToInventory } from './inventory-contract.js';

export function receiveHarvestIntoInventory({ harvest, product, collectionCenterLocation } = {}) {
  const movement = bridgeHarvestToInventory({ harvest, product, collectionCenterLocation });
  if (!isWarehouseEnabled()) {
    throw new Error('Agriculture harvest receipt requires Warehouse/Inventory to be enabled');
  }

  const existing = inventoryMovements.find((item) =>
    item.eventId === movement.event_id ||
    (item.referenceType === movement.reference_type && item.referenceId === movement.reference_id),
  );
  if (existing) return Object.freeze({ movement, transaction: null, alreadyRecorded: true });

  const transaction = applyStockChange(product.id, movement.quantity, 'received', {
    locationId: movement.location_id,
    referenceType: movement.reference_type,
    referenceId: movement.reference_id,
    eventId: movement.event_id,
    reason: 'Agriculture harvest received at collection center',
    metadata: {
      agricultureHarvestId: harvest.id,
      collectionCenterLocationId: movement.location_id,
    },
  });

  if (!transaction) throw new Error('Agriculture harvest receipt was not accepted by Inventory authority');
  return Object.freeze({ movement, transaction, alreadyRecorded: false });
}


export { defineHarvest, bridgeHarvestToInventory };

export function findCoreProduct(productId) {
  return products.find((product) => String(product.id) === String(productId)) || null;
}

export function currentAgricultureInventoryLocation() {
  return config.locationId || null;
}

export const AGRICULTURE_INVENTORY_BRIDGE = Object.freeze({
  authority: 'core_inventory',
  stock_mutation: 'applyStockChange',
  ledger: 'recordInventoryMovement',
  movement_type: 'PURCHASE',
  reference_type: 'agriculture_harvest',
});
