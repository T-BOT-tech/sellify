/**
 * Canonical Workforce shift contract.
 *
 * A workforce shift is scheduled work. It is not a booking, reservation,
 * confirmed commitment, or utilization record.
 */

export const WORKFORCE_SHIFT_CONTRACT_VERSION = '1.0';

export const WORKFORCE_SHIFT_PERMISSIONS = Object.freeze({
  view: 'workforce:shift:view',
  manage: 'workforce:shift:manage',
  confirm: 'workforce:shift:confirm',
  cancel: 'workforce:shift:cancel',
});

export const WORKFORCE_SHIFT_STATUSES = Object.freeze([
  'PLANNED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const WORKFORCE_SHIFT_TRANSITIONS = Object.freeze({
  PLANNED: Object.freeze(['CONFIRMED', 'CANCELLED']),
  CONFIRMED: Object.freeze(['IN_PROGRESS', 'CANCELLED']),
  IN_PROGRESS: Object.freeze(['COMPLETED', 'CANCELLED']),
  COMPLETED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
});

export const WORKFORCE_SHIFT_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'starts_at',
  'ends_at',
  'timezone',
  'expected_version',
]);

export function workforceShiftContract() {
  return Object.freeze({
    contract_version: WORKFORCE_SHIFT_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_shift',
    organization_scoped: true,
    member_scoped: true,
    resource_scoped: true,
    location_scoped: true,
    time_zone_aware: true,
    is_booking: false,
    is_reservation: false,
    is_confirmed_commitment: false,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_SHIFT_PERMISSIONS,
    statuses: WORKFORCE_SHIFT_STATUSES,
    transitions: WORKFORCE_SHIFT_TRANSITIONS,
    required_fields: WORKFORCE_SHIFT_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceShiftStatus(value) {
  return WORKFORCE_SHIFT_STATUSES.includes(value);
}

export function canTransitionWorkforceShiftStatus(currentStatus, nextStatus) {
  if (!isValidWorkforceShiftStatus(currentStatus)) return false;
  if (!isValidWorkforceShiftStatus(nextStatus)) return false;
  return WORKFORCE_SHIFT_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function validateWorkforceShift(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_SHIFT_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
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

export function workforceShiftPermission(action) {
  if (action === 'view') return WORKFORCE_SHIFT_PERMISSIONS.view;
  if (action === 'confirm') return WORKFORCE_SHIFT_PERMISSIONS.confirm;
  if (action === 'cancel') return WORKFORCE_SHIFT_PERMISSIONS.cancel;
  return WORKFORCE_SHIFT_PERMISSIONS.manage;
}
