// L11.15 — Adversarial scheduling lifecycle certification contract.
//
// This is a test/invariant boundary. It does not create a second authority.

export const LOGISTICS_SCHEDULING_ADVERSARIAL_CONTRACT_VERSION = '1.0';

export function logisticsSchedulingAdversarialContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_ADVERSARIAL_CONTRACT_VERSION,
    invalid_transitions_block: true,
    cross_organization_access_block: true,
    stale_version_block: true,
    idempotency_key_reuse_conflict: true,
    authorization_boundary_enforced: true,
    failed_mutations_roll_back: true,
    terminal_states_are_final: true,
    scheduling_does_not_execute_operations: true,
  });
}

export function assertLogisticsSchedulingAdversarialInvariant({
  scenario,
  blocked,
  mutationRolledBack = true,
} = {}) {
  const expected = new Set([
    'INVALID_TRANSITION',
    'CROSS_ORGANIZATION',
    'STALE_VERSION',
    'IDEMPOTENCY_REUSE',
    'UNAUTHORIZED',
    'REFERENCE_SCOPE',
  ]);
  if (!expected.has(String(scenario))) {
    return { valid: false, reason: 'UNSUPPORTED_ADVERSARIAL_SCENARIO' };
  }
  if (!blocked) {
    return { valid: false, reason: 'ADVERSARIAL_CASE_NOT_BLOCKED' };
  }
  if (!mutationRolledBack) {
    return { valid: false, reason: 'FAILED_COMMAND_MUTATED_STATE' };
  }
  return { valid: true, reason: 'BLOCKED_AND_ROLLED_BACK' };
}
