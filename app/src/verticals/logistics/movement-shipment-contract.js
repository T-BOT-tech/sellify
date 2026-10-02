// Phase 13.10.19 — Logistics Movement / Shipment Relationship Contract.
//
// Productization boundary only. A Movement is the stable coordination
// projection connecting an existing Core Fulfillment to an existing
// shipment/tracking reference. This module creates no shipment store,
// movement ledger, route authority, or lifecycle mutation authority.
//
// Canonical relationship:
// Core Order → Core Fulfillment → Movement projection → Shipment reference
//                                      ↘ Tracking / external execution
//
// Multi-leg representation is deliberately deferred until an actual
// persistence/execution requirement exists. A future provider or network
// adapter must enter through the existing Canonical Contract → Adapter →
// Provider boundary.

const FULFILLMENT_TYPES = new Set(['pickup', 'delivery']);
const FULFILLMENT_STATUSES = new Set([
  'pending',
  'ready_for_pickup',
  'picked_up',
  'out_for_delivery',
  'delivered',
]);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Logistics ${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return requiredText(value, field);
}

export function buildLogisticsMovementProjection({ order, fulfillment = null } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');

  const orderId = requiredText(order.id, 'order_id');
  const type = requiredText(
    fulfillment?.fulfillment_type ?? order.fulfillment_type,
    'fulfillment_type',
  ).toLowerCase();
  if (!FULFILLMENT_TYPES.has(type)) {
    throw new TypeError(`Unsupported fulfillment type: ${type}`);
  }

  const status = requiredText(
    fulfillment?.fulfillment_status ?? order.fulfillment_status ?? 'pending',
    'fulfillment_status',
  ).toLowerCase();
  if (!FULFILLMENT_STATUSES.has(status)) {
    throw new TypeError(`Unsupported fulfillment status: ${status}`);
  }

  const fulfillmentOrderId = fulfillment?.order_id ?? order.id;
  if (String(fulfillmentOrderId) !== orderId) {
    throw new TypeError('Movement fulfillment must reference the same Core Order');
  }

  const shipmentId = optionalText(
    fulfillment?.shipment_id ?? order.shipment_id,
    'shipment_id',
  );
  const trackingReference = optionalText(
    fulfillment?.tracking_reference ?? order.tracking_reference,
    'tracking_reference',
  );

  if (shipmentId == null && trackingReference == null && status !== 'pending') {
    throw new TypeError('Non-pending movement requires shipment_id or tracking_reference');
  }

  const movementId = `movement:${orderId}`;

  return Object.freeze({
    movement_id: movementId,
    order_id: orderId,
    fulfillment_type: type,
    fulfillment_status: status,
    shipment_id: shipmentId,
    tracking_reference: trackingReference,
    movement_state: status,
    leg_model: 'not_yet_persisted',
    legs: Object.freeze([]),
    authority: 'logistics-pack-coordination-projection',
    order_authority: 'commerce',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    shipment_reference_authority: 'commerce_order',
    tracking_authority: shipmentId || trackingReference ? 'commerce_order_or_external_provider' : null,
    persistence: 'none',
    mutation_authority: 'none',
  });
}

export function isLogisticsMovementProjection(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.movement_id === 'string' &&
    typeof value.order_id === 'string' &&
    FULFILLMENT_TYPES.has(value.fulfillment_type) &&
    FULFILLMENT_STATUSES.has(value.fulfillment_status) &&
    value.leg_model === 'not_yet_persisted' &&
    Array.isArray(value.legs) &&
    value.legs.length === 0 &&
    value.authority === 'logistics-pack-coordination-projection' &&
    value.order_authority === 'commerce' &&
    value.fulfillment_authority === 'app/src/logistics/fulfillment.js' &&
    value.shipment_reference_authority === 'commerce_order' &&
    value.persistence === 'none' &&
    value.mutation_authority === 'none'
  );
}

export function logisticsMovementShipmentContract() {
  return Object.freeze({
    version: '1.0',
    relationship: 'core_fulfillment_to_shipment_reference',
    movement_authority: 'logistics-pack-coordination-projection',
    order_authority: 'commerce',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    shipment_reference_authority: 'commerce_order',
    tracking_authority: 'commerce_order_or_external_provider',
    leg_model: 'deferred_until_real_multi_leg_requirement',
    persistence: 'none',
    mutation_authority: 'none',
    route_authority: 'none',
    duplicate_shipment_store: false,
    duplicate_movement_ledger: false,
    duplicate_fulfillment_authority: false,
    adapter_boundary: 'Canonical Contract → Adapter → Provider',
    next_execution_boundary: 'existing Logistics provider/network contracts',
  });
}
