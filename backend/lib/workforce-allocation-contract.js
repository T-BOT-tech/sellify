/**
 * Canonical Workforce allocation contract.
 *
 * A workforce allocation is an approved commitment that consumes availability.
 * It does not create a second user, organization, tenant, booking,
 * supplier-network, logistics, inventory, payment, fulfillment, or catalog
 * authority.
 */

export const WORKFORCE_ALLOCATION_CONTRACT_VERSION = '1.0';

export const WORKFORCE_ALLOCATION_PERMISSIONS = Object.freeze({
  view: 'workforce:allocation:view',
  manage: 'workforce:allocation:manage',
  release: 'workforce:allocation:release',
});

export const WORKFORCE_ALLOCATION_STATES = Object.freeze([
  'DRAFT',
  'PENDING_APPROVAL',
  'COMMITTED',
  'RELEASED',
  'CANCELLED',
]);

export const WORKFORCE_ALLOCATION_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['PENDING_APPROVAL', 'CANCELLED']),
  PENDING_APPROVAL: Object.freeze(['COMMITTED', 'CANCELLED']),
  COMMITTED: Object.freeze(['RELEASED', 'CANCELLED']),
  RELEASED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
});

export const WORKFORCE_ALLOCATION_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'starts_at',
  'ends_at',
  'expected_version',
]);

export function workforceAllocationContract() {
  return Object.freeze({
    contract_version: WORKFORCE_ALLOCATION_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_allocation',
    organization_scoped: true,
    member_scoped: true,
    resource_scoped: true,
    booking_scoped: true,
    operational_task_scoped: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_ALLOCATION_PERMISSIONS,
    states: WORKFORCE_ALLOCATION_STATES,
    transitions: WORKFORCE_ALLOCATION_TRANSITIONS,
    required_fields: WORKFORCE_ALLOCATION_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceAllocationState(value) {
  return WORKFORCE_ALLOCATION_STATES.includes(value);
}

export function canTransitionWorkforceAllocationState(currentState, nextState) {
  if (!isValidWorkforceAllocationState(currentState)) return false;
  if (!isValidWorkforceAllocationState(nextState)) return false;
  return WORKFORCE_ALLOCATION_TRANSITIONS[currentState].includes(nextState);
}

export function validateWorkforceAllocation(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_ALLOCATION_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.starts_at !== undefined &&
    input.ends_at !== undefined &&
    new Date(input.starts_at).getTime() >= new Date(input.ends_at).getTime()
  ) {
    errors.push('starts_at must be before ends_at');
  }

  if (
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function workforceAllocationPermission(action) {
  if (action === 'view') return WORKFORCE_ALLOCATION_PERMISSIONS.view;
  if (action === 'release') return WORKFORCE_ALLOCATION_PERMISSIONS.release;
  return WORKFORCE_ALLOCATION_PERMISSIONS.manage;
}
