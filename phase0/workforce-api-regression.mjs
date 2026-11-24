import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateWorkforceApiPayload } from '../backend/lib/workforce-api-validation.js';

const validMember = validateWorkforceApiPayload('member', 'create', {
  member_type: 'PROVIDER',
});
assert.equal(validMember.valid, true);

const invalidMember = validateWorkforceApiPayload('member', 'create', {
  member_type: 'TEMP_WORKER',
});
assert.equal(invalidMember.valid, false);
assert.ok(invalidMember.errors.some((error) => error.includes('member_type')));

const invalidWindow = validateWorkforceApiPayload('assignment', 'create', {
  starts_at: '2026-11-26T18:00:00.000Z',
  ends_at: '2026-11-26T09:00:00.000Z',
});
assert.equal(invalidWindow.valid, false);
assert.ok(invalidWindow.errors.some((error) => error.includes('must be before')));

const validCalendar = validateWorkforceApiPayload('calendar', 'create', {
  timezone: 'Africa/Addis_Ababa',
  weekly_schedule: [{ day: 'MONDAY', intervals: [{ start: '09:00', end: '17:00' }] }],
});
assert.equal(validCalendar.valid, true);

const invalidTimezone = validateWorkforceApiPayload('shift', 'create', {
  timezone: 'Not/A_Real_Zone',
});
assert.equal(invalidTimezone.valid, false);

const invalidProfile = validateWorkforceApiPayload('profile', 'create', {
  skills: ['service', 4],
});
assert.equal(invalidProfile.valid, false);

const invalidUtilization = validateWorkforceApiPayload('utilization', 'create', {
  status: 'COMPLETED',
});
assert.equal(invalidUtilization.valid, false);

const server = await readFile(new URL('../backend/server.js', import.meta.url), 'utf8');
const handlerStart = server.indexOf('async function handleWorkforce(');
const handlerEnd = server.indexOf('// ---------- routing ----------', handlerStart);
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
const handler = server.slice(handlerStart, handlerEnd);
for (const token of [
  'requireSession(req, chatId)',
  'createWorkforceSqliteRepository()',
  'repository.list(entity',
  'repository.get(entity',
  'repository.create(entity',
  'repository.update(entity',
  'workforceProviderResourceIds(session)',
  'listServiceResources(chatId',
  'provider_user_id',
]) assert.ok(handler.includes(token), `missing API boundary: ${token}`);
assert.equal(handler.includes('createServiceBooking('), false);
assert.equal(handler.includes('createLogisticsSchedulingActivity('), false);

for (const route of [
  '/workforce/members',
  '/workforce/profiles',
  '/workforce/engagements',
  '/workforce/calendars',
  '/workforce/calendar-exceptions',
  '/workforce/availability',
  '/workforce/assignments',
  '/workforce/shifts',
  '/workforce/allocations',
  '/workforce/utilization',
]) assert.ok(server.includes(route.slice(0, -1)) || server.includes(route), `missing route family: ${route}`);

console.log('PASS Workforce API validation and route-boundary regression');
