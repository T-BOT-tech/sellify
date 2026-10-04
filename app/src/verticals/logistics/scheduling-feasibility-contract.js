// L11.6 — Logistics Scheduling Feasibility / Conflict Evaluation Contract.
//
// Pure evaluation boundary only. It evaluates a scheduling candidate against
// already-known scheduling activities and optionally consumes an externally
// supplied authoritative feasibility signal. It does not reserve capacity,
// create a calendar, select a provider, dispatch a courier, mutate fulfillment,
// or create a second capacity/matching authority.
//
// Principles:
// - FEASIBILITY != AUTHORIZATION.
// - FEASIBLE != CONFIRMED.
// - UNKNOWN != SUCCESS.
// - Absence of a resource conflict must not be interpreted as proof that
//   physical capacity exists.
// - Existing canonical references remain authoritative.

import {
  normalizeLogisticsSchedulingRequest,
  SCHEDULING_EVALUATION_OUTCOMES,
} from './scheduling-contract.js';

export const LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION = '1.0';

export const LOGISTICS_SCHEDULING_FEASIBILITY_REASONS = Object.freeze([
  'NO_TIME_WINDOW',
  'EXISTING_ACTIVITY_OVERLAP',
  'EXTERNAL_CAPACITY_CONFLICT',
  'EXTERNAL_CAPACITY_UNKNOWN',
  'NO_AUTHORITATIVE_CAPACITY_DECISION',
  'NO_CONFLICT',
]);

const OUTCOMES = new Set(SCHEDULING_EVALUATION_OUTCOMES);

function invalid(message, code = 'LOGISTICS_SCHEDULING_FEASIBILITY_INVALID') {
  const error = new TypeError(`Invalid logistics scheduling feasibility: ${message}`);
  error.code = code;
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

function timestamp(value, field) {
  const result = text(value, field);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed)) invalid(`${field} must be an ISO-8601 timestamp`);
  return parsed;
}

function windowOf(value, prefix = '') {
  const start = value?.scheduledStart ?? value?.scheduled_start;
  const end = value?.scheduledEnd ?? value?.scheduled_end;
  if (!start || !end) return null;
  const startMs = timestamp(start, `${prefix}scheduled_start`);
  const endMs = timestamp(end, `${prefix}scheduled_end`);
  if (endMs < startMs) invalid(`${prefix}scheduled_end must not precede scheduled_start`);
  return { startMs, endMs };
}

function overlaps(left, right) {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

function canonicalReferenceIds(candidate) {
  const related = candidate.related || {};
  return new Set([
    related.order?.id || candidate.relatedOrderId,
    related.fulfillment?.id || candidate.relatedFulfillmentId,
    related.movement?.id || candidate.relatedMovementId,
  ].filter(Boolean).map(String));
}

function sharesCanonicalReference(candidate, existing) {
  const candidateIds = canonicalReferenceIds(candidate);
  const existingIds = canonicalReferenceIds(existing);
  for (const id of candidateIds) {
    if (existingIds.has(id)) return true;
  }
  return false;
}

function normalizeExternalEvaluation(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('externalEvaluation must be an object');
  }

  const outcome = String(value.outcome ?? value.evaluation ?? '').trim().toUpperCase();
  if (!OUTCOMES.has(outcome)) {
    invalid('externalEvaluation.outcome must be FEASIBLE, CONFLICT, or UNKNOWN');
  }

  return Object.freeze({
    outcome,
    authority: optionalText(value.authority, 'externalEvaluation.authority'),
    referenceId: optionalText(
      value.referenceId ?? value.reference_id,
      'externalEvaluation.referenceId',
    ),
  });
}

function activeStatus(status) {
  return ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(
    String(status || '').trim().toUpperCase(),
  );
}

/**
 * Evaluate a scheduling request without mutating any authority.
 *
 * existingActivities must contain already persisted/known scheduling records.
 * The evaluator only treats an overlap as a conflict when the candidate and
 * existing activity share a canonical Order, Fulfillment, or Movement
 * reference. It intentionally does not infer that two unrelated activities
 * at the same location require the same physical resource.
 *
 * externalEvaluation may carry a result from an existing capacity/discovery
 * authority. Scheduling consumes that result; it does not calculate a new
 * capacity or matching score.
 */
export function evaluateLogisticsSchedulingFeasibility({
  request = {},
  existingActivities = [],
  externalEvaluation = null,
} = {}) {
  const candidate = normalizeLogisticsSchedulingRequest(request);
  const candidateWindow = windowOf(candidate);

  if (!candidateWindow) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
      evaluation: 'UNKNOWN',
      reason: 'NO_TIME_WINDOW',
      conflictingActivityIds: Object.freeze([]),
      externalEvaluation: null,
      feasible: false,
      authorized: false,
      execution: false,
      persistence: 'none',
      mutation: false,
    });
  }

  if (!Array.isArray(existingActivities)) {
    invalid('existingActivities must be an array');
  }

  const conflicts = [];
  for (const existing of existingActivities) {
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      invalid('each existingActivities entry must be an object');
    }
    if (String(existing.organizationId ?? existing.organization_id ?? '') !== candidate.organization_id) {
      continue;
    }
    if (!activeStatus(existing.status)) continue;
    if (candidate.location_id &&
        String(existing.locationId ?? existing.location_id ?? '') !== candidate.location_id) {
      continue;
    }
    if (String(existing.activityType ?? existing.activity_type ?? '') !== candidate.activity_type) {
      continue;
    }
    if (!sharesCanonicalReference(candidate, existing)) continue;

    const existingWindow = windowOf(existing, 'existing.');
    if (existingWindow && overlaps(candidateWindow, existingWindow)) {
      conflicts.push(String(existing.id));
    }
  }

  const external = normalizeExternalEvaluation(externalEvaluation);

  if (conflicts.length) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
      evaluation: 'CONFLICT',
      reason: 'EXISTING_ACTIVITY_OVERLAP',
      conflictingActivityIds: Object.freeze(conflicts),
      externalEvaluation: external,
      feasible: false,
      authorized: false,
      execution: false,
      persistence: 'none',
      mutation: false,
    });
  }

  if (external?.outcome === 'CONFLICT') {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
      evaluation: 'CONFLICT',
      reason: 'EXTERNAL_CAPACITY_CONFLICT',
      conflictingActivityIds: Object.freeze([]),
      externalEvaluation: external,
      feasible: false,
      authorized: false,
      execution: false,
      persistence: 'none',
      mutation: false,
    });
  }

  if (external?.outcome === 'UNKNOWN') {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
      evaluation: 'UNKNOWN',
      reason: 'EXTERNAL_CAPACITY_UNKNOWN',
      conflictingActivityIds: Object.freeze([]),
      externalEvaluation: external,
      feasible: false,
      authorized: false,
      execution: false,
      persistence: 'none',
      mutation: false,
    });
  }

  if (external?.outcome === 'FEASIBLE') {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
      evaluation: 'FEASIBLE',
      reason: 'NO_CONFLICT',
      conflictingActivityIds: Object.freeze([]),
      externalEvaluation: external,
      feasible: true,
      authorized: false,
      execution: false,
      persistence: 'none',
      mutation: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
    evaluation: 'UNKNOWN',
    reason: 'NO_AUTHORITATIVE_CAPACITY_DECISION',
    conflictingActivityIds: Object.freeze([]),
    externalEvaluation: null,
    feasible: false,
    authorized: false,
    execution: false,
    persistence: 'none',
    mutation: false,
  });
}

export function logisticsSchedulingFeasibilityContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_FEASIBILITY_CONTRACT_VERSION,
    outcomes: [...SCHEDULING_EVALUATION_OUTCOMES],
    reasons: [...LOGISTICS_SCHEDULING_FEASIBILITY_REASONS],
    consumesExistingSchedulingRecords: true,
    createsCapacityAuthority: false,
    createsMatchingAuthority: false,
    createsCalendarAuthority: false,
    reservesCapacity: false,
    authorizesExecution: false,
    mutatesSchedulingState: false,
    persistence: 'none',
    principle: 'evaluate known conflicts and consume authoritative external feasibility signals without inferring capacity success',
  });
}
