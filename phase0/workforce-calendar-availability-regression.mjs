import assert from 'node:assert/strict';
import {
  WORKFORCE_CALENDAR_CONTRACT_VERSION,
  WORKFORCE_CALENDAR_PERMISSIONS,
  WORKFORCE_CALENDAR_EXCEPTION_TYPES,
  workforceCalendarContract,
  isValidWorkforceCalendarExceptionType,
  validateWorkforceCalendar,
  validateWorkforceCalendarException,
  workforceCalendarPermission,
} from '../backend/lib/workforce-calendar-contract.js';
import {
  WORKFORCE_AVAILABILITY_CONTRACT_VERSION,
  WORKFORCE_AVAILABILITY_PERMISSIONS,
  WORKFORCE_AVAILABILITY_STATES,
  workforceAvailabilityContract,
  isValidWorkforceAvailabilityState,
  validateWorkforceAvailability,
  workforceAvailabilityPermission,
} from '../backend/lib/workforce-availability-contract.js';

const calendarContract = workforceCalendarContract();

assert.equal(calendarContract.contract_version, WORKFORCE_CALENDAR_CONTRACT_VERSION);
assert.equal(calendarContract.capability, 'workforce.membership');
assert.equal(calendarContract.entity, 'workforce_calendar');
assert.equal(calendarContract.organization_scoped, true);
assert.equal(calendarContract.member_scoped, true);
assert.equal(calendarContract.time_zone_aware, true);
assert.equal(calendarContract.reuses_existing_user_identity, true);
assert.equal(calendarContract.reuses_existing_organization_authority, true);
assert.equal(calendarContract.creates_duplicate_user_identity, false);
assert.deepEqual(calendarContract.exception_types, WORKFORCE_CALENDAR_EXCEPTION_TYPES);
assert.deepEqual(calendarContract.permissions, WORKFORCE_CALENDAR_PERMISSIONS);

assert.equal(isValidWorkforceCalendarExceptionType('HOLIDAY'), true);
assert.equal(isValidWorkforceCalendarExceptionType('LEAVE'), true);
assert.equal(isValidWorkforceCalendarExceptionType('BLACKOUT'), true);
assert.equal(isValidWorkforceCalendarExceptionType('TEMPORARY_CHANGE'), true);
assert.equal(isValidWorkforceCalendarExceptionType('VACATION'), false);

const validCalendar = validateWorkforceCalendar({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  timezone: 'Africa/Nairobi',
  effective_from: '2026-01-01T00:00:00.000Z',
  expected_version: 1,
});
assert.equal(validCalendar.valid, true);
assert.deepEqual(validCalendar.errors, []);

const invalidCalendar = validateWorkforceCalendar({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  timezone: '',
  effective_from: '2026-01-01T00:00:00.000Z',
  expected_version: 0,
});
assert.equal(invalidCalendar.valid, false);
assert.ok(invalidCalendar.errors.includes('timezone must be a non-empty string'));
assert.ok(invalidCalendar.errors.includes('expected_version must be a positive integer'));

const validException = validateWorkforceCalendarException({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  calendar_id: 'calendar-1',
  exception_type: 'LEAVE',
  starts_at: '2026-01-01T09:00:00.000Z',
  ends_at: '2026-01-01T17:00:00.000Z',
  expected_version: 1,
});
assert.equal(validException.valid, true);
assert.deepEqual(validException.errors, []);

const invalidException = validateWorkforceCalendarException({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  calendar_id: 'calendar-1',
  exception_type: 'VACATION',
  starts_at: '2026-01-01T17:00:00.000Z',
  ends_at: '2026-01-01T09:00:00.000Z',
  expected_version: 0,
});
assert.equal(invalidException.valid, false);
assert.ok(invalidException.errors.includes('Invalid exception_type: VACATION'));
assert.ok(invalidException.errors.includes('starts_at must be before ends_at'));
assert.ok(invalidException.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceCalendarPermission('view'), 'workforce:calendar:view');
assert.equal(workforceCalendarPermission('update'), 'workforce:calendar:manage');

const availabilityContract = workforceAvailabilityContract();

assert.equal(availabilityContract.contract_version, WORKFORCE_AVAILABILITY_CONTRACT_VERSION);
assert.equal(availabilityContract.capability, 'workforce.membership');
assert.equal(availabilityContract.entity, 'workforce_availability_window');
assert.equal(availabilityContract.organization_scoped, true);
assert.equal(availabilityContract.member_scoped, true);
assert.equal(availabilityContract.time_zone_aware, true);
assert.equal(availabilityContract.is_booking, false);
assert.equal(availabilityContract.is_reservation, false);
assert.equal(availabilityContract.is_confirmed_commitment, false);
assert.equal(availabilityContract.reuses_existing_user_identity, true);
assert.equal(availabilityContract.reuses_existing_organization_authority, true);
assert.equal(availabilityContract.creates_duplicate_user_identity, false);
assert.deepEqual(availabilityContract.availability_states, WORKFORCE_AVAILABILITY_STATES);
assert.deepEqual(availabilityContract.permissions, WORKFORCE_AVAILABILITY_PERMISSIONS);

assert.equal(isValidWorkforceAvailabilityState('AVAILABLE'), true);
assert.equal(isValidWorkforceAvailabilityState('UNAVAILABLE'), true);
assert.equal(isValidWorkforceAvailabilityState('TENTATIVE'), true);
assert.equal(isValidWorkforceAvailabilityState('BLACKOUT'), true);
assert.equal(isValidWorkforceAvailabilityState('BOOKED'), false);

const validAvailability = validateWorkforceAvailability({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  availability: 'AVAILABLE',
  starts_at: '2026-01-01T09:00:00.000Z',
  ends_at: '2026-01-01T17:00:00.000Z',
  timezone: 'Africa/Nairobi',
  effective_from: '2026-01-01T00:00:00.000Z',
  expected_version: 1,
});
assert.equal(validAvailability.valid, true);
assert.deepEqual(validAvailability.errors, []);

const invalidAvailability = validateWorkforceAvailability({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  availability: 'BOOKED',
  starts_at: '2026-01-01T17:00:00.000Z',
  ends_at: '2026-01-01T09:00:00.000Z',
  timezone: '',
  effective_from: '2026-01-01T00:00:00.000Z',
  expected_version: 0,
});
assert.equal(invalidAvailability.valid, false);
assert.ok(invalidAvailability.errors.includes('Invalid availability: BOOKED'));
assert.ok(invalidAvailability.errors.includes('starts_at must be before ends_at'));
assert.ok(invalidAvailability.errors.includes('timezone must be a non-empty string'));
assert.ok(invalidAvailability.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceAvailabilityPermission('view'), 'workforce:availability:view');
assert.equal(workforceAvailabilityPermission('update'), 'workforce:availability:manage');

console.log('Workforce calendar and availability contract regression: PASS');
