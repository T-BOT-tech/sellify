// L11.16 — Final scheduling lifecycle closure contract.
//
// Certification-only artifact. It consolidates the already implemented
// L11 scheduling boundaries and introduces no new operational authority.

export const LOGISTICS_SCHEDULING_CLOSURE_CONTRACT_VERSION = '1.0';

export const LOGISTICS_SCHEDULING_LIFECYCLE = Object.freeze([
  'REQUESTED',
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'MISSED',
  'EXPIRED',
]);

export const LOGISTICS_SCHEDULING_TERMINAL_STATES = Object.freeze([
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'MISSED',
  'EXPIRED',
]);

export function logisticsSchedulingClosureContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_CLOSURE_CONTRACT_VERSION,
    lifecycle: LOGISTICS_SCHEDULING_LIFECYCLE,
    terminal_states: LOGISTICS_SCHEDULING_TERMINAL_STATES,
    complete_lifecycle_covered: true,
    transactional_mutation_boundary: true,
    organization_scope_required: true,
    authorization_required: true,
    idempotency_required: true,
    optimistic_concurrency_required: true,
    audit_required: true,
    terminal_states_final: true,
    feasibility_is_authorization: false,
    scheduling_is_operational_execution: false,
    fulfillment_authority_duplicated: false,
    delivery_authority_duplicated: false,
    inventory_authority_duplicated: false,
    payment_authority_duplicated: false,
    settlement_authority_duplicated: false,
    provider_authority_duplicated: false,
    dispatch_authority_duplicated: false,
    baseline_ci_exception_documented: true,
  });
}

export function assertLogisticsSchedulingClosure({
  lifecycleCovered,
  targetedRuntimePass,
  unauthorizedMutation = false,
  crossScopeMutation = false,
  terminalReopened = false,
  downstreamMutation = false,
} = {}) {
  if (!lifecycleCovered) return { valid: false, reason: 'LIFECYCLE_NOT_FULLY_COVERED' };
  if (!targetedRuntimePass) return { valid: false, reason: 'TARGETED_RUNTIME_NOT_CERTIFIED' };
  if (unauthorizedMutation) return { valid: false, reason: 'UNAUTHORIZED_MUTATION_DETECTED' };
  if (crossScopeMutation) return { valid: false, reason: 'CROSS_SCOPE_MUTATION_DETECTED' };
  if (terminalReopened) return { valid: false, reason: 'TERMINAL_STATE_REOPENED' };
  if (downstreamMutation) return { valid: false, reason: 'DOWNSTREAM_AUTHORITY_MUTATED' };
  return { valid: true, reason: 'L11_CLOSURE_CERTIFIED' };
}
