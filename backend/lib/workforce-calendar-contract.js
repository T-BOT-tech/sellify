/**
 * Canonical Workforce calendar contract.
 *
 * A workforce calendar defines organization-scoped, time-zone-aware working
 * time for an existing workforce member. It does not create a second user,
 * organization, tenant, booking, supplier-network, logistics, inventory,
 * payment, fulfillment, or catalog authority.
 */

export const WORKFORCE_CALENDAR_CONTRACT_VERSION = '1.0';

export const WORKFORCE_CALENDAR_PERMISSIONS = Object.freeze({
  view: 'workforce:calendar:view',
  manage: 'workforce:calendar:manage',
});

export const WORKFORCE_CALENDAR_EXCEPTION_TYPES = Object.freeze([
  'HOLIDAY',
  'LEAVE',
  'BLACKOUT',
  'TEMPORARY_CHANGE',
]);

export const WORKFORCE_CALENDAR_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'member_id',
  'timezone',
  'effective_from',
  'expected_version',
]);

export const WORKFORCE_CALENDAR_EXCEPTION_REQUIRED_FIELDS = Object.freeze([
  'organization_id',
  'chat_id',
  'calendar_id',
  'exception_type',
  'starts_at',
  'ends_at',
  'expected_version',
]);

export function workforceCalendarContract() {
  return Object.freeze({
    contract_version: WORKFORCE_CALENDAR_CONTRACT_VERSION,
    capability: 'workforce.membership',
    entity: 'workforce_calendar',
    organization_scoped: true,
    member_scoped: true,
    time_zone_aware: true,
    reuses_existing_user_identity: true,
    reuses_existing_organization_authority: true,
    creates_duplicate_user_identity: false,
    permissions: WORKFORCE_CALENDAR_PERMISSIONS,
    exception_types: WORKFORCE_CALENDAR_EXCEPTION_TYPES,
    required_fields: WORKFORCE_CALENDAR_REQUIRED_FIELDS,
    exception_required_fields: WORKFORCE_CALENDAR_EXCEPTION_REQUIRED_FIELDS,
  });
}

export function isValidWorkforceCalendarExceptionType(value) {
  return WORKFORCE_CALENDAR_EXCEPTION_TYPES.includes(value);
}

export function validateWorkforceCalendar(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_CALENDAR_REQUIRED_FIELDS) {
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
    input.expected_version !== undefined &&
    (!Number.isInteger(input.expected_version) || input.expected_version < 1)
  ) {
    errors.push('expected_version must be a positive integer');
  }

  return Object.freeze({ valid: errors.length === 0, errors });
}

export function validateWorkforceCalendarException(input = {}) {
  const errors = [];

  for (const field of WORKFORCE_CALENDAR_EXCEPTION_REQUIRED_FIELDS) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (
    input.exception_type !== undefined &&
    !isValidWorkforceCalendarExceptionType(input.exception_type)
  ) {
    errors.push(`Invalid exception_type: ${input.exception_type}`);
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

export function workforceCalendarPermission(action) {
  if (action === 'view') return WORKFORCE_CALENDAR_PERMISSIONS.view;
  return WORKFORCE_CALENDAR_PERMISSIONS.manage;
}
