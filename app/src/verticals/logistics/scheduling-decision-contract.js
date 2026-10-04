// L11.8 — Logistics Scheduling Decision Boundary.
//
// Converts a feasibility evaluation into a scheduling decision without
// authorizing execution. A scheduling activity may enter SCHEDULED only when
// feasibility is explicitly FEASIBLE. CONFLICT and UNKNOWN remain blocked.
//
// This contract does not mutate persistence, reserve capacity, authorize a
// provider, dispatch a courier, or execute fulfillment.

export const LOGISTICS_SCHEDULING_DECISION_CONTRACT_VERSION = '1.0';

export const LOGISTICS_SCHEDULING_DECISIONS = Object.freeze([
  'SCHEDULE',
  'BLOCK',
]);

export const LOGISTICS_SCHEDULING_BLOCK_REASONS = Object.freeze([
  'CONFLICT',
  'UNKNOWN_FEASIBILITY',
  'NOT_FEASIBLE',
]);

function invalid(message) {
  const error = new TypeError(`Invalid logistics scheduling decision: ${message}`);
  error.code = 'LOGISTICS_SCHEDULING_DECISION_INVALID';
  throw error;
}

export function decideLogisticsScheduling({ evaluation } = {}) {
  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    invalid('evaluation must be an object');
  }

  const outcome = String(
    evaluation.evaluation ?? evaluation.outcome ?? '',
  ).trim().toUpperCase();

  if (!['FEASIBLE', 'CONFLICT', 'UNKNOWN'].includes(outcome)) {
    invalid('evaluation must be FEASIBLE, CONFLICT, or UNKNOWN');
  }

  if (outcome === 'FEASIBLE') {
    if (evaluation.feasible !== true) {
      invalid('FEASIBLE evaluation must explicitly set feasible=true');
    }

    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_DECISION_CONTRACT_VERSION,
      decision: 'SCHEDULE',
      evaluation: 'FEASIBLE',
      reason: 'FEASIBLE',
      authorized: false,
      execution: false,
      persistence: 'none',
      mutation: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_DECISION_CONTRACT_VERSION,
    decision: 'BLOCK',
    evaluation: outcome,
    reason: outcome === 'CONFLICT' ? 'CONFLICT' : 'UNKNOWN_FEASIBILITY',
    authorized: false,
    execution: false,
    persistence: 'none',
    mutation: false,
  });
}

export function logisticsSchedulingDecisionContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_DECISION_CONTRACT_VERSION,
    decisions: [...LOGISTICS_SCHEDULING_DECISIONS],
    block_reasons: [...LOGISTICS_SCHEDULING_BLOCK_REASONS],
    feasible_allows_scheduling: true,
    conflict_allows_scheduling: false,
    unknown_allows_scheduling: false,
    feasibility_is_authorization: false,
    scheduling_is_execution: false,
    reserves_capacity: false,
    persistence: 'none',
    mutation: false,
  });
}
