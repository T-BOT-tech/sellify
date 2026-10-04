// L11.14 — Scheduling lifecycle invariant certification contract.
//
// This contract describes invariants that must hold across every scheduling
// transition. It does not authorize or execute operational outcomes.

export const LOGISTICS_SCHEDULING_LIFECYCLE_INVARIANT_CONTRACT_VERSION = '1.0';

export function logisticsSchedulingLifecycleInvariantContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_LIFECYCLE_INVARIANT_CONTRACT_VERSION,
    organization_scoped: true,
    authorization_required: true,
    idempotency_key_required: true,
    optimistic_version_supported: true,
    state_transition_must_be_validated: true,
    audit_event_required_for_committed_transition: true,
    audit_event_is_transactional: true,
    downstream_fulfillment_mutation: false,
    downstream_delivery_mutation: false,
    inventory_mutation: false,
    payment_mutation: false,
    settlement_mutation: false,
    provider_selection: false,
    dispatch_execution: false,
    scheduling_is_operational_authority: false,
  });
}

export function assertLogisticsSchedulingLifecycleInvariant({
  organizationId,
  rowOrganizationId,
  stateChanged,
  auditWritten,
  idempotent,
  downstreamMutations = {},
} = {}) {
  if (String(organizationId ?? '') !== String(rowOrganizationId ?? '')) {
    return { valid: false, reason: 'ORGANIZATION_SCOPE_VIOLATION' };
  }
  if (stateChanged && !auditWritten && !idempotent) {
    return { valid: false, reason: 'AUDIT_REQUIRED_FOR_STATE_CHANGE' };
  }
  const forbidden = [
    'fulfillment',
    'delivery',
    'inventory',
    'payment',
    'settlement',
    'provider',
    'dispatch',
  ];
  const mutation = forbidden.find(key => Boolean(downstreamMutations?.[key]));
  if (mutation) {
    return { valid: false, reason: `DOWNSTREAM_MUTATION_FORBIDDEN:${mutation}` };
  }
  return { valid: true, reason: idempotent ? 'IDEMPOTENT_REPLAY' : 'VALID' };
}
