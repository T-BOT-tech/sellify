/**
 * Canonical Workforce assignment contract.
 *
 * A workforce assignment links an existing workforce member to a location,
 * service resource, booking reference, or operational task. It does not
 * create a second user, organization, tenant, booking, supplier-network,
 * logistics, inventory, payment, fulfillment, or catalog authority.
 */

export const WORKFORCE_ASSIGNMENT_CONTRACT_VERSION = '1.0';

export const WORKFORCE_ASSIGNMENT_PERMISSIONS = Object.freeze({
  view: 'workforce:assignment:view',
  manage: 'workforce:assignment:manage',
});

export const WORKFORCE_ASSIGNMENT_TYPES = Object.freeze([
  'LOCATION',
  'RESOURCE',
  'BOOKING',
  'OPERATIONAL_TASK',
]);

export const WORKFORCE_ASSIGNMENT_STATUSES = Object.freeze([
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'ENDED',
]);

export const WORKFORCE_ASSIGNMENT_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['ACTIVE', 'ENDED']),
  ACTIVE: Object.freeze(['SUSPENDED', 'ENDED']),
  SUSPENDED: Object.freeze(['ACTIVE', 'ENDED']),
  ENDED: Object.freeze([]),
});

export const WORKFORCE_ASSIGNMENT_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'assignment_type',
  'starts_at',
  'ends_at',
  'expected_version',
]);

export function workforceAssignmentContract() {
  return Object.freeze({
    contract_version: WORKFORCE_ASSIGNMENT_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_assignment',
    organization_scoped: true,
    member_scoped: true,
    resource_scoped: true,
    location_scoped: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_ASSIGNMENT_PERMISSIONS,
    assignment_types: WORKFORCE_ASSIGNMENT_TYPES,
    statuses: WORKFORCE_ASSIGNMENT_STATUSES,
    transitions: WORKFORCE_ASSIGNMENT_TRANSITIONS,
    required_fields: WORKFORCE_ASSIGNMENT_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceAssignmentType(value) {
  return WORKFORCE_ASSIGNMENT_TYPES.includes(value);
}

export function isValidWorkforceAssignmentStatus(value) {
  return WORKFORCE_ASSIGNMENT_STATUSES.includes(value);
}

export function canTransitionWorkforceAssignmentStatus(currentStatus, nextStatus) {
  if (!isValidWorkforceAssignmentStatus(currentStatus)) return false;
  if (!isValidWorkforceAssignmentStatus(nextStatus)) return false;
  return WORKFORCE_ASSIGNMENT_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function validateWorkforceAssignment(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_ASSIGNMENT_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.assignment_type !== undefined &&
    !isValidWorkforceAssignmentType(input.assignment_type)
  ) {
    errors.push(`Invalid assignment_type: ${input.assignment_type}`);
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

export function workforceAssignmentPermission(action) {
  if (action === 'view') return WORKFORCE_ASSIGNMENT_PERMISSIONS.view;
  return WORKFORCE_ASSIGNMENT_PERMISSIONS.manage;
}
