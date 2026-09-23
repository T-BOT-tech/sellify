// Phase 13.11.9 — Unified Fulfillment Contract.
//
// Canonical, persistence-neutral projection across the existing Commerce
// Order, Core Fulfillment, Warehouse, Logistics, Agriculture, and Restaurant
// boundaries. This module owns only the cross-pack contract shape; it does not
// own lifecycle mutation, stock mutation, persistence, dispatch, routing, or
// shipment state.

import { toPhysicalFlow } from './physical-flow.js';
import { getWarehouseFulfillmentContext } from '../verticals/warehouse/fulfillment-boundary.js';
import { getLogisticsFulfillmentContext } from '../verticals/logistics/fulfillment-boundary.js';
import {
  buildAgricultureLogisticsFulfillmentHandoff,
  isAgricultureLogisticsFulfillmentHandoff,
} from '../verticals/agriculture/warehouse-logistics-contract.js';
import {
  buildRestaurantWarehouseLogisticsContext,
  isRestaurantWarehouseLogisticsContext,
} from '../verticals/restaurant/warehouse-logistics-contract.js';

const VERSION = '1.0';
const TYPES = new Set(['pickup', 'delivery']);
const STATUSES = new Set(['pending', 'ready_for_pickup', 'picked_up', 'out_for_delivery', 'delivered']);
const FINAL_STATUSES = new Set(['picked_up', 'delivered']);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Unified Fulfillment ${field} must be a non-empty string`);
  return result;
}

function organizationOf(value) {
  return text(value?.organization_id ?? value?.organizationId, 'organization_id');
}

function assertScope(order, organizationId, locationId) {
  const organization_id = text(organizationId ?? organizationOf(order), 'organization_id');
  if (organizationOf(order) !== organization_id) {
    throw new TypeError('Unified Fulfillment order belongs to a different organization');
  }
  const orderLocation = order?.location_id ?? order?.locationId;
  if (locationId != null && orderLocation != null && String(orderLocation) !== String(locationId)) {
    throw new TypeError('Unified Fulfillment order belongs to a different location');
  }
  return {
    organization_id,
    location_id: orderLocation == null ? (locationId == null ? null : text(locationId, 'location_id')) : String(orderLocation),
  };
}

function assertCoreFulfillment(flow, warehouse, logistics) {
  if (!flow || !TYPES.has(flow.type)) throw new TypeError('Unified Fulfillment requires pickup or delivery');
  if (!STATUSES.has(flow.status)) throw new TypeError(`Unsupported fulfillment status: ${flow.status}`);
  if (warehouse.order_id !== flow.orderId || logistics.order_id !== flow.orderId) {
    throw new TypeError('Unified Fulfillment references must resolve to the same Core Order');
  }
  if (warehouse.fulfillment_type !== flow.type || logistics.fulfillment_type !== flow.type) {
    throw new TypeError('Unified Fulfillment type conflict');
  }
  if (warehouse.fulfillment_status !== flow.status || logistics.fulfillment_status !== flow.status) {
    throw new TypeError('Unified Fulfillment status conflict');
  }
}

/**
 * Build the canonical cross-pack fulfillment context for one existing Core
 * Commerce Order. Optional vertical contexts are validated as projections;
 * they never become fulfillment authorities.
 */
export function buildUnifiedFulfillmentContext({
  order,
  organizationId,
  locationId,
  agriculture,
  restaurant,
} = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const order_id = text(order.id, 'order_id');
  const scope = assertScope(order, organizationId, locationId);
  const physical_flow = toPhysicalFlow(order);
  const warehouse = getWarehouseFulfillmentContext(order);
  const logistics = getLogisticsFulfillmentContext(order);
  assertCoreFulfillment(physical_flow, warehouse, logistics);

  let agriculture_projection = null;
  if (agriculture != null) {
    if (!isAgricultureLogisticsFulfillmentHandoff(agriculture)) {
      throw new TypeError('Valid Agriculture fulfillment handoff is required');
    }
    if (agriculture.organization_id !== scope.organization_id) {
      throw new TypeError('Agriculture fulfillment belongs to a different organization');
    }
    if (agriculture.fulfillment.order_id !== order_id) {
      throw new TypeError('Agriculture fulfillment does not reference the Core Order');
    }
    agriculture_projection = Object.freeze({
      order_id,
      organization_id: agriculture.organization_id,
      idempotency_key: agriculture.agriculture_order_idempotency_key,
      authority: 'agriculture-semantic-projection',
    });
  }

  let restaurant_projection = null;
  if (restaurant != null) {
    if (!isRestaurantWarehouseLogisticsContext(restaurant)) {
      throw new TypeError('Valid Restaurant fulfillment context is required');
    }
    if (restaurant.organization_id !== scope.organization_id || restaurant.order_id !== order_id) {
      throw new TypeError('Restaurant fulfillment does not share Core Order scope');
    }
    if (scope.location_id != null && restaurant.location_id !== scope.location_id) {
      throw new TypeError('Restaurant fulfillment belongs to a different location');
    }
    restaurant_projection = Object.freeze({
      order_id,
      organization_id: restaurant.organization_id,
      location_id: restaurant.location_id,
      kitchen_ticket_id: restaurant.restaurant.kitchen_ticket_id,
      kitchen_status: restaurant.restaurant.kitchen_status,
      kitchen_ready: restaurant.restaurant.kitchen_ready,
      authority: 'restaurant-semantic-projection',
    });
  }

  return Object.freeze({
    version: VERSION,
    fulfillment_id: `unified-fulfillment:${order_id}`,
    organization_id: scope.organization_id,
    location_id: scope.location_id,
    order: Object.freeze({
      order_id,
      authority: 'commerce',
      source: 'core_order',
    }),
    fulfillment: Object.freeze({
      type: physical_flow.type,
      status: physical_flow.status,
      final: FINAL_STATUSES.has(physical_flow.status),
      authority: 'app/src/logistics/fulfillment.js',
      mutation_authority: 'app/src/logistics/fulfillment.js',
    }),
    warehouse: Object.freeze({
      role: 'consume_and_integrate',
      fulfillment_status: warehouse.fulfillment_status,
      stock_deducted: warehouse.stock_deducted,
      authority: 'warehouse-pack',
      stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    }),
    logistics: Object.freeze({
      role: 'coordinate_and_project',
      fulfillment_status: logistics.fulfillment_status,
      shipment_id: logistics.shipment_id,
      tracking_reference: logistics.tracking_reference,
      proof: logistics.proof,
      authority: 'logistics-pack',
    }),
    agriculture: agriculture_projection,
    restaurant: restaurant_projection,
    persistence: 'none',
    idempotency: `unified-fulfillment:${order_id}`,
    event_behavior: 'projection_only; existing Core event boundaries remain authoritative',
    dispatch: Object.freeze({ implemented: false, authority: null, persistence: 'none' }),
    route_implementation: false,
    duplicate_fulfillment_authority: false,
    duplicate_order_authority: false,
    duplicate_inventory_authority: false,
    reconciliation: 'same Core Order id, organization, location, fulfillment type, and fulfillment status across all projections',
  });
}

export function isUnifiedFulfillmentContext(value) {
  return Boolean(value && typeof value === 'object' &&
    value.version === VERSION &&
    typeof value.fulfillment_id === 'string' &&
    typeof value.organization_id === 'string' &&
    typeof value.order?.order_id === 'string' &&
    value.order?.authority === 'commerce' &&
    value.fulfillment?.authority === 'app/src/logistics/fulfillment.js' &&
    value.warehouse?.authority === 'warehouse-pack' &&
    value.logistics?.authority === 'logistics-pack' &&
    value.persistence === 'none' &&
    value.dispatch?.implemented === false &&
    value.route_implementation === false &&
    value.duplicate_fulfillment_authority === false &&
    value.duplicate_order_authority === false &&
    value.duplicate_inventory_authority === false);
}

export function unifiedFulfillmentContract() {
  return Object.freeze({
    version: VERSION,
    owner: 'canonical core authorities; cross-pack module owns projection semantics only',
    order_authority: 'commerce',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    inventory_authority: 'inventory',
    stock_mutation_authority: 'app/src/warehouse/inventory.js#applyStockChange',
    warehouse_role: 'consume_and_integrate',
    logistics_role: 'coordinate_and_project',
    agriculture_role: 'semantic_projection_only',
    restaurant_role: 'semantic_projection_only',
    organization_scope: 'required',
    location_scope: 'preserved_when_present',
    lifecycle: 'existing Core Fulfillment lifecycle only',
    idempotency: 'unified-fulfillment:<core-order-id>; existing event_id / stock guard remain authoritative',
    event_behavior: 'projection_only',
    dispatch_authority: null,
    dispatch_implemented: false,
    route_implementation: false,
    duplicate_order_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    persistence: 'none',
  });
}

export const UNIFIED_FULFILLMENT_CONTRACT = unifiedFulfillmentContract();

// Keep imported composition symbols intentionally referenced by this module's
// contract surface without executing any vertical mutation capability here.
export const unifiedFulfillmentComposition = Object.freeze({
  agriculture_handoff_builder: buildAgricultureLogisticsFulfillmentHandoff,
  restaurant_context_builder: buildRestaurantWarehouseLogisticsContext,
});
