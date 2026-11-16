import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const store = read('backend/lib/store-sqlite.js');
const server = read('backend/server.js');
const contract = read('backend/lib/service-availability-contract.js');
const ui = read('app/src/logistics/service-bookings.js');
assert.match(store, /if \(!applied\.includes\(79\)\)/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resource_availability/);
assert.match(store, /CREATE TABLE IF NOT EXISTS service_resource_availability_commands/);
assert.match(store, /export async function getServiceResourceAvailability/);
assert.match(store, /export async function setServiceResourceAvailability/);
assert.match(store, /BEGIN IMMEDIATE/);
assert.match(store, /SERVICE_AVAILABILITY_VERSION_CONFLICT/);
assert.match(store, /SERVICE_AVAILABILITY_IDEMPOTENCY_CONFLICT/);
const availabilityCommandsTable = store.match(/CREATE TABLE IF NOT EXISTS service_resource_availability_commands \(([\s\S]*?)\n\s*\);/);
assert.ok(availabilityCommandsTable, 'migration 79 must define the availability idempotency table');
assert.match(availabilityCommandsTable[1], /(?:^|\n)\s*response_json TEXT NOT NULL,?\s*(?:\n|$)/,
  'availability idempotency table itself must persist its original response');
assert.match(store, /parseJSON\(prior\.response_json, null\)/, 'idempotency replay must use original response snapshot');
assert.doesNotMatch(store, /const replay = db\.prepare\('SELECT \* FROM service_resource_availability WHERE resource_id=\?'\)/, 'replay must not return the resource current state');
assert.match(store, /services\.resource\.availability\.updated/);
assert.match(store, /organization\?\.timezone/);
assert.match(server, /handleServiceResourceAvailability/);
assert.ok(server.includes('handleServiceResourceAvailability(req, res, decodeURIComponent(m[1]), decodeURIComponent(m[2]))'), 'availability GET/PUT routes must be registered');
assert.match(server, /service:service_resource:view/);
assert.match(server, /service:service_resource:manage/);
assert.match(contract, /WORKING_HOURS_OVERLAP/);
assert.match(contract, /SERVICE_AVAILABILITY_EXCEPTION_DUPLICATE/);
assert.match(contract, /RESOURCE_COMMITMENTS_NOT_EVALUATED/);
assert.match(ui, /service-resource-availability/);

const localeNames = ['en', 'am', 'om', 'so', 'sw', 'es', 'hi', 'fr', 'ar', 'ha', 'yo', 'ru', 'pt'];
const localeKeys = [
  'serviceAvailabilityConfigure', 'serviceAvailabilityLoading', 'serviceAvailabilityLoadFailed',
  'serviceAvailabilityTimezone', 'serviceAvailabilityWorkingHours', 'serviceAvailabilityExceptions',
  'serviceAvailabilityDeclarationOnly', 'serviceAvailabilityEmpty', 'serviceAvailabilityDeclared',
  'serviceAvailabilitySave', 'serviceAvailabilityInvalidJson', 'serviceAvailabilitySaving',
  'serviceAvailabilitySavedDeclaration', 'serviceAvailabilitySaveFailed',
];
for (const locale of localeNames) {
  const source = read('app/src/i18n/locales/' + locale + '.js');
  for (const key of localeKeys) {
    const count = source.match(new RegExp('\\b' + key + '\\s*:', 'g')) || [];
    assert.equal(count.length, 1, locale + ' must define ' + key + ' exactly once');
  }
}

console.log('SC-03.2 Service Availability API and UI Regression: PASS');
