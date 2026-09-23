import assert from 'node:assert/strict';
import { defineHarvest, bridgeHarvestToInventory, AGRICULTURE_INVENTORY_CONTRACT } from '../app/src/verticals/agriculture/inventory-contract.js';

const org = 'org-13-5';
const harvest = defineHarvest({
  id: 'harvest-1', organization_id: org, crop_id: 'crop-1',
  collection_center_id: 'cc-1', product_id: 'product-1', quantity: 125,
});
const product = { id: 'product-1', name: 'Maize' };
const location = { id: 'location-1', organization_id: org, status: 'active' };
const bridge = bridgeHarvestToInventory({ harvest, product, collectionCenterLocation: location });

assert.equal(bridge.organization_id, org);
assert.equal(bridge.location_id, 'location-1');
assert.equal(bridge.product_id, 'product-1');
assert.equal(bridge.quantity, 125);
assert.equal(bridge.movement_type, 'PURCHASE');
assert.equal(bridge.reference_type, 'agriculture_harvest');
assert.equal(bridge.reference_id, 'harvest-1');
assert.equal(bridge.event_id, 'agriculture:harvest:harvest-1:received');
assert.equal(AGRICULTURE_INVENTORY_CONTRACT.authority, 'core_inventory');
assert.equal(AGRICULTURE_INVENTORY_CONTRACT.stock_mutation, 'applyStockChange');
assert.equal(AGRICULTURE_INVENTORY_CONTRACT.ledger, 'recordInventoryMovement');

assert.throws(
  () => bridgeHarvestToInventory({ harvest, product, collectionCenterLocation: { ...location, organization_id: 'other-org' } }),
  /different organization/,
);
assert.throws(
  () => defineHarvest({ id: 'harvest-2', organization_id: org, crop_id: 'crop-1', collection_center_id: 'cc-1', product_id: 'product-1', quantity: 0 }),
  /greater than zero/,
);
assert.throws(
  () => bridgeHarvestToInventory({ harvest, product: { id: 'other-product' }, collectionCenterLocation: location }),
  /supplied Product/,
);

console.log('Phase 13.5 Agriculture Inventory Bridge Regression: PASS');
