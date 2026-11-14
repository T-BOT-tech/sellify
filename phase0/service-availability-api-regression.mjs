import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const store = read('backend/lib/store-sqlite.js');
const server = read('backend/server.js');
const contract = read('backend/lib/service-availability-contract.js');
const ui = read('app/src/logistics/service-bookings.js');
assert.match(store, /if \(!applied\.includes\(79\)\)/);
assert.match(store, /if \(!applied\.includes\(80\)\)/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resource_commitments/);
assert.match(store, /SERVICE_BOOKING_RESOURCE_CONFLICT/);
assert.match(store, /SERVICE_AVAILABILITY_CONFLICTS_WITH_COMMITMENTS/);
assert.match(store, /SERVICE_RESOURCE_HAS_ACTIVE_COMMITMENTS/);
assert.match(store, /assessServiceResourceCommitWindow/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resource_availability/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resource_availability_commands/);
assert.match(store, /export async function getServiceResourceAvailability/);
assert.match(store, /export async function setServiceResourceAvailability/);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /SERVICE_AVAILABILITY_VERSION_CONFLICT/);
assert.match(store, /SERVICE_AVAILABILITY_IDEMPOTENCY_CONFLICT/);
assert.match(store, /services\.resource\.availability\.updated/);
assert.match(store, /organization\?\.timezone/);
assert.match(server, /handleServiceResourceAvailability/);
assert.match(server, /service:appointment:commit/);
assert.match(server, /service_appointment/);
assert.ok(server.includes('handleServiceResourceAvailability(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]))'), 'availability GET/PUT routes must be registered');
assert.match(server, /service:service_resource:view/);
assert.match(server, /service:service_resource:manage/);
assert.match(server, /service:resource_availability:view/);
assert.match(server, /service:resource_availability:manage/);
assert.match(server, /resourceContext: \{ resourceType: 'service_resource'/);
assert.match(contract, /WORKING_HOURS_OVERLAP/);
assert.match(contract, /SERVICE_AVAILABILITY_EXCEPTION_DUPLICATE/);
assert.match(contract, /RESOURCE_COMMITMENTS_NOT_EVALUATED/);
assert.match(ui, /service-resource-availability/);
assert.match(ui, /availability\.timeZone/, 'availability editor must consume the canonical camelCase timeZone field');

const localeNames = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const localeKeys = [
  'serviceAvailabilityConfigure', 'serviceAvailabilityLoading', 'serviceAvailabilityLoadFailed',
  'serviceAvailabilityTimezone', 'serviceAvailabilityWorkingHours', 'serviceAvailabilityExceptions',
  'serviceAvailabilityDeclarationOnly', 'serviceAvailabilityEmpty', 'serviceAvailabilityDeclared',
  'serviceAvailabilitySave', 'serviceAvailabilityInvalidJson', 'serviceAvailabilitySaving',
  'serviceAvailabilitySavedDeclaration', 'serviceAvailabilitySaveFailed', 'serviceBookingChooseResource', 'serviceBookingConfirmResource', 'serviceBookingCancelResource',
];
for (const locale of localeNames) {
  const source = read('app/src/i18n/locales/' + locale + '.js');
  for (const key of localeKeys) {
    const count = source.match(new RegExp('\\b' + key + '\\s*:', 'g')) || [];
    assert.equal(count.length, 1, locale + ' must define ' + key + ' exactly once');
  }
}

console.log('SC-03.2 Service Availability API and UI Regression: PASS');
