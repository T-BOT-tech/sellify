// Phase 13.5 — Agriculture Inventory Bridge.
// Agriculture records harvests, but the existing Inventory authority remains
// responsible for stock mutation, persistence and movement replay.
// This bridge never creates an AgricultureInventory authority.

import { config, inventoryMovements, products } from '../../state.js';
import { recordCanonicalInventoryMovement } from '../../warehouse/ledger.js';
import { isWarehouseEnabled } from '../../warehouse/inventory.js';
import { defineHarvest, bridgeHarvestToInventory } from './inventory-contract.js';

export async function receiveHarvestIntoInventory({ harvest, product, collectionCenterLocation } = {}) {
  const movement = bridgeHarvestToInventory({ harvest, product, collectionCenterLocation });
  if (!isWarehouseEnabled()) {
    throw new Error('Agriculture harvest receipt requires Warehouse/Inventory to be enabled');
  }
  if (String(config.organizationId || '') !== String(movement.organization_id)) {
    throw new Error('Agriculture harvest organization does not match the active Inventory organization');
  }

  const existing = inventoryMovements.find(item =>
    String(item.eventId || '') === movement.event_id && item.syncStatus === 'synced'
  );
  if (existing) {
    if (
      String(existing.productId) !== movement.product_id
      || Number(existing.quantity) !== movement.quantity
      || String(existing.movementType || '').toUpperCase() !== 'PURCHASE'
      || String(existing.locationId || '') !== movement.location_id
      || String(existing.organizationId || '') !== movement.organization_id
    ) {
      throw Object.assign(new Error('Agriculture harvest movement identity is already confirmed with different intent'), {
        code: 'INVENTORY_MOVEMENT_IDEMPOTENCY_CONFLICT',
      });
    }
    return Object.freeze({ movement, transaction: null, status: 'confirmed', alreadyRecorded: true });
  }

  const transaction = await recordCanonicalInventoryMovement({
    productId: movement.product_id,
    quantity: movement.quantity,
    movementType: 'PURCHASE',
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

  if (!transaction || typeof transaction !== 'object') {
    throw new Error('Agriculture harvest receipt was not accepted by Inventory authority');
  }
  return Object.freeze({
    movement,
    transaction,
    status: transaction.queued ? 'pending' : 'confirmed',
    alreadyRecorded: Boolean(transaction.duplicate),
  });
}

export { defineHarvest, bridgeHarvestToInventory };

export function findCoreProduct(productId) {
  return products.find(product => String(product.id) === String(productId)) || null;
}

export function currentAgricultureInventoryLocation() {
  return config.locationId || null;
}

export const AGRICULTURE_INVENTORY_BRIDGE = Object.freeze({
  authority: 'core_inventory',
  stock_mutation: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
  ledger: 'app/src/warehouse/ledger.js#recordCanonicalInventoryMovement',
  movement_type: 'PURCHASE',
  reference_type: 'agriculture_harvest',
});
