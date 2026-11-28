/**
 * Canonical Workforce availability contract.
 *
 * Workforce availability is potential capacity. It is not a booking,
 * reservation, confirmed commitment, or utilization record.
 */

export const WORKFORCE_AVAILABILITY_CONTRACT_VERSION = '1.0';

export const WORKFORCE_AVAILABILITY_PERMISSIONS = Object.freeze({
  view: 'workforce:availability:view',
  manage: 'workforce:availability:manage',
});

export const WORKFORCE_AVAILABILITY_STATES = Object.freeze([
  'AVAILABLE',
  'UNAVAILABLE',
  'TENTATIVE',
  'BLACKOUT',
]);

export const WORKFORCE_AVAILABILITY_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'availability',
  'starts_at',
  'ends_at',
  'timezone',
  'effective_from',
  'expected_version',
]);

export function workforceAvailabilityContract() {
  return Object.freeze({
    contract_version: WORKFORCE_AVAILABILITY_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_availability_window',
    organization_scoped: true,
    member_scoped: true,
    time_zone_aware: true,
    is_booking: false,
    is_reservation: false,
    is_confirmed_commitment: false,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_AVAILABILITY_PERMISSIONS,
    availability_states: WORKFORCE_AVAILABILITY_STATES,
    required_fields: WORKFORCE_AVAILABILITY_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceAvailabilityState(value) {
  return WORKFORCE_AVAILABILITY_STATES.includes(value);
}

export function validateWorkforceAvailability(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_AVAILABILITY_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.availability !== undefined &&
    !isValidWorkforceAvailabilityState(input.availability)
  ) {
    errors.push(`Invalid availability: ${input.availability}`);
  }

  if (
    input.timezone !== undefined &&
    (typeof input.timezone !== 'string' || input.timezone.trim() === '')
  ) {
    errors.push('timezone must be a non-empty string');
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

export function workforceAvailabilityPermission(action) {
  if (action === 'view') return WORKFORCE_AVAILABILITY_PERMISSIONS.view;
  return WORKFORCE_AVAILABILITY_PERMISSIONS.manage;
}
