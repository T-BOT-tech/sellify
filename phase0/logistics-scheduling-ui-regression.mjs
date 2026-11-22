// Import the pure timezone contract, not the browser-dependent workspace module.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  localDateTimeToIso,
  normalizeCandidateWindow,
} from '../app/src/verticals/logistics/scheduling-timezone-contract.js';

assert.equal(
  localDateTimeToIso('2026-11-16T09:00', 'Africa/Addis_Ababa'),
  '2026-11-16T06:00:00.000Z',
  'local operator input is converted using the canonical Addis Ababa timezone',
);
assert.equal(
  localDateTimeToIso('2026-11-16T09:00', 'Asia/Kathmandu'),
  '2026-11-16T03:15:00.000Z',
  'quarter-hour timezone offsets are handled without using the browser timezone',
);
assert.equal(
  localDateTimeToIso('2026-11-16T09:00', 'Europe/Paris'),
  '2026-11-16T08:00:00.000Z',
);

assert.throws(
  () => localDateTimeToIso('2026-03-29T02:30', 'Europe/Paris'),
  error => error?.code === 'SCHEDULING_LOCAL_TIME_NONEXISTENT',
  'DST spring-forward gaps must be rejected',
);
assert.throws(
  () => localDateTimeToIso('2026-10-25T02:30', 'Europe/Paris'),
  error => error?.code === 'SCHEDULING_LOCAL_TIME_AMBIGUOUS',
  'DST fall-back duplicate wall times must be rejected',
);
assert.throws(
  () => localDateTimeToIso('2026-11-16T09:00', 'Not/A_Timezone'),
  error => error?.code === 'SCHEDULING_TIMEZONE_INVALID',
);
assert.throws(
  () => localDateTimeToIso('2026-02-30T09:00', 'Africa/Addis_Ababa'),
  error => error?.code === 'SCHEDULING_LOCAL_TIME_INVALID',
);

const window = normalizeCandidateWindow(
  '2026-11-16T09:00',
  '2026-11-16T10:00',
  'Africa/Addis_Ababa',
);
assert.deepEqual(window, {
  scheduledStart: '2026-11-16T06:00:00.000Z',
  scheduledEnd: '2026-11-16T07:00:00.000Z',
  timezone: 'Africa/Addis_Ababa',
});
assert.equal(normalizeCandidateWindow('2026-11-16T10:00', '2026-11-16T09:00', 'Africa/Addis_Ababa'), null);
assert.equal(normalizeCandidateWindow('2026-11-16T09:00', '2026-11-16T10:00', null), null);

const source = await readFile(new URL('../app/src/logistics/scheduling.js', import.meta.url), 'utf8');
assert.match(source, /workspaceTimezone = typeof data\.timezone/);
assert.match(source, /activity\.timezone \|\| workspaceTimezone/);
assert.match(source, /timeZone, dateStyle: 'medium', timeStyle: 'short'/);
assert.doesNotMatch(source, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
assert.match(source, /logisticsSchedulingTimeZoneMissing/);
assert.match(source, /const feasibilityBlocked = \['SCHEDULED', 'CONFIRMED'\]\.includes\(target\) && activity\.lastEvaluation !== 'FEASIBLE'/,
  'Schedule and Confirm controls must remain blocked unless trusted feasibility is FEASIBLE');
assert.match(source, /disabled aria-disabled/);
assert.match(source, /logisticsSchedulingScheduleBlocked/);
assert.match(source, /SCHEDULING_FEASIBILITY_UNKNOWN/);
assert.match(source, /SCHEDULING_FEASIBILITY_CONFLICT/);

const timezoneContract = await readFile(new URL('../app/src/verticals/logistics/scheduling-timezone-contract.js', import.meta.url), 'utf8');
assert.match(timezoneContract, /SCHEDULING_LOCAL_TIME_AMBIGUOUS/);

console.log('L11 Logistics Scheduling UI and IANA Timezone Regression: PASS');
