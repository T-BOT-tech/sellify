import assert from 'node:assert/strict';
import {
  WORKFORCE_ASSIGNMENT_CONTRACT_VERSION,
  WORKFORCE_ASSIGNMENT_PERMISSIONS,
  WORKFORCE_ASSIGNMENT_TRANSITIONS,
  workforceAssignmentContract,
  canTransitionWorkforceAssignmentStatus,
  validateWorkforceAssignment,
  workforceAssignmentPermission,
} from '../backend/lib/workforce-assignment-contract.js';
import {
  WORKFORCE_SHIFT_CONTRACT_VERSION,
  WORKFORCE_SHIFT_PERMISSIONS,
  WORKFORCE_SHIFT_TRANSITIONS,
  workforceShiftContract,
  canTransitionWorkforceShiftStatus,
  validateWorkforceShift,
  workforceShiftPermission,
} from '../backend/lib/workforce-shift-contract.js';
import { localDateTimeToUtc, buildShiftWindowFromTemplate, isoWeekday } from '../backend/lib/workforce-shift-time.js';

const assignmentContract = workforceAssignmentContract();

assert.equal(assignmentContract.contract_version, WORKFORCE_ASSIGNMENT_CONTRACT_VERSION);
assert.equal(assignmentContract.capability, 'workforce.membership');
assert.equal(assignmentContract.entity, 'workforce_assignment');
assert.equal(assignmentContract.organization_scoped, true);
assert.equal(assignmentContract.member_scoped, true);
assert.equal(assignmentContract.resource_scoped, true);
assert.equal(assignmentContract.location_scoped, true);
assert.equal(assignmentContract.reuses_existing_user_identity, true);
assert.equal(assignmentContract.reuses_existing_organization_authority, true);
assert.equal(assignmentContract.creates_duplicate_user_identity, false);
assert.deepEqual(assignmentContract.transitions, WORKFORCE_ASSIGNMENT_TRANSITIONS);
assert.deepEqual(assignmentContract.permissions, WORKFORCE_ASSIGNMENT_PERMISSIONS);

assert.equal(canTransitionWorkforceAssignmentStatus('DRAFT', 'ACTIVE'), true);
assert.equal(canTransitionWorkforceAssignmentStatus('DRAFT', 'ENDED'), true);
assert.equal(canTransitionWorkforceAssignmentStatus('ACTIVE', 'SUSPENDED'), true);
assert.equal(canTransitionWorkforceAssignmentStatus('ACTIVE', 'ENDED'), true);
assert.equal(canTransitionWorkforceAssignmentStatus('SUSPENDED', 'ACTIVE'), true);
assert.equal(canTransitionWorkforceAssignmentStatus('SUSPENDED', 'ENDED'), true);
assert.equal(canTransitionWorkforceAssignmentStatus('ENDED', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceAssignmentStatus('DRAFT', 'SUSPENDED'), false);
assert.equal(canTransitionWorkforceAssignmentStatus('UNKNOWN', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceAssignmentStatus('ACTIVE', 'UNKNOWN'), false);

const validAssignment = validateWorkforceAssignment({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  assignment_type: 'RESOURCE',
  starts_at: '2026-01-01T09:00:00.000Z',
  ends_at: '2026-01-01T17:00:00.000Z',
  expected_version: 1,
});
assert.equal(validAssignment.valid, true);
assert.deepEqual(validAssignment.errors, []);

const invalidAssignment = validateWorkforceAssignment({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  assignment_type: 'TEAM',
  starts_at: '2026-01-01T17:00:00.000Z',
  ends_at: '2026-01-01T09:00:00.000Z',
  expected_version: 0,
});
assert.equal(invalidAssignment.valid, false);
assert.ok(invalidAssignment.errors.includes('Invalid assignment_type: TEAM'));
assert.ok(invalidAssignment.errors.includes('starts_at must be before ends_at'));
assert.ok(invalidAssignment.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceAssignmentPermission('view'), 'workforce:assignment:view');
assert.equal(workforceAssignmentPermission('update'), 'workforce:assignment:manage');

const shiftContract = workforceShiftContract();

assert.equal(shiftContract.contract_version, WORKFORCE_SHIFT_CONTRACT_VERSION);
assert.equal(shiftContract.capability, 'workforce.membership');
assert.equal(shiftContract.entity, 'workforce_shift');
assert.equal(shiftContract.organization_scoped, true);
assert.equal(shiftContract.member_scoped, true);
assert.equal(shiftContract.resource_scoped, true);
assert.equal(shiftContract.location_scoped, true);
assert.equal(shiftContract.time_zone_aware, true);
assert.equal(shiftContract.is_booking, false);
assert.equal(shiftContract.is_reservation, false);
assert.equal(shiftContract.is_confirmed_commitment, false);
assert.equal(shiftContract.reuses_existing_user_identity, true);
assert.equal(shiftContract.reuses_existing_organization_authority, true);
assert.equal(shiftContract.creates_duplicate_user_identity, false);
assert.deepEqual(shiftContract.transitions, WORKFORCE_SHIFT_TRANSITIONS);
assert.deepEqual(shiftContract.permissions, WORKFORCE_SHIFT_PERMISSIONS);

assert.equal(canTransitionWorkforceShiftStatus('PLANNED', 'CONFIRMED'), true);
assert.equal(canTransitionWorkforceShiftStatus('PLANNED', 'CANCELLED'), true);
assert.equal(canTransitionWorkforceShiftStatus('CONFIRMED', 'IN_PROGRESS'), true);
assert.equal(canTransitionWorkforceShiftStatus('CONFIRMED', 'CANCELLED'), true);
assert.equal(canTransitionWorkforceShiftStatus('IN_PROGRESS', 'COMPLETED'), true);
assert.equal(canTransitionWorkforceShiftStatus('IN_PROGRESS', 'CANCELLED'), true);
assert.equal(canTransitionWorkforceShiftStatus('COMPLETED', 'CANCELLED'), false);
assert.equal(canTransitionWorkforceShiftStatus('CANCELLED', 'CONFIRMED'), false);
assert.equal(canTransitionWorkforceShiftStatus('PLANNED', 'IN_PROGRESS'), false);
assert.equal(canTransitionWorkforceShiftStatus('UNKNOWN', 'CONFIRMED'), false);
assert.equal(canTransitionWorkforceShiftStatus('CONFIRMED', 'UNKNOWN'), false);

const validShift = validateWorkforceShift({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  starts_at: '2026-01-01T09:00:00.000Z',
  ends_at: '2026-01-01T17:00:00.000Z',
  timezone: 'Africa/Nairobi',
  expected_version: 1,
});
assert.equal(validShift.valid, true);
assert.deepEqual(validShift.errors, []);

const invalidShift = validateWorkforceShift({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  starts_at: '2026-01-01T17:00:00.000Z',
  ends_at: '2026-01-01T09:00:00.000Z',
  timezone: '',
  expected_version: 0,
});
assert.equal(invalidShift.valid, false);
assert.ok(invalidShift.errors.includes('starts_at must be before ends_at'));
assert.ok(invalidShift.errors.includes('timezone must be a non-empty string'));
assert.ok(invalidShift.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceShiftPermission('view'), 'workforce:shift:view');
assert.equal(workforceShiftPermission('confirm'), 'workforce:shift:confirm');
assert.equal(workforceShiftPermission('cancel'), 'workforce:shift:cancel');
assert.equal(workforceShiftPermission('update'), 'workforce:shift:manage');

const addisWindow = buildShiftWindowFromTemplate({
  start_local_time: '08:00', end_local_time: '16:30', timezone: 'Africa/Addis_Ababa',
  break_rules: [{ start_local_time: '12:00', end_local_time: '12:30' }],
}, '2026-11-26');
assert.equal(addisWindow.starts_at, '2026-11-26T05:00:00.000Z');
assert.equal(addisWindow.ends_at, '2026-11-26T13:30:00.000Z');
assert.deepEqual(addisWindow.break_rules, [{ starts_at: '2026-11-26T09:00:00.000Z', duration_minutes: 30 }]);
assert.equal(isoWeekday('2026-11-26'), 4);

const overnightWindow = buildShiftWindowFromTemplate({
  start_local_time: '22:00', end_local_time: '06:00', timezone: 'Africa/Addis_Ababa',
  break_rules: [{ start_local_time: '01:00', end_local_time: '01:30' }],
}, '2026-11-26');
assert.equal(overnightWindow.starts_at, '2026-11-26T19:00:00.000Z');
assert.equal(overnightWindow.ends_at, '2026-11-27T03:00:00.000Z');
assert.deepEqual(overnightWindow.break_rules, [{ starts_at: '2026-11-26T22:00:00.000Z', duration_minutes: 30 }]);

assert.equal(localDateTimeToUtc('2026-11-01', '03:30', 'America/New_York'), '2026-11-01T08:30:00.000Z');
assert.throws(() => localDateTimeToUtc('2026-03-08', '02:30', 'America/New_York'),
  error => error.code === 'WORKFORCE_SHIFT_LOCAL_TIME_NONEXISTENT');
assert.throws(() => localDateTimeToUtc('2026-11-01', '01:30', 'America/New_York'),
  error => error.code === 'WORKFORCE_SHIFT_LOCAL_TIME_AMBIGUOUS');



console.log('Workforce assignment and shift contract regression: PASS');
