// Phase 13.5 — persistence-neutral Agriculture → Inventory contract.
// This file contains no browser/storage imports so the contract can be
// regression-tested independently from the PWA runtime.

import { bridgeCollectionCenterToLocation } from './identity-bridge.js';
import { defineAgricultureEntity } from './pack.js';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

function positiveQuantity(value) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new TypeError('Agriculture harvest quantity must be greater than zero');
  }
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Agriculture inventory reference belongs to a different organization');
    }
  }
}

export function defineHarvest(input = {}) {
  const entity = defineAgricultureEntity('Harvest', input);
  const organizationId = entity.organization_id;
  const collectionCenterId = text(input.collection_center_id ?? input.collectionCenterId, 'Harvest collection_center_id');
  const productId = text(input.product_id ?? input.productId, 'Harvest product_id');
  const quantity = positiveQuantity(input.quantity);
  const eventId = text(input.event_id ?? input.eventId ?? `agriculture:harvest:${entity.id}:received`, 'Harvest event_id');

  return Object.freeze({
    ...entity,
    crop_id: text(input.crop_id ?? input.cropId, 'Harvest crop_id'),
    collection_center_id: collectionCenterId,
    product_id: productId,
    quantity,
    unit: input.unit == null ? null : text(input.unit, 'Harvest unit'),
    harvested_on: input.harvested_on ?? input.harvestedOn ?? null,
    event_id: eventId,
  });
}

export function bridgeHarvestToInventory({ harvest, product, collectionCenterLocation } = {}) {
  if (!harvest || harvest.entity_type !== 'Harvest') throw new TypeError('Agriculture Harvest is required');
  if (!product || product.id == null) throw new TypeError('Existing Core Product is required');
  if (!collectionCenterLocation) throw new TypeError('Existing Core Collection Center Location is required');

  const org = organizationOf(harvest);
  assertSameOrganization(org, collectionCenterLocation);
  const locationRef = bridgeCollectionCenterToLocation(collectionCenterLocation, org);
  const productId = text(product.id, 'Product id');
  if (productId !== harvest.product_id) throw new TypeError('Harvest must reference the supplied Product');

  return Object.freeze({
    harvest_id: harvest.id,
    product_id: productId,
    location_id: locationRef.core_id,
    organization_id: org,
    quantity: harvest.quantity,
    movement_type: 'PURCHASE',
    reference_type: 'agriculture_harvest',
    reference_id: harvest.id,
    event_id: harvest.event_id,
  });
}

export const AGRICULTURE_INVENTORY_CONTRACT = Object.freeze({
  authority: 'core_inventory',
  stock_mutation: 'applyStockChange',
  ledger: 'recordInventoryMovement',
  movement_type: 'PURCHASE',
  reference_type: 'agriculture_harvest',
});
