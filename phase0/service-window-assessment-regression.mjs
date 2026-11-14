import assert from 'node:assert/strict';
import {
  assessServiceResourceDeclaredWindow,
  serviceLocalDateTimeToIso,
} from '../app/src/verticals/services/service-window-assessment-contract.js';

const zone = 'Africa/Addis_Ababa';
const workingHours = [
  { weekday: 1, startTime: '09:00', endTime: '17:00' },
  { weekday: 2, startTime: '09:00', endTime: '17:00' },
];
const within = assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours, exceptions: [],
  start: '2026-11-16T06:00:00.000Z', end: '2026-11-16T07:00:00.000Z',
});
assert.equal(within.scheduleAssessment, 'WITHIN_DECLARED_HOURS');
assert.equal(within.capacityEvaluation, 'UNKNOWN');
assert.equal(within.availabilityConfirmed, false);
assert.equal(within.authorized, false);
assert.equal(within.execution, false);
assert.equal(within.persistence, 'none');

const outside = assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours, exceptions: [],
  start: '2026-11-16T03:00:00.000Z', end: '2026-11-16T04:00:00.000Z',
});
assert.equal(outside.scheduleAssessment, 'OUTSIDE_DECLARED_HOURS');

const closed = assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours, exceptions: [{ date: '2026-11-16', kind: 'CLOSED' }],
  start: '2026-11-16T06:00:00.000Z', end: '2026-11-16T07:00:00.000Z',
});
assert.equal(closed.reason, 'DATE_EXCEPTION_CLOSED');

const opened = assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours: [],
  exceptions: [{ date: '2026-11-15', kind: 'OPEN', startTime: '10:00', endTime: '12:00' }],
  start: '2026-11-15T07:30:00.000Z', end: '2026-11-15T08:30:00.000Z',
});
assert.equal(opened.scheduleAssessment, 'WITHIN_DECLARED_HOURS');

const noSchedule = assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours: [], exceptions: [],
  start: '2026-11-16T06:00:00.000Z', end: '2026-11-16T07:00:00.000Z',
});
assert.equal(noSchedule.scheduleAssessment, 'UNKNOWN');
assert.equal(noSchedule.reason, 'NO_DECLARED_SCHEDULE');

const crossDay = assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours, exceptions: [],
  start: '2026-11-16T20:00:00.000Z', end: '2026-11-16T22:00:00.000Z',
});
assert.equal(crossDay.reason, 'CROSS_LOCAL_DATE_WINDOW');

assert.throws(() => assessServiceResourceDeclaredWindow({
  timeZone: zone, workingHours, exceptions: [],
  start: '2026-11-16T07:00:00Z', end: '2026-11-16T06:00:00Z',
}), { code: 'SERVICE_WINDOW_INVALID' });

assert.equal(serviceLocalDateTimeToIso('2026-11-16T09:00', zone), '2026-11-16T06:00:00.000Z');
assert.throws(() => serviceLocalDateTimeToIso('2026-03-29T02:30', 'Europe/Paris'),
  { code: 'SERVICE_WINDOW_LOCAL_TIME_AMBIGUOUS' });

console.log('SC-03.3 Service Resource Declared Window Assessment Regression: PASS');
