// Phase 13.11.6 — Agriculture ↔ Commerce / Inventory integration contract.
// Persistence-neutral composition boundary over the existing Agriculture
// Commerce and Inventory bridges. Agriculture owns agricultural vocabulary;
// Core Commerce owns Product/Order; Core Inventory owns stock mutation and
// the movement ledger. No AgricultureOrder or AgricultureInventory is added.

import {
  bridgeAgricultureOfferToCommerceOrder,
} from './commerce-contract.js';
import {
  bridgeHarvestToInventory,
} from './inventory-contract.js';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture ${field} must be a non-empty string`);
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Agriculture Commerce/Inventory reference belongs to a different organization');
    }
  }
}

export function buildAgricultureCommerceHandoff({ offer, demand, buyerCustomer, coreProduct } = {}) {
  const bridge = bridgeAgricultureOfferToCommerceOrder({ offer, demand, buyerCustomer, coreProduct });
  return Object.freeze({
    context: 'agriculture',
    operation: 'offer-demand-order',
    organization_id: organizationOf(offer),
    order: bridge,
    order_authority: 'commerce',
    product_authority: 'commerce',
    payment_authority: 'payments',
    persistence: 'existing Core Commerce order',
    duplicate_order_authority: false,
    duplicate_product_authority: false,
  });
}

export function buildAgricultureInventoryHandoff({ harvest, product, collectionCenterLocation } = {}) {
  const bridge = bridgeHarvestToInventory({ harvest, product, collectionCenterLocation });
  return Object.freeze({
    context: 'agriculture',
    operation: 'harvest-receipt',
    organization_id: bridge.organization_id,
    inventory: bridge,
    stock_authority: 'inventory',
    mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
    idempotency: 'event_id',
    persistence: 'existing Core inventory movement',
    duplicate_inventory_authority: false,
    direct_stock_mutation_by_agriculture: false,
  });
}

export function buildAgricultureCommerceInventoryContext({
  offer,
  demand,
  buyerCustomer,
  harvest,
  coreProduct,
  collectionCenterLocation,
} = {}) {
  const commerce = buildAgricultureCommerceHandoff({ offer, demand, buyerCustomer, coreProduct });
  const inventory = buildAgricultureInventoryHandoff({
    harvest,
    product: coreProduct,
    collectionCenterLocation,
  });

  if (String(inventory.inventory.product_id) !== String(coreProduct.id)) {
    throw new TypeError('Agriculture Commerce and Inventory contexts must reference the same Core Product');
  }

  assertSameOrganization(commerce.organization_id, buyerCustomer, harvest, coreProduct, collectionCenterLocation);

  return Object.freeze({ commerce, inventory });
}

export async function executeAgricultureCommerceHandoff(handoff, { createOrder } = {}) {
  if (!handoff?.order || handoff.order_authority !== 'commerce') {
    throw new TypeError('Valid Agriculture Commerce handoff is required');
  }
  if (typeof createOrder !== 'function') throw new TypeError('Core Commerce order capability is required');
  return createOrder(handoff.order);
}

export async function executeAgricultureInventoryHandoff(handoff, { receiveHarvest } = {}) {
  if (!handoff?.inventory || handoff.stock_authority !== 'inventory') {
    throw new TypeError('Valid Agriculture Inventory handoff is required');
  }
  if (typeof receiveHarvest !== 'function') throw new TypeError('Existing Agriculture Inventory bridge is required');
  return receiveHarvest(handoff.inventory);
}

export function isAgricultureCommerceInventoryContext(value) {
  return Boolean(
    value && typeof value === 'object' &&
    value.commerce?.context === 'agriculture' &&
    value.commerce?.order_authority === 'commerce' &&
    value.commerce?.product_authority === 'commerce' &&
    value.commerce?.duplicate_order_authority === false &&
    value.inventory?.context === 'agriculture' &&
    value.inventory?.stock_authority === 'inventory' &&
    value.inventory?.duplicate_inventory_authority === false &&
    value.inventory?.direct_stock_mutation_by_agriculture === false &&
    value.commerce.organization_id === value.inventory.organization_id,
  );
}

export const AGRICULTURE_COMMERCE_INVENTORY_CONTRACT = Object.freeze({
  agriculture_semantic_authority: Object.freeze([
    'Farmer', 'Farm', 'Plot', 'Season', 'Crop', 'Harvest',
    'Supply', 'Commodity', 'CollectionCenter', 'Buyer',
  ]),
  order_authority: 'commerce',
  product_authority: 'commerce',
  payment_authority: 'payments',
  stock_authority: 'inventory',
  mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
  ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
  fulfillment_authority: 'fulfillment',
  order_persistence: 'existing Core Commerce order',
  inventory_persistence: 'existing Core inventory movement',
  inventory_idempotency: 'event_id',
  organization_scope: 'required',
  duplicate_order_authority: false,
  duplicate_inventory_authority: false,
  duplicate_payment_authority: false,
  direct_stock_mutation_by_agriculture: false,
  persistence_added: false,
});
