// Phase 13.11.8 — Restaurant ↔ Warehouse / Logistics integration contract.
// Persistence-neutral composition over the existing Restaurant, Warehouse and
// Logistics boundaries. Restaurant owns kitchen/table/recipe/preparation
// semantics; Commerce owns the Order/Product identity; Warehouse consumes the
// physical fulfillment projection; Logistics coordinates Shipment/Delivery /
// Proof. No RestaurantWarehouse, RestaurantLogistics or duplicate fulfillment
// authority is introduced.

import { normalizeRestaurantOrder } from './order-payment-compatibility.js';
import { createKitchenTicketFromOrder } from './kitchen-integration.js';
import { getWarehouseFulfillmentContext } from '../warehouse/fulfillment-boundary.js';
import { getLogisticsFulfillmentContext } from '../logistics/fulfillment-boundary.js';

const READY_KITCHEN_STATUSES = new Set(['ready', 'served']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Restaurant ${field} must be a non-empty string`);
  return result;
}

function requirePhysicalOrder(order) {
  const type = text(order?.fulfillment_type, 'fulfillment_type');
  if (type !== 'pickup' && type !== 'delivery') {
    throw new TypeError(`Restaurant order ${String(order?.id ?? '')} must use pickup or delivery fulfillment`);
  }
}

export function buildRestaurantWarehouseLogisticsContext(
  order,
  { organizationId, locationId } = {},
) {
  if (!order || typeof order !== 'object') throw new TypeError('Restaurant order is required');
  requirePhysicalOrder(order);

  const normalized = normalizeRestaurantOrder(order, { organizationId, locationId });
  if (order.organization_id != null && String(order.organization_id) !== normalized.organization_id) {
    throw new TypeError(`Restaurant order ${normalized.order_id} belongs to a different organization`);
  }
  if (order.location_id != null && String(order.location_id) !== normalized.location_id) {
    throw new TypeError(`Restaurant order ${normalized.order_id} belongs to a different location`);
  }
  const kitchen = createKitchenTicketFromOrder(order, {
    organizationId: normalized.organization_id,
    locationId: normalized.location_id,
  });
  const warehouse = getWarehouseFulfillmentContext(order);
  const logistics = getLogisticsFulfillmentContext(order);

  if (warehouse.order_id !== normalized.order_id || logistics.order_id !== normalized.order_id) {
    throw new TypeError(`Restaurant physical context order identity mismatch for ${normalized.order_id}`);
  }
  if (warehouse.fulfillment_type !== normalizedFulfillmentType(order)) {
    throw new TypeError(`Restaurant fulfillment type mismatch for ${normalized.order_id}`);
  }
  if (kitchen.organization_id !== normalized.organization_id || kitchen.location_id !== normalized.location_id) {
    throw new TypeError(`Restaurant kitchen context scope mismatch for ${normalized.order_id}`);
  }

  const kitchen_ready = READY_KITCHEN_STATUSES.has(kitchen.status);

  return Object.freeze({
    order_id: normalized.order_id,
    organization_id: normalized.organization_id,
    location_id: normalized.location_id,
    restaurant: Object.freeze({
      kitchen_ticket_id: kitchen.ticket_id,
      kitchen_status: kitchen.status,
      kitchen_ready,
      table_id: kitchen.table_id,
    }),
    warehouse: Object.freeze({
      fulfillment_type: warehouse.fulfillment_type,
      fulfillment_status: warehouse.fulfillment_status,
      stock_deducted: warehouse.stock_deducted,
      final: warehouse.final,
      role: 'consume_and_integrate',
    }),
    logistics: Object.freeze({
      fulfillment_type: logistics.fulfillment_type,
      fulfillment_status: logistics.fulfillment_status,
      shipment_id: logistics.shipment_id,
      tracking_reference: logistics.tracking_reference,
      final: logistics.final,
      role: 'coordinate_and_project',
    }),
    order_authority: 'commerce',
    product_authority: 'commerce',
    inventory_authority: 'inventory',
    stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    warehouse_authority: 'warehouse-pack',
    logistics_authority: 'logistics-pack',
    idempotency: 'existing Core event_id / order stock guard',
    persistence: 'none',
  });
}

function normalizedFulfillmentType(order) {
  return String(order.fulfillment_type).trim();
}

export function isRestaurantWarehouseLogisticsContext(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.order_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.location_id === 'string' &&
    value.order_authority === 'commerce' &&
    value.product_authority === 'commerce' &&
    value.inventory_authority === 'inventory' &&
    value.stock_mutation_authority === 'app/src/warehouse/inventory.js#applyStockChange' &&
    value.fulfillment_authority === 'app/src/logistics/fulfillment.js' &&
    value.warehouse_authority === 'warehouse-pack' &&
    value.logistics_authority === 'logistics-pack' &&
    value.persistence === 'none');
}

export function restaurantWarehouseLogisticsContract() {
  return Object.freeze({
    restaurant_authority: Object.freeze(['Table', 'KitchenTicket', 'Recipe', 'Preparation']),
    order_authority: 'commerce',
    product_authority: 'commerce',
    inventory_authority: 'inventory',
    warehouse_role: 'consume_and_integrate',
    logistics_role: 'coordinate_and_project',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    location_authority: 'locations',
    kitchen_ready_gate: Object.freeze(['ready', 'served']),
    duplicate_restaurant_fulfillment_authority: false,
    duplicate_restaurant_inventory_authority: false,
    duplicate_restaurant_order_authority: false,
    persistence: 'none',
    route_implementation: 'not introduced',
  });
}
