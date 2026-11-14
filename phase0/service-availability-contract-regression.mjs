import assert from 'node:assert/strict';
import {
  isIanaTimeZone,
  normalizeWorkingHours,
  normalizeAvailabilityExceptions,
  projectServiceAvailabilityState,
  assessServiceResourceCommitWindow,
} from '../backend/lib/service-availability-contract.js';

assert.equal(isIanaTimeZone('Africa/Addis_Ababa'), true);
assert.equal(isIanaTimeZone('Not/A_Real_Zone'), false);
const hours = normalizeWorkingHours([
  { weekday: 1, start_time: '09:00', end_time: '12:00' },
  { weekday: 1, start_time: '13:00', end_time: '17:00' },
  { weekday: 0, start_time: '10:00', end_time: '14:00' },
], 'Africa/Addis_Ababa');
assert.equal(hours.timeZone, 'Africa/Addis_Ababa');
assert.equal(hours.entries.length, 3);
assert.equal(normalizeWorkingHours([{ weekday: 1, startTime: '09:00', endTime: '12:00' }], 'UTC').entries.length, 1);
assert.throws(() => normalizeWorkingHours([
  { weekday: 1, startTime: '09:00', endTime: '12:00' },
  { weekday: 1, startTime: '11:30', endTime: '13:00' },
], 'UTC'), { code: 'SERVICE_WORKING_HOURS_OVERLAP' });
assert.throws(() => normalizeWorkingHours([{ weekday: 7, startTime: '09:00', endTime: '10:00' }], 'UTC'), { code: 'SERVICE_WORKING_HOURS_WEEKDAY_INVALID' });
assert.throws(() => normalizeWorkingHours([{ weekday: 1, startTime: '22:00', endTime: '02:00' }], 'UTC'), { code: 'SERVICE_WORKING_HOURS_INTERVAL_INVALID' });
const exceptions = normalizeAvailabilityExceptions([
  { date: '2026-12-25', kind: 'CLOSED', note: 'Holiday' },
  { date: '2026-12-26', kind: 'OPEN', startTime: '10:00', endTime: '13:00' },
]);
assert.equal(exceptions[0].kind, 'CLOSED');
assert.equal(exceptions[1].kind, 'OPEN');
assert.throws(() => normalizeAvailabilityExceptions([{ date: '2026-02-30', kind: 'CLOSED' }]), { code: 'SERVICE_AVAILABILITY_EXCEPTION_DATE_INVALID' });
assert.throws(() => normalizeAvailabilityExceptions([
  { date: '2026-12-25', kind: 'CLOSED' }, { date: '2026-12-25', kind: 'OPEN', startTime: '10:00', endTime: '12:00' },
]), { code: 'SERVICE_AVAILABILITY_EXCEPTION_DUPLICATE' });
const inHours = assessServiceResourceCommitWindow({
  timeZone: 'Africa/Addis_Ababa',
  workingHours: [{ weekday: 0, startTime: '08:00', endTime: '18:00' }],
  exceptions: [],
  start: '2026-11-01T06:00:00.000Z',
  end: '2026-11-01T07:00:00.000Z',
});
assert.equal(inHours.state, 'WITHIN_DECLARED_HOURS');
assert.equal(inHours.confirmsAvailability, false, 'working-hours assessment alone must never claim confirmed availability');
const outsideHours = assessServiceResourceCommitWindow({
  timeZone: 'Africa/Addis_Ababa',
  workingHours: [{ weekday: 0, startTime: '08:00', endTime: '18:00' }],
  exceptions: [{ date: '2026-11-01', kind: 'CLOSED' }],
  start: '2026-11-01T06:00:00.000Z',
  end: '2026-11-01T07:00:00.000Z',
});
assert.equal(outsideHours.state, 'OUTSIDE_DECLARED_HOURS');
const unknownWindow = assessServiceResourceCommitWindow({
  timeZone: 'Africa/Addis_Ababa', workingHours: [], exceptions: [],
  start: '2026-11-01T06:00:00.000Z', end: '2026-11-01T07:00:00.000Z',
});
assert.equal(unknownWindow.state, 'OUTSIDE_DECLARED_HOURS');
const crossDate = assessServiceResourceCommitWindow({
  timeZone: 'Africa/Addis_Ababa',
  workingHours: [{ weekday: 0, startTime: '08:00', endTime: '23:59' }],
  exceptions: [],
  start: '2026-11-01T20:30:00.000Z',
  end: '2026-11-01T22:00:00.000Z',
});
assert.equal(crossDate.state, 'UNKNOWN');
const state = projectServiceAvailabilityState({ scheduleConfigured: true });
assert.equal(state.state, 'UNKNOWN');
assert.equal(state.confirmsAvailability, false);
assert.equal(state.authorizesBooking, false);
assert.equal(state.commitsResource, false);
console.log('SC-03.2 Service Availability Contract Regression: PASS');
