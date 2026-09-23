// Phase 13.11.7 — Agriculture ↔ Warehouse / Logistics integration contract.
// Persistence-neutral composition boundary over existing Agriculture, Warehouse,
// Core Fulfillment, and Logistics contracts. Agriculture keeps agricultural
// semantics; Warehouse keeps receiving semantics; Core Inventory keeps stock
// mutation/ledger authority; Core Fulfillment keeps lifecycle authority; Core
// Commerce keeps Order authority; Logistics coordinates physical delivery.

import { bridgeHarvestToInventory } from './inventory-contract.js';
import { buildWarehouseReceivingContract } from '../warehouse/receiving-contract.js';
import { getLogisticsFulfillmentContext } from '../logistics/fulfillment-boundary.js';

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Agriculture Warehouse/Logistics ${field} must be a non-empty string`);
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertSameOrganization(expected, ...records) {
  for (const record of records) {
    if (record && organizationOf(record) !== expected) {
      throw new TypeError('Agriculture Warehouse/Logistics reference belongs to a different organization');
    }
  }
}

function assertProduct(harvest, product) {
  if (!product || product.id == null) throw new TypeError('Existing Core Product is required');
  if (String(harvest.product_id) !== String(product.id)) {
    throw new TypeError('Agriculture Harvest must reference the supplied Core Product');
  }
}

/**
 * Normalize an existing Agriculture Harvest into the existing Warehouse
 * Receiving contract. No Warehouse Receiving record is created here.
 */
export function buildAgricultureWarehouseReceivingHandoff({
  harvest,
  product,
  collectionCenterLocation,
  receiving,
  warehouseLocation,
} = {}) {
  if (!harvest || harvest.entity_type !== 'Harvest') throw new TypeError('Agriculture Harvest is required');
  if (!receiving || typeof receiving !== 'object') throw new TypeError('Existing Warehouse Receiving is required');
  if (!warehouseLocation) throw new TypeError('Existing Core Warehouse Location is required');

  const org = organizationOf(harvest);
  assertSameOrganization(org, product, collectionCenterLocation, receiving, warehouseLocation);
  assertProduct(harvest, product);

  const agricultureInventory = bridgeHarvestToInventory({
    harvest,
    product,
    collectionCenterLocation,
  });
  const warehouseReceiving = buildWarehouseReceivingContract({
    receiving,
    product,
    location: warehouseLocation,
  });

  if (String(warehouseReceiving.product_id) !== String(agricultureInventory.product_id)) {
    throw new TypeError('Agriculture Harvest and Warehouse Receiving must reference the same Core Product');
  }
  if (String(warehouseReceiving.organization_id) !== org) {
    throw new TypeError('Agriculture Harvest and Warehouse Receiving must share organization scope');
  }

  return Object.freeze({
    context: 'agriculture-warehouse',
    operation: 'harvest-to-warehouse-receiving',
    organization_id: org,
    harvest_id: String(harvest.id),
    collection_center_location_id: agricultureInventory.location_id,
    warehouse_location_id: warehouseReceiving.location_id,
    product_id: agricultureInventory.product_id,
    quantity: agricultureInventory.quantity,
    agriculture_inventory: agricultureInventory,
    warehouse_receiving: warehouseReceiving,
    stock_authority: 'inventory',
    mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
    warehouse_authority: 'warehouse',
    location_authority: 'locations',
    idempotency: 'event_id',
    persistence: 'existing_agriculture_harvest_and_warehouse_receiving_contracts',
    direct_stock_mutation_by_agriculture: false,
    duplicate_inventory_authority: false,
  });
}

/**
 * Normalize an Agriculture commerce order into the existing Logistics
 * fulfillment projection. The supplied order must already be the canonical
 * Core Commerce Order; this contract does not create or mutate it.
 */
export function buildAgricultureLogisticsFulfillmentHandoff({
  organizationId,
  agricultureOrderHandoff,
  order,
} = {}) {
  const org = text(organizationId, 'organization_id');
  if (!agricultureOrderHandoff?.order) throw new TypeError('Agriculture Commerce Order handoff is required');
  if (!order || typeof order !== 'object') throw new TypeError('Existing Core Order is required');

  const expectedId = text(agricultureOrderHandoff.order.idempotency_key, 'order idempotency key');
  const fulfillment = getLogisticsFulfillmentContext(order);
  if (String(order.organization_id ?? org) !== org) {
    throw new TypeError('Core Order belongs to a different organization');
  }

  return Object.freeze({
    context: 'agriculture-logistics',
    operation: 'commerce-order-to-fulfillment',
    organization_id: org,
    agriculture_order_idempotency_key: expectedId,
    agriculture: Object.freeze({ ...agricultureOrderHandoff.order.agriculture }),
    fulfillment,
    order_authority: 'commerce',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    logistics_role: 'coordinate_and_project',
    location_authority: 'locations',
    mutation_authority: 'app/src/logistics/fulfillment.js',
    persistence: 'existing_core_order_fields_only',
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    route_implementation: false,
  });
}

/**
 * Compose the two existing physical handoffs without introducing a cross-pack
 * orchestrator. This is a read-only/persistence-neutral context object.
 */
export function buildAgricultureWarehouseLogisticsContext({
  harvest,
  product,
  collectionCenterLocation,
  receiving,
  warehouseLocation,
  organizationId,
  agricultureOrderHandoff,
  order,
} = {}) {
  const receivingHandoff = buildAgricultureWarehouseReceivingHandoff({
    harvest,
    product,
    collectionCenterLocation,
    receiving,
    warehouseLocation,
  });
  const logisticsHandoff = buildAgricultureLogisticsFulfillmentHandoff({
    organizationId,
    agricultureOrderHandoff,
    order,
  });

  if (receivingHandoff.organization_id !== logisticsHandoff.organization_id) {
    throw new TypeError('Agriculture Warehouse and Logistics contexts must share organization scope');
  }

  return Object.freeze({ receiving: receivingHandoff, logistics: logisticsHandoff });
}

export async function executeAgricultureWarehouseReceivingHandoff(handoff, { executeReceiving } = {}) {
  if (!isAgricultureWarehouseReceivingHandoff(handoff)) {
    throw new TypeError('Valid Agriculture Warehouse receiving handoff is required');
  }
  if (typeof executeReceiving !== 'function') {
    throw new TypeError('Existing Warehouse receiving capability is required');
  }
  return executeReceiving(handoff.warehouse_receiving);
}

export async function executeAgricultureLogisticsFulfillmentHandoff(handoff, { executeFulfillment } = {}) {
  if (!isAgricultureLogisticsFulfillmentHandoff(handoff)) {
    throw new TypeError('Valid Agriculture Logistics fulfillment handoff is required');
  }
  if (typeof executeFulfillment !== 'function') {
    throw new TypeError('Existing Core Fulfillment capability is required');
  }
  return executeFulfillment(handoff.fulfillment);
}

export function isAgricultureWarehouseReceivingHandoff(value) {
  return Boolean(
    value && typeof value === 'object' &&
    value.context === 'agriculture-warehouse' &&
    typeof value.organization_id === 'string' &&
    typeof value.harvest_id === 'string' &&
    typeof value.product_id === 'string' &&
    value.stock_authority === 'inventory' &&
    value.mutation_authority === 'app/src/warehouse/inventory.js#applyStockChange' &&
    value.ledger_authority === 'app/src/warehouse/ledger.js#recordInventoryMovement' &&
    value.warehouse_authority === 'warehouse' &&
    value.location_authority === 'locations' &&
    value.idempotency === 'event_id' &&
    value.direct_stock_mutation_by_agriculture === false &&
    value.duplicate_inventory_authority === false,
  );
}

export function isAgricultureLogisticsFulfillmentHandoff(value) {
  return Boolean(
    value && typeof value === 'object' &&
    value.context === 'agriculture-logistics' &&
    typeof value.organization_id === 'string' &&
    value.order_authority === 'commerce' &&
    value.fulfillment_authority === 'app/src/logistics/fulfillment.js' &&
    value.logistics_role === 'coordinate_and_project' &&
    value.location_authority === 'locations' &&
    value.duplicate_order_authority === false &&
    value.duplicate_fulfillment_authority === false &&
    value.route_implementation === false,
  );
}

export const AGRICULTURE_WAREHOUSE_LOGISTICS_CONTRACT = Object.freeze({
  agriculture_authority: Object.freeze([
    'Farmer', 'Farm', 'Plot', 'Season', 'Crop', 'Harvest',
    'Supply', 'Commodity', 'CollectionCenter', 'Buyer',
  ]),
  warehouse_authority: Object.freeze(['StorageBin', 'Receiving', 'StockAdjustment']),
  logistics_authority: Object.freeze(['Courier', 'Route', 'Shipment', 'Delivery', 'Proof', 'Return']),
  product_authority: 'commerce',
  order_authority: 'commerce',
  stock_authority: 'inventory',
  mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
  ledger_authority: 'app/src/warehouse/ledger.js#recordInventoryMovement',
  fulfillment_authority: 'app/src/logistics/fulfillment.js',
  location_authority: 'locations',
  warehouse_role: 'receive_and_coordinate',
  logistics_role: 'coordinate_and_project',
  inventory_idempotency: 'event_id',
  organization_scope: 'required',
  duplicate_inventory_authority: false,
  duplicate_order_authority: false,
  duplicate_fulfillment_authority: false,
  direct_stock_mutation_by_agriculture: false,
  route_implementation: false,
  persistence_added: false,
});
