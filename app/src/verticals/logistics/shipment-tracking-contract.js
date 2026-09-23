// Phase 13.10.9 — Shipment / Tracking Reference Contract.
// Formalizes shipment/tracking semantics over the existing Core Order and
// Fulfillment fields. This module is persistence-neutral: it does not create
// a second shipment store, tracking ledger, or carrier authority.

const FULFILLMENT_TYPES = new Set(['pickup', 'delivery']);
const TRACKING_SOURCES = new Set(['sellify', 'carrier', 'provider', 'manual', 'other']);

function text(value, field, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new TypeError(`Logistics ${field} must be a non-empty string`);
  return result || null;
}

function fulfillmentType(order) {
  const type = text(order?.fulfillment_type, 'fulfillment_type');
  if (!FULFILLMENT_TYPES.has(type)) {
    throw new TypeError(`Unsupported fulfillment type: ${type}`);
  }
  return type;
}

/**
 * Normalize a shipment/tracking reference for an existing Core Order.
 * The canonical order remains the source of truth for shipment_id and
 * tracking_reference. External carrier/provider data must be mapped through
 * an adapter before it reaches this boundary.
 */
export function normalizeShipmentTracking({ order, shipmentId, trackingReference, source = 'sellify' } = {}) {
  if (!order || typeof order !== 'object') throw new TypeError('Core Order is required');
  const orderId = text(order.id, 'order_id');
  const type = fulfillmentType(order);
  const existingShipmentId = text(order.shipment_id, 'shipment_id', false);
  const existingTrackingReference = text(order.tracking_reference, 'tracking_reference', false);
  const nextShipmentId = text(shipmentId ?? existingShipmentId, 'shipment_id', false);
  const nextTrackingReference = text(trackingReference ?? existingTrackingReference, 'tracking_reference', false);
  const normalizedSource = text(source, 'tracking source').toLowerCase();

  if (!TRACKING_SOURCES.has(normalizedSource)) {
    throw new TypeError(`Unsupported tracking source: ${normalizedSource}`);
  }
  if (!nextShipmentId && !nextTrackingReference) {
    throw new TypeError('Shipment must have shipment_id or tracking_reference');
  }

  if (existingShipmentId && nextShipmentId && existingShipmentId !== nextShipmentId) {
    throw new TypeError('Shipment id conflicts with existing Core Order shipment_id');
  }
  if (existingTrackingReference && nextTrackingReference && existingTrackingReference !== nextTrackingReference) {
    throw new TypeError('Tracking reference conflicts with existing Core Order tracking_reference');
  }

  return Object.freeze({
    order_id: orderId,
    fulfillment_type: type,
    shipment_id: nextShipmentId,
    tracking_reference: nextTrackingReference,
    tracking_source: normalizedSource,
    authority: 'commerce_order',
    external_tracking_authority: normalizedSource === 'carrier' || normalizedSource === 'provider'
      ? normalizedSource
      : null,
    persistence: 'existing_core_order_fields_only',
  });
}

export function isShipmentTrackingContract(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.order_id === 'string' &&
    FULFILLMENT_TYPES.has(value.fulfillment_type) &&
    (value.shipment_id !== null || value.tracking_reference !== null) &&
    typeof value.tracking_source === 'string' &&
    TRACKING_SOURCES.has(value.tracking_source) &&
    value.authority === 'commerce_order' &&
    value.persistence === 'existing_core_order_fields_only');
}

export function logisticsShipmentTrackingContract() {
  return Object.freeze({
    shipment_authority: 'commerce_order',
    tracking_reference_authority: 'commerce_order',
    external_tracking_authority: 'carrier_or_provider_when_external',
    logistics_role: 'coordinate_and_project',
    adapter_boundary: 'canonical_contract -> adapter -> provider',
    canonical_fields: Object.freeze(['shipment_id', 'tracking_reference']),
    conflict_policy: 'reject_conflicting_existing_reference',
    replay_policy: 'same_reference_is_safe_replay',
    persistence: 'existing_core_order_fields_only',
    duplicate_shipment_store: false,
    duplicate_tracking_ledger: false,
  });
}
