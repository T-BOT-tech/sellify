// Phase 13.10.20 — Logistics Tracking / Evidence Projection Contract.
//
// This is a normalization boundary over existing shipment/tracking references,
// provider callbacks, and delivery proof. It does not create a tracking ledger,
// GPS authority, evidence store, or provider state store.

const TRACKING_KINDS = new Set([
  'status',
  'location',
  'checkpoint',
  'eta',
  'exception',
  'proof',
]);

const STATUS_VALUES = new Set([
  'accepted',
  'in_progress',
  'out_for_delivery',
  'arrived',
  'delivered',
  'failed',
  'returned',
  'exception',
]);

function text(value, field, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new TypeError(`Logistics tracking ${field} must be a non-empty string`);
  return result || null;
}

function object(value, field) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Logistics tracking ${field} must be an object`);
  }
  return value;
}

export function normalizeLogisticsTrackingEvidence(input = {}) {
  const shipmentId = text(input.shipment_id, 'shipment_id', false);
  const trackingReference = text(input.tracking_reference, 'tracking_reference', false);
  if (!shipmentId && !trackingReference) {
    throw new TypeError('Tracking evidence requires shipment_id or tracking_reference');
  }

  const kind = text(input.kind, 'kind').toLowerCase();
  if (!TRACKING_KINDS.has(kind)) throw new TypeError(`Unsupported tracking evidence kind: ${kind}`);

  const occurredAt = text(input.occurred_at, 'occurred_at');
  const source = text(input.source, 'source').toLowerCase();
  const sourceReference = text(input.source_reference, 'source_reference');
  const status = input.status == null ? null : text(input.status, 'status').toLowerCase();
  const location = object(input.location, 'location');
  const evidence = object(input.evidence, 'evidence');

  if (status && !STATUS_VALUES.has(status)) {
    throw new TypeError(`Unsupported tracking status: ${status}`);
  }
  if (kind === 'location' && !location) {
    throw new TypeError('Location tracking evidence requires location data');
  }
  if (kind === 'proof' && !evidence) {
    throw new TypeError('Proof tracking evidence requires evidence data');
  }

  return Object.freeze({
    shipment_id: shipmentId,
    tracking_reference: trackingReference,
    kind,
    status,
    occurred_at: occurredAt,
    source,
    source_reference: sourceReference,
    location,
    evidence,
    authority: 'existing_shipment_tracking_and_domain_state',
    persistence: 'none',
    tracking_ledger: false,
    gps_authority: false,
    evidence_store: false,
  });
}

export function projectLogisticsTrackingEvidence({ shipment, event } = {}) {
  if (!shipment || typeof shipment !== 'object') {
    throw new TypeError('Existing shipment/tracking reference is required');
  }
  const normalized = normalizeLogisticsTrackingEvidence({
    shipment_id: shipment.shipment_id,
    tracking_reference: shipment.tracking_reference,
    ...event,
  });

  return Object.freeze({
    ...normalized,
    canonical_authority: shipment.authority ?? 'commerce_order',
    external_authority: normalized.source === 'carrier' || normalized.source === 'provider'
      ? normalized.source
      : null,
    execution_boundary: 'existing_domain_transaction_and_outbox',
  });
}

export function isLogisticsTrackingEvidence(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    (typeof value.shipment_id === 'string' || typeof value.tracking_reference === 'string') &&
    TRACKING_KINDS.has(value.kind) &&
    typeof value.occurred_at === 'string' &&
    typeof value.source === 'string' &&
    typeof value.source_reference === 'string' &&
    value.authority === 'existing_shipment_tracking_and_domain_state' &&
    value.persistence === 'none' &&
    value.tracking_ledger === false &&
    value.gps_authority === false &&
    value.evidence_store === false
  );
}

export function logisticsTrackingEvidenceContract() {
  return Object.freeze({
    version: '1.0',
    purpose: 'normalize tracking events and evidence over existing shipment/domain state',
    shipment_reference_authority: 'commerce_order',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    external_source_boundary: 'provider_or_carrier_via_existing_adapter',
    event_boundary: 'app/src/events/event-boundary.js',
    persistence: 'none',
    tracking_ledger: false,
    gps_authority: false,
    evidence_store: false,
    route_authority: 'existing_logistics_route_scope_only',
    mutation_authority: 'existing_domain_transaction',
    proof_authority: 'existing_logistics_proof_contract',
    unknown_state_policy: 'do_not_infer_success_from_missing_evidence',
  });
}
