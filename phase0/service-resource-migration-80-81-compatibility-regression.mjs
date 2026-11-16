import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-service-migration-81-'));
const dbPath = path.join(tempDir, 'sellify.sqlite');
const env = { ...process.env, SELLIFY_DATA_DIR: tempDir, SELLIFY_DB_PATH: dbPath };

function restartStore() {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./backend/lib/store-sqlite.js')"], {
    cwd: process.cwd(), env, encoding: 'utf8',
  });
  assert.equal(result.status, 0, `store migration subprocess failed:\n${result.stdout}\n${result.stderr}`);
}

try {
  // Build a real booking/resource using the canonical store, then emulate the
  // alternate migration-80 history: booking resource column/index exists but
  // the resource commitment ledger does not.
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('migration-owner-' + suffix, 'Migration Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Migration Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await store.saveCatalog(seller.chatId, [{
    id: 'migration-service', name: 'Migration Service', price: 25000,
    item_type: 'service', marketplace_listed: true,
  }]);
  await store.createMarketplaceOrder({
    buyer_id: 'migration-buyer-' + suffix, customer_name: 'Migration Buyer',
    items: [{ seller_id: seller.chatId, item_id: 'migration-service', qty: 1 }],
    idempotency_key: 'migration-checkout-' + suffix,
  });
  const order = (await store.getOrders(seller.chatId)).find(item =>
    item.is_marketplace && item.items?.some(line => line.item_id === 'migration-service'));
  assert.ok(order?.server_order_id);

  const created = await store.createServiceBooking(seller.chatId, order.server_order_id, {
    service_item_id: 'migration-service',
    requested_start: '2026-11-17T09:00:00+03:00',
    requested_end: '2026-11-17T10:00:00+03:00',
    appointment_mode: 'REMOTE',
    idempotency_key: 'migration-booking-' + suffix,
  }, { userId: owner.id });
  await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'ACCEPTED', expected_version: 1, idempotency_key: 'migration-accept-' + suffix,
  }, { userId: owner.id });
  const resource = await store.createServiceResource(seller.chatId, {
    name: 'Migration Resource', resourceType: 'PROVIDER',
    serviceItemId: 'migration-service', idempotency_key: 'migration-resource-' + suffix,
  }, { userId: owner.id });
  await store.setServiceResourceAvailability(seller.chatId, resource.resource.id, {
    expected_version: 0, idempotency_key: 'migration-hours-' + suffix,
    workingHours: [0, 1, 2, 3, 4, 5, 6].map(weekday => ({
      weekday, startTime: '08:00', endTime: '18:00',
    })),
    exceptions: [],
  }, { userId: owner.id });
  const confirmed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
    status: 'CONFIRMED', expected_version: 2, service_resource_id: resource.resource.id,
    idempotency_key: 'migration-confirm-' + suffix,
  }, { userId: owner.id });
  assert.equal(confirmed.booking.status, 'CONFIRMED');

  const db = store.getDatabaseForTests();
  db.exec('DROP TABLE service_resource_commitments');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_service_bookings_resource_window
      ON service_bookings(organization_id, chat_id, service_resource_id, status, requested_start, requested_end);
  `);
  db.prepare('DELETE FROM schema_migrations WHERE version = 81').run();
  // Version 80 stays recorded: migration 81 must repair this shape forward.
  assert.ok(db.prepare('SELECT version FROM schema_migrations WHERE version = 80').get());
  db.close();

  restartStore();

  let migrated = new DatabaseSync(dbPath);
  const bridged = migrated.prepare('SELECT * FROM service_resource_commitments WHERE booking_id = ?').get(created.booking.id);
  assert.ok(bridged, 'migration 81 must bridge an explicitly assigned active booking');
  assert.equal(bridged.resource_id, resource.resource.id);
  assert.equal(bridged.state, 'COMMITTED');
  assert.equal(bridged.starts_at, confirmed.booking.requested_start);
  assert.equal(bridged.ends_at, confirmed.booking.requested_end);
  assert.ok(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 81').get());
  assert.ok(migrated.prepare(`PRAGMA index_list('service_bookings')`).all()
    .some(index => index.name === 'idx_service_bookings_resource_window'));
  migrated.close();

  // The forward migration is safe to restart/replay and must not duplicate
  // the one commitment for a booking.
  restartStore();
  migrated = new DatabaseSync(dbPath);
  assert.equal(migrated.prepare('SELECT count(*) AS count FROM service_resource_commitments WHERE booking_id = ?')
    .get(created.booking.id).count, 1);
  migrated.close();

  console.log('Service Resource Migration 80/81 Compatibility Regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
