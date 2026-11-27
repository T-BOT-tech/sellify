/**
 * Canonical Workforce member lifecycle contract.
 *
 * A Workforce member is an organization-scoped professional record. It may
 * optionally link to an existing Sellify user; external professionals do not
 * need a login. Identity and Membership remain the authentication and
 * organization-authorization authorities. This contract does not create a
 * second user, organization, tenant, booking, supplier-network, logistics,
 * inventory, payment, fulfillment, or catalog authority.
 */

import {
  WORKFORCE_MEMBER_TYPES,
  WORKFORCE_MEMBER_STATUSES,
  isValidWorkforceMemberType,
  isValidWorkforceMemberStatus,
} from './workforce-contract.js';

export const WORKFORCE_MEMBER_CONTRACT_VERSION = '1.2';

export const WORKFORCE_MEMBER_PERMISSIONS = Object.freeze({
  view: 'workforce:member:view',
  manage: 'workforce:member:manage',
  activate: 'workforce:member:activate',
  suspend: 'workforce:member:suspend',
});

export const WORKFORCE_MEMBER_TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['ACTIVE']),
  ACTIVE: Object.freeze(['SUSPENDED', 'INACTIVE']),
  SUSPENDED: Object.freeze(['ACTIVE', 'INACTIVE']),
  INACTIVE: Object.freeze([]),
});

export const WORKFORCE_MEMBER_OPTIONAL_FIELDS = Object.freeze(['employee_number','department_id','position_id','supervisor_member_id']);

export const WORKFORCE_MEMBER_CREATE_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_type',
  'idempotency_key',
]);

export const WORKFORCE_MEMBER_UPDATE_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'expected_version',
]);

export const WORKFORCE_MEMBER_LIFECYCLE_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'expected_version',
]);

export function workforceMemberContract() {
  return Object.freeze({
    contract_version: WORKFORCE_MEMBER_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_member',
    organization_scoped: true,
    reuses_existing_user_identity: true,
    supports_external_professionals: true,
    identity_link_is_optional: true,
    optional_fields: WORKFORCE_MEMBER_OPTIONAL_FIELDS,
    employee_number_unique_within_organization: true,
    supports_department_assignment: true,
    supports_position_assignment: true,
    supports_reporting_relationships: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    member_types: WORKFORCE_MEMBER_TYPES,
    member_statuses: WORKFORCE_MEMBER_STATUSES,
    permissions: WORKFORCE_MEMBER_PERMISSIONS,
    transitions: WORKFORCE_MEMBER_TRANSITIONS,
    create_required_fields: WORKFORCE_MEMBER_CREATE_REQUIRED_FIELDS,
    update_required_fields: WORKFORCE_MEMBER_UPDATE_REQUIRED_FIELDS,
    lifecycle_required_fields: WORKFORCE_MEMBER_LIFECYCLE_REQUIRED_FIELDS,
  });
}

export function canTransitionWorkforceMemberStatus(currentStatus, nextStatus) {
  if (!isValidWorkforceMemberStatus(currentStatus)) return false;
  if (!isValidWorkforceMemberStatus(nextStatus)) return false;
  return WORKFORCE_MEMBER_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function validateWorkforceMemberCreate(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_MEMBER_CREATE_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (input.member_type !== undefined && !isValidWorkforceMemberType(input.member_type)) {
    errors.push(`Invalid member_type: ${input.member_type}`);
  }
  if (input.employee_number !== undefined && input.employee_number !== null &&
    (typeof input.employee_number !== 'string' || input.employee_number.trim().length > 80)) {
    errors.push('employee_number must be a string of at most 80 characters');
  }
  for (const field of ['department_id','position_id','supervisor_member_id']) {
    if (input[field] !== undefined && input[field] !== null &&
      (typeof input[field] !== 'string' || !input[field].trim())) errors.push(field + ' must be a non-empty string or null');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function validateWorkforceMemberUpdate(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_MEMBER_UPDATE_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (input.member_type !== undefined && !isValidWorkforceMemberType(input.member_type)) {
    errors.push(`Invalid member_type: ${input.member_type}`);
  }
  if (input.employee_number !== undefined && input.employee_number !== null &&
    (typeof input.employee_number !== 'string' || input.employee_number.trim().length > 80)) {
    errors.push('employee_number must be a string of at most 80 characters');
  }
  for (const field of ['department_id','position_id','supervisor_member_id']) {
    if (input[field] !== undefined && input[field] !== null &&
      (typeof input[field] !== 'string' || !input[field].trim())) errors.push(field + ' must be a non-empty string or null');
  }

  if (
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function validateWorkforceMemberLifecycle(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_MEMBER_LIFECYCLE_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function workforceMemberLifecyclePermission(action) {
  if (action === 'activate') return WORKFORCE_MEMBER_PERMISSIONS.activate;
  if (action === 'suspend') return WORKFORCE_MEMBER_PERMISSIONS.suspend;
  return WORKFORCE_MEMBER_PERMISSIONS.manage;
}
