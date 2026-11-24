/**
 * Canonical Workforce capability contract.
 *
 * Workforce provides organization-scoped membership, engagement, calendar,
 * availability, assignment, allocation, and utilization vocabulary.
 *
 * This contract intentionally does not create a second user, organization,
 * tenant, booking, supplier-network, logistics, inventory, payment,
 * fulfillment, or catalog authority.
 */

export const WORKFORCE_CONTRACT_VERSION = '1.0';

export const WORKFORCE_MEMBER_TYPES = Object.freeze([
  'EMPLOYEE',
  'CONTRACTOR',
  'PROVIDER',
  'VOLUNTEER',
]);

export const WORKFORCE_MEMBER_STATUSES = Object.freeze([
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'INACTIVE',
]);

export const WORKFORCE_ENGAGEMENT_TYPES = Object.freeze([
  'EMPLOYMENT',
  'CONTRACT',
  'PROVIDER_RELATIONSHIP',
  'VOLUNTEER',
  'INTERNAL_ASSIGNMENT',
]);

export const WORKFORCE_AVAILABILITY_STATES = Object.freeze([
  'AVAILABLE',
  'UNAVAILABLE',
  'TENTATIVE',
  'BLACKOUT',
]);

export const WORKFORCE_SHIFT_STATUSES = Object.freeze([
  'PLANNED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const WORKFORCE_CALENDAR_EXCEPTION_TYPES = Object.freeze([
  'HOLIDAY',
  'LEAVE',
  'BLACKOUT',
  'TEMPORARY_CHANGE',
]);

export function workforceContract() {
  return Object.freeze({
    contract_version: WORKFORCE_CONTRACT_VERSION,
    capability: 'workforce.membership',
    organization_scoped: true,
    reuses_existing_authorities: true,
    creates_duplicate_authorities: false,
    member_types: WORKFORCE_MEMBER_TYPES,
    member_statuses: WORKFORCE_MEMBER_STATUSES,
    engagement_types: WORKFORCE_ENGAGEMENT_TYPES,
    availability_states: WORKFORCE_AVAILABILITY_STATES,
    shift_statuses: WORKFORCE_SHIFT_STATUSES,
    calendar_exception_types: WORKFORCE_CALENDAR_EXCEPTION_TYPES,
  });
}

export function isValidWorkforceMemberType(value) {
  return WORKFORCE_MEMBER_TYPES.includes(value);
}

export function isValidWorkforceMemberStatus(value) {
  return WORKFORCE_MEMBER_STATUSES.includes(value);
}

export function isValidWorkforceEngagementType(value) {
  return WORKFORCE_ENGAGEMENT_TYPES.includes(value);
}

export function isValidWorkforceAvailabilityState(value) {
  return WORKFORCE_AVAILABILITY_STATES.includes(value);
}

export function isValidWorkforceShiftStatus(value) {
  return WORKFORCE_SHIFT_STATUSES.includes(value);
}

export function isValidWorkforceCalendarExceptionType(value) {
  return WORKFORCE_CALENDAR_EXCEPTION_TYPES.includes(value);
}
