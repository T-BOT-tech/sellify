import assert from 'node:assert/strict';
import {
  WORKFORCE_CONTRACT_VERSION,
  WORKFORCE_MEMBER_TYPES,
  WORKFORCE_MEMBER_STATUSES,
  WORKFORCE_ENGAGEMENT_TYPES,
  WORKFORCE_AVAILABILITY_STATES,
  WORKFORCE_SHIFT_STATUSES,
  WORKFORCE_CALENDAR_EXCEPTION_TYPES,
  workforceContract,
  isValidWorkforceMemberType,
  isValidWorkforceMemberStatus,
  isValidWorkforceEngagementType,
  isValidWorkforceAvailabilityState,
  isValidWorkforceShiftStatus,
  isValidWorkforceCalendarExceptionType,
} from '../backend/lib/workforce-contract.js';

const contract = workforceContract();

assert.equal(contract.contract_version, WORKFORCE_CONTRACT_VERSION);
assert.equal(contract.capability, 'workforce.membership');
assert.equal(contract.organization_scoped, true);
assert.equal(contract.reuses_existing_authorities, true);
assert.equal(contract.creates_duplicate_authorities, false);

assert.deepEqual(contract.member_types, WORKFORCE_MEMBER_TYPES);
assert.deepEqual(contract.member_statuses, WORKFORCE_MEMBER_STATUSES);
assert.deepEqual(contract.engagement_types, WORKFORCE_ENGAGEMENT_TYPES);
assert.deepEqual(contract.availability_states, WORKFORCE_AVAILABILITY_STATES);
assert.deepEqual(contract.shift_statuses, WORKFORCE_SHIFT_STATUSES);
assert.deepEqual(contract.calendar_exception_types, WORKFORCE_CALENDAR_EXCEPTION_TYPES);

assert.equal(isValidWorkforceMemberType('EMPLOYEE'), true);
assert.equal(isValidWorkforceMemberType('CONTRACTOR'), true);
assert.equal(isValidWorkforceMemberType('PROVIDER'), true);
assert.equal(isValidWorkforceMemberType('VOLUNTEER'), true);
assert.equal(isValidWorkforceMemberType('MANAGER'), false);

assert.equal(isValidWorkforceMemberStatus('DRAFT'), true);
assert.equal(isValidWorkforceMemberStatus('ACTIVE'), true);
assert.equal(isValidWorkforceMemberStatus('SUSPENDED'), true);
assert.equal(isValidWorkforceMemberStatus('INACTIVE'), true);
assert.equal(isValidWorkforceMemberStatus('ARCHIVED'), false);

assert.equal(isValidWorkforceEngagementType('EMPLOYMENT'), true);
assert.equal(isValidWorkforceEngagementType('CONTRACT'), true);
assert.equal(isValidWorkforceEngagementType('PROVIDER_RELATIONSHIP'), true);
assert.equal(isValidWorkforceEngagementType('VOLUNTEER'), true);
assert.equal(isValidWorkforceEngagementType('INTERNAL_ASSIGNMENT'), true);
assert.equal(isValidWorkforceEngagementType('FREELANCE'), false);

assert.equal(isValidWorkforceAvailabilityState('AVAILABLE'), true);
assert.equal(isValidWorkforceAvailabilityState('UNAVAILABLE'), true);
assert.equal(isValidWorkforceAvailabilityState('TENTATIVE'), true);
assert.equal(isValidWorkforceAvailabilityState('BLACKOUT'), true);
assert.equal(isValidWorkforceAvailabilityState('BOOKED'), false);

assert.equal(isValidWorkforceShiftStatus('PLANNED'), true);
assert.equal(isValidWorkforceShiftStatus('CONFIRMED'), true);
assert.equal(isValidWorkforceShiftStatus('IN_PROGRESS'), true);
assert.equal(isValidWorkforceShiftStatus('COMPLETED'), true);
assert.equal(isValidWorkforceShiftStatus('CANCELLED'), true);
assert.equal(isValidWorkforceShiftStatus('ARCHIVED'), false);

assert.equal(isValidWorkforceCalendarExceptionType('HOLIDAY'), true);
assert.equal(isValidWorkforceCalendarExceptionType('LEAVE'), true);
assert.equal(isValidWorkforceCalendarExceptionType('BLACKOUT'), true);
assert.equal(isValidWorkforceCalendarExceptionType('TEMPORARY_CHANGE'), true);
assert.equal(isValidWorkforceCalendarExceptionType('VACATION'), false);

console.log('Workforce contract regression: PASS');
