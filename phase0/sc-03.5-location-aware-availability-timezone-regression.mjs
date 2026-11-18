// SC-03.5 — location timezone integration with declared service schedules.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-location-schedule-timezone-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('location-schedule-owner-' + suffix, 'Schedule Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Schedule Timezone Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [
    { id: 'consultation', name: 'Consultation', price: 25000, item_type: 'service' },
  ]);

  const location = await store.createOrganizationLocation(seller.chatId, {
    code: 'LONDON-' + suffix.slice(-6), name: 'London Branch', type: 'STORE', timezone: 'Europe/London',
  });
  const created = await store.createServiceResource(seller.chatId, {
    resource_type: 'PROVIDER', name: 'Branch Provider', service_item_id: 'consultation',
    location_id: location.id, idempotency_key: 'resource-' + suffix,
  }, { userId: owner.id });
  const resourceId = created.resource.id;

  const first = await store.setServiceResourceAvailability(seller.chatId, resourceId, {
    expected_version: 0,
    idempotency_key: 'availability-london-' + suffix,
    working_hours: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
    exceptions: [],
  }, { userId: owner.id });
  assert.equal(first.availability.timeZone, 'Europe/London',
    'new declared schedule must use the resource location timezone');
  assert.equal(first.availability.effectiveTimeZone, 'Europe/London');

  const locationChanged = await store.updateOrganizationLocation(seller.chatId, location.id, {
    timezone: 'Europe/Paris',
  });
  assert.equal(locationChanged.timeZone, 'Europe/Paris');

  const existingSchedule = await store.getServiceResourceAvailability(seller.chatId, resourceId);
  assert.equal(existingSchedule.timeZone, 'Europe/London',
    'changing location timezone must not silently reinterpret an existing schedule');
  assert.equal(existingSchedule.effectiveTimeZone, 'Europe/Paris');
  assert.equal(existingSchedule.scheduleUsesCurrentLocationTimeZone, false,
    'UI must be able to explain that the existing schedule uses its prior timezone');

  const second = await store.setServiceResourceAvailability(seller.chatId, resourceId, {
    expected_version: 1,
    idempotency_key: 'availability-paris-' + suffix,
    working_hours: [{ weekday: 1, start_time: '09:00', end_time: '17:00' }],
    exceptions: [],
  }, { userId: owner.id });
  assert.equal(second.availability.timeZone, 'Europe/Paris',
    'explicit schedule save adopts the current location timezone');
  assert.equal(second.availability.effectiveTimeZone, 'Europe/Paris');
  assert.equal(second.availability.scheduleUsesCurrentLocationTimeZone, true);

  const db = store.getDatabaseForTests();
  const audit = db.prepare(
    "SELECT metadata_json FROM audit_events WHERE entity_type='service_resource' AND entity_id=? AND action='services.resource.availability.updated' ORDER BY id"
  ).all(resourceId);
  assert.equal(audit.length, 2, 'both successful schedule declarations must be audited');
  assert.equal(JSON.parse(audit[0].metadata_json).timezone, 'Europe/London');
  assert.equal(JSON.parse(audit[1].metadata_json).timezone, 'Europe/Paris');

  console.log('SC-03.5 location-aware service availability timezone regression: PASS');
  console.log('Location override, organization fallback boundary, existing schedule preservation, explicit timezone adoption and audit: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
