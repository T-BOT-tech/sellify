import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { logisticsLocalDateTimeToIso } from '../app/src/verticals/logistics/scheduling-timezone-contract.js';

assert.equal(
  logisticsLocalDateTimeToIso('2026-11-16T09:00', 'Africa/Addis_Ababa'),
  '2026-11-16T06:00:00.000Z',
  'local scheduling input must convert using the canonical resource timezone',
);
assert.equal(
  logisticsLocalDateTimeToIso('2026-11-16T09:00', 'Asia/Kathmandu'),
  '2026-11-16T03:15:00.000Z',
  'quarter-hour timezone offsets are supported',
);
assert.throws(
  () => logisticsLocalDateTimeToIso('2026-03-29T02:30', 'Europe/Paris'),
  error => error?.code === 'SCHEDULING_LOCAL_TIME_NONEXISTENT',
);
assert.throws(
  () => logisticsLocalDateTimeToIso('2026-10-25T02:30', 'Europe/Paris'),
  error => error?.code === 'SCHEDULING_LOCAL_TIME_AMBIGUOUS',
);
assert.throws(
  () => logisticsLocalDateTimeToIso('2026-11-16T09:00', 'Not/A_Timezone'),
  error => error?.code === 'SCHEDULING_TIMEZONE_INVALID',
);
assert.throws(
  () => logisticsLocalDateTimeToIso('2026-02-31T09:00', 'Africa/Addis_Ababa'),
  error => error?.code === 'SCHEDULING_LOCAL_TIME_INVALID',
);
assert.throws(
  () => logisticsLocalDateTimeToIso('2026-11-16T09:00', ''),
  error => error?.code === 'SCHEDULING_TIMEZONE_REQUIRED',
);

const ui = await readFile(new URL('../app/src/logistics/scheduling.js', import.meta.url), 'utf8');
assert.match(ui, /logisticsLocalDateTimeToIso/);
assert.match(ui, /data\.timeZone/);
assert.match(ui, /activity\.timezone \|\| workspaceTimeZone/);
assert.doesNotMatch(ui, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/,
  'the operator browser timezone must not define logistics scheduling time');
assert.doesNotMatch(ui, /new Date\(startValue\)/,
  'datetime-local input must not be parsed using the browser timezone');

console.log('L11 Logistics Scheduling Canonical Timezone Regression: PASS');
