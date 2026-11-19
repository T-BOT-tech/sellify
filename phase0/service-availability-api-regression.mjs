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
assert.match(store, /effectiveTimeZone/, 'availability must expose the effective location timezone');
assert.match(store, /location\?\.timezone \|\| organization\?\.timezone/, 'new declarations must inherit location timezone before organization timezone');
assert.match(store, /scheduleUsesCurrentLocationTimeZone/, 'existing schedule timezone drift must be explicit');
assert.match(store, /resource\.location_timezone/, 'buyer feasibility must resolve resource location timezone');
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


// Real SQLite persistence regression: use an isolated database and the canonical
// store functions, not source-pattern checks, for save/replay/conflict behavior.
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-availability-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const storeApi = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await storeApi.getOrCreateUserByTelegram('availability-owner-' + suffix, 'Availability Owner');
  const seller = await storeApi.createTenantForUser({
    userId: owner.id, sellerName: 'Availability Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await storeApi.saveCatalog(seller.chatId, [
    { id: 'availability-consultation', name: 'Consultation', price: 25000, item_type: 'service' },
  ]);
  const locations = await storeApi.listOrganizationLocations(seller.chatId, { includeInactive: true });
  const location = locations.find(item => item.status === 'active');
  assert.ok(location, 'availability integration test requires the canonical default location');
  const created = await storeApi.createServiceResource(seller.chatId, {
    resource_type: 'PROVIDER',
    name: 'Availability Provider',
    service_item_id: 'availability-consultation',
    location_id: location.id,
    idempotency_key: 'availability-resource-' + suffix,
  }, { userId: owner.id });
  const resourceId = created.resource.id;
  const firstInput = {
    expected_version: 0,
    idempotency_key: 'availability-save-' + suffix,
    working_hours: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
    exceptions: [{ date: '2027-01-01', kind: 'CLOSED', note: 'Holiday' }],
  };
  const first = await storeApi.setServiceResourceAvailability(seller.chatId, resourceId, firstInput, { userId: owner.id });
  assert.equal(first.replayed, false);
  assert.equal(first.availability.version, 1);
  assert.equal(first.availability.workingHours.length, 1);
  assert.equal(first.availability.exceptions.length, 1);
  const readBack = await storeApi.getServiceResourceAvailability(seller.chatId, resourceId);
  assert.equal(readBack.version, 1);
  assert.deepEqual(readBack.workingHours, first.availability.workingHours);
  assert.deepEqual(readBack.exceptions, first.availability.exceptions);

  const second = await storeApi.setServiceResourceAvailability(seller.chatId, resourceId, {
    expected_version: 1,
    idempotency_key: 'availability-save-next-' + suffix,
    working_hours: [{ weekday: 1, start_time: '10:00', end_time: '16:00' }],
    exceptions: [],
  }, { userId: owner.id });
  assert.equal(second.availability.version, 2);

  const replay = await storeApi.setServiceResourceAvailability(seller.chatId, resourceId, firstInput, { userId: owner.id });
  assert.equal(replay.replayed, true);
  assert.equal(replay.availability.version, 1, 'replay must return the original saved response, not current state');
  assert.deepEqual(replay.availability.workingHours, first.availability.workingHours);
  await assert.rejects(
    storeApi.setServiceResourceAvailability(seller.chatId, resourceId, {
      ...firstInput,
      working_hours: [{ weekday: 1, start_time: '08:00', end_time: '12:00' }],
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_AVAILABILITY_IDEMPOTENCY_CONFLICT',
    'same idempotency key with a different payload must be rejected',
  );
  await assert.rejects(
    storeApi.setServiceResourceAvailability(seller.chatId, resourceId, {
      expected_version: 1,
      idempotency_key: 'availability-stale-' + suffix,
      working_hours: [{ weekday: 2, start_time: '09:00', end_time: '17:00' }],
      exceptions: [],
    }, { userId: owner.id }),
    error => error?.code === 'SERVICE_AVAILABILITY_VERSION_CONFLICT',
    'stale expected version must fail',
  );
  const afterFailure = await storeApi.getServiceResourceAvailability(seller.chatId, resourceId);
  assert.equal(afterFailure.version, 2, 'failed command must not partially mutate availability');
  assert.deepEqual(afterFailure.workingHours, second.availability.workingHours);
  const db = storeApi.getDatabaseForTests();
  const commandCount = db.prepare('SELECT COUNT(*) AS count FROM service_resource_availability_commands WHERE organization_id = ?').get(first.availability.organizationId).count;
  assert.equal(commandCount, 2, 'failed commands and replay must not create extra command records');
  const auditCount = db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'service_resource' AND entity_id = ? AND action = 'services.resource.availability.updated'").get(resourceId).count;
  assert.equal(auditCount, 2, 'only successful availability mutations should create audit events');
  console.log('SC-03.2 SQLite save/read/replay/idempotency/version/rollback regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
