import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const [store, server, ui, packageSource, baseline] = await Promise.all([
  read('backend/lib/store-sqlite.js'),
  read('backend/server.js'),
  read('app/src/logistics/service-bookings.js'),
  read('package.json'),
  read('scripts/phase0-baseline.sh'),
]);

assert.match(store, /if \(!applied\.includes\(80\)\)/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_booking_resource_commitments/);
assert.match(store, /idx_service_booking_resource_commitment_window/);
assert.match(store, /assessServiceResourceDeclaredWindow/);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /requested_start < \? AND requested_end > \?/);
assert.match(store, /SERVICE_RESOURCE_TIME_CONFLICT/);
assert.match(store, /SERVICE_BOOKING_RESOURCE_SERVICE_MISMATCH/);
assert.match(store, /SERVICE_BOOKING_RESOURCE_LOCATION_MISMATCH/);
assert.match(store, /SERVICE_BOOKING_OUTSIDE_DECLARED_HOURS/);
assert.match(store, /SERVICE_RESOURCE_SCHEDULE_UNKNOWN/);
assert.match(store, /resource_id:resourceId/);
assert.match(store, /state='RELEASED',released_by=\?,released_at=\?,release_reason=\?/);
assert.match(store, /assigned_resource_id/);
assert.match(store, /resource_commitment_state/);

const transitionStart = store.indexOf('export async function transitionServiceBooking');
const transitionEnd = store.indexOf('\nexport async function listServiceBookings', transitionStart);
const transition = store.slice(transitionStart, transitionEnd);
assert.ok(transition.indexOf('BEGIN IMMEDIATE') < transition.indexOf('service_booking_resource_commitments'), 'resource conflict check and insert must remain inside the booking transaction');
assert.ok(transition.indexOf('INSERT INTO service_booking_resource_commitments') < transition.indexOf('INSERT INTO service_booking_commands'), 'commitment and booking command must share the same transaction');

assert.match(server, /service:service_resource:manage/);
assert.match(server, /service:booking:confirm/);
assert.match(server, /resourceContext:\s*\{/);
assert.match(server, /SERVICE_BOOKING_RESOURCE_REQUIRED/);
assert.match(ui, /service-booking-resource-select/);
assert.match(ui, /resource_id: resourceId/);
assert.match(ui, /serviceBookingNoEligibleResource/);
assert.match(ui, /return role === 'owner' \|\| role === 'manager'/);
assert.ok(!/logistics_manager|logistics_dispatcher/.test(ui),
  'Logistics contextual roles must not operate Service Booking lifecycle or UI');

const scripts = JSON.parse(packageSource).scripts;
assert.equal(scripts['test:service-booking-resource-commitment'], 'node phase0/service-booking-resource-commitment-regression.mjs');
assert.ok(baseline.includes('node phase0/service-booking-resource-commitment-regression.mjs'));

const localeNames = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const keys = ['serviceBookingResource', 'serviceBookingChooseResource', 'serviceBookingNoEligibleResource', 'serviceBookingAssignedResource'];
for (const locale of localeNames) {
  const source = await read('app/src/i18n/locales/' + locale + '.js');
  for (const key of keys) {
    assert.equal(source.split(key + ':').length - 1, 1, locale + ' must define ' + key + ' exactly once');
  }
}

console.log('SC-03.4 Service Booking atomic resource commitment contract regression: PASS');
