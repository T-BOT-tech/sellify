// Phase 21.3 — Capacity / Availability Evidence composition contract.
//
// Supplier Network remains the sole authority for canonical capacity signals.
// Phase 21 adds an evidence-aware projection for sourcing coordination without
// turning capacity into inventory, procurement demand, or a second capacity store.
//
// Capacity ≠ capability ≠ inventory.
// A capacity observation is a time-bound statement about a capability/subject;
// it is not a stock ledger fact and does not authorize procurement or fulfillment.

export const PHASE21_CAPACITY_EVIDENCE_CONTRACT_VERSION = '1.0';
export const PHASE21_CAPACITY_EVIDENCE_AUTHORITY = 'supplier_network';
export const PHASE21_CAPACITY_EVIDENCE_PROVENANCE = Object.freeze(['SELF_REPORTED', 'OBSERVED', 'VERIFIED', 'UNKNOWN']);
export const PHASE21_CAPACITY_EVIDENCE_FRESHNESS = Object.freeze(['CURRENT', 'STALE', 'UNKNOWN']);
export const PHASE21_CAPACITY_EVIDENCE_CONSISTENCY = Object.freeze(['CONSISTENT', 'CONFLICTING', 'UNKNOWN']);
export const PHASE21_CAPACITY_EVIDENCE_QUALITY = Object.freeze([
  'SELF_REPORTED',
  'OBSERVED',
  'VERIFIED',
  'STALE',
  'UNKNOWN',
  'CONFLICTING',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 capacity evidence: ${message}`);
  error.code = 'PHASE21_CAPACITY_EVIDENCE_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field);
}

function positiveNumber(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) invalid(`${field} must be a positive number`);
  return result;
}

function iso(value, field) {
  const result = text(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(result);
  if (!match) invalid(`${field} must be a timezone-qualified ISO-8601 instant`);
  const [, year, month, day, , , , , zone] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year)
    || calendar.getUTCMonth() !== Number(month) - 1
    || calendar.getUTCDate() !== Number(day)
    || (zone !== 'Z' && Number(zone.slice(1, 3)) === 14 && zone.slice(4) !== '00')) {
    invalid(`${field} must be a valid timezone-qualified ISO-8601 instant`);
  }
  const time = Date.parse(result);
  if (!Number.isFinite(time)) invalid(`${field} must be a valid timezone-qualified ISO-8601 instant`);
  return new Date(time).toISOString();
}

function freezeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.freeze({ ...value });
}

/**
 * Project an existing Supplier Network capacity declaration/observation into
 * the Phase 21 sourcing vocabulary. No source record is persisted or re-owned.
 */
export function projectCapacityAvailabilityEvidence(signal = {}, options = {}) {
  if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
    invalid('signal must be an object');
  }

  const authority = optionalText(signal.authority, 'signal.authority');
  if (authority && authority !== PHASE21_CAPACITY_EVIDENCE_AUTHORITY) {
    invalid('signal.authority must be supplier_network');
  }

  const id = text(signal.id ?? signal.capacityId ?? signal.capacity_id, 'signal.id');
  const subjectType = String(signal.subjectType ?? signal.subject_type ?? 'CAPABILITY').trim().toUpperCase();
  if (!['PRODUCT', 'CAPABILITY'].includes(subjectType)) {
    invalid('signal.subjectType must be PRODUCT or CAPABILITY');
  }

  const subjectId = text(signal.subjectId ?? signal.subject_id ?? signal.capabilityId ?? signal.capability_id, 'signal.subjectId');
  const supplierOrganizationId = text(
    signal.supplierOrganizationId ?? signal.supplier_organization_id ?? signal.organizationId ?? signal.organization_id,
    'signal.supplierOrganizationId',
  );
  const quantity = positiveNumber(signal.quantity, 'signal.quantity');
  const unit = text(signal.unit, 'signal.unit');
  const quality = String(signal.quality ?? 'UNKNOWN').trim().toUpperCase();
  if (!PHASE21_CAPACITY_EVIDENCE_QUALITY.includes(quality)) {
    invalid(`signal.quality must be one of ${PHASE21_CAPACITY_EVIDENCE_QUALITY.join(', ')}`);
  }

  const observedAtInput = signal.observedAt ?? signal.observed_at;
  const observedAt = observedAtInput == null ? null : iso(observedAtInput, 'signal.observedAt');
  const validUntil = signal.validUntil ?? signal.valid_until;
  const normalizedValidUntil = validUntil == null ? null : iso(validUntil, 'signal.validUntil');
  if (normalizedValidUntil && observedAt && Date.parse(normalizedValidUntil) < Date.parse(observedAt)) {
    invalid('signal.validUntil must not be earlier than signal.observedAt');
  }
  const evaluatedAtInput = options.evaluatedAt ?? options.evaluated_at;
  const evaluatedAt = evaluatedAtInput == null ? null : iso(evaluatedAtInput, 'options.evaluatedAt');
  if (observedAt && evaluatedAt && Date.parse(evaluatedAt) < Date.parse(observedAt)) {
    invalid('options.evaluatedAt must not be earlier than signal.observedAt');
  }
  const freshness = !observedAt || !normalizedValidUntil || !evaluatedAt
    ? 'UNKNOWN'
    : Date.parse(normalizedValidUntil) >= Date.parse(evaluatedAt) ? 'CURRENT' : 'STALE';
  const source = optionalText(signal.source, 'signal.source');
  const provenanceType = source?.toUpperCase() === 'DECLARED' ? 'SELF_REPORTED' : 'UNKNOWN';
  const consistencyInput = String(signal.consistency ?? 'UNKNOWN').trim().toUpperCase();
  if (!PHASE21_CAPACITY_EVIDENCE_CONSISTENCY.includes(consistencyInput)) {
    invalid(`signal.consistency must be one of ${PHASE21_CAPACITY_EVIDENCE_CONSISTENCY.join(', ')}`);
  }

  return Object.freeze({
    capacityReference: Object.freeze({
      authority: PHASE21_CAPACITY_EVIDENCE_AUTHORITY,
      resource: 'supplier_network_capacity_signal',
      id,
    }),
    subjectReference: Object.freeze({
      authority: subjectType === 'CAPABILITY' ? 'supplier_network' : 'product_catalog',
      entity: subjectType,
      id: subjectId,
    }),
    supplierReference: Object.freeze({
      authority: 'organizations',
      entity: 'Organization',
      id: supplierOrganizationId,
    }),
    quantity,
    unit,
    availabilityWindow: Object.freeze({ observedAt, validUntil: normalizedValidUntil, evaluatedAt }),
    quality,
    provenanceType,
    freshness,
    consistency: consistencyInput,
    source,
    provenance: freezeObject(signal.provenance),
    metadata: freezeObject(signal.metadata),
    inventoryAuthority: 'existing inventory authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
  });
}

export function phase21CapacityAvailabilityEvidenceContract() {
  return Object.freeze({
    version: PHASE21_CAPACITY_EVIDENCE_CONTRACT_VERSION,
    authority: PHASE21_CAPACITY_EVIDENCE_AUTHORITY,
    sourceAuthority: 'supplier-network.capacity',
    identityAuthority: 'organizations',
    capacityResource: 'supplier_network_capacity_signal',
    quality: [...PHASE21_CAPACITY_EVIDENCE_QUALITY],
    provenance: [...PHASE21_CAPACITY_EVIDENCE_PROVENANCE],
    freshness: [...PHASE21_CAPACITY_EVIDENCE_FRESHNESS],
    consistency: [...PHASE21_CAPACITY_EVIDENCE_CONSISTENCY],
    inventoryAuthority: 'existing inventory authority',
    procurementAuthority: 'existing procurement authority',
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    providerExecution: false,
    principle: 'project canonical capacity signals with explicit evidence quality; do not create inventory or duplicate capacity authority',
  });
}
