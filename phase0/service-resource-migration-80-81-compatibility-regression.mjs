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
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', "const store = await import('./backend/lib/store-sqlite.js'); store.getDatabaseForTests().close()"], {
    cwd: process.cwd(), env, encoding: 'utf8',
  });
  assert.equal(result.status, 0, `store migration subprocess failed:\n${result.stdout}\n${result.stderr}`);
}

try {
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

  async function confirmBooking(label, startHour, endHour) {
    const created = await store.createServiceBooking(seller.chatId, order.server_order_id, {
      service_item_id: 'migration-service',
      requested_start: `2026-11-17T${String(startHour).padStart(2, '0')}:00:00+03:00`,
      requested_end: `2026-11-17T${String(endHour).padStart(2, '0')}:00:00+03:00`,
      appointment_mode: 'REMOTE',
      idempotency_key: `migration-booking-${label}-${suffix}`,
    }, { userId: owner.id });
    await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'ACCEPTED', expected_version: 1, idempotency_key: `migration-accept-${label}-${suffix}`,
    }, { userId: owner.id });
    const confirmed = await store.transitionServiceBooking(seller.chatId, order.server_order_id, created.booking.id, {
      status: 'CONFIRMED', expected_version: 2, service_resource_id: resource.resource.id,
      idempotency_key: `migration-confirm-${label}-${suffix}`,
    }, { userId: owner.id });
    assert.equal(confirmed.booking.status, 'CONFIRMED');
    return { id: created.booking.id, booking: confirmed.booking };
  }
  const legacyLedgerBooking = await confirmBooking('legacy-ledger', 9, 10);
  const assignedColumnBooking = await confirmBooking('assigned-column', 11, 12);

  const db = store.getDatabaseForTests();
  const originalCommitments = db.prepare('SELECT * FROM service_resource_commitments WHERE booking_id IN (?, ?)')
    .all(legacyLedgerBooking.id, assignedColumnBooking.id);
  assert.equal(originalCommitments.length, 2);

  // Emulate the PR #234 v80 shape: assigned_resource_id plus a differently
  // named commitment ledger. The canonical service_resource_id is absent for
  // this booking, so migration 81 must map only this explicit assignment.
  db.exec(`
    ALTER TABLE service_bookings ADD COLUMN assigned_resource_id TEXT;
    ALTER TABLE service_bookings ADD COLUMN resource_commitment_state TEXT NOT NULL DEFAULT 'NONE';
    ALTER TABLE service_bookings ADD COLUMN resource_committed_at TEXT;
  `);
  db.prepare(`UPDATE service_bookings SET service_resource_id=NULL, assigned_resource_id=?,
    resource_commitment_state='COMMITTED', resource_committed_at=updated_at WHERE id=?`)
    .run(resource.resource.id, legacyLedgerBooking.id);
  db.exec(`
    CREATE TABLE service_booking_resource_commitments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      booking_id TEXT NOT NULL UNIQUE,
      resource_id TEXT NOT NULL,
      requested_start TEXT NOT NULL,
      requested_end TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('COMMITTED','RELEASED')),
      committed_by TEXT,
      committed_at TEXT NOT NULL,
      released_by TEXT,
      released_at TEXT,
      release_reason TEXT,
      CHECK (requested_end > requested_start)
    );
  `);
  const old = originalCommitments.find(row => row.booking_id === legacyLedgerBooking.id);
  db.prepare(`INSERT INTO service_booking_resource_commitments
    (id, organization_id, chat_id, booking_id, resource_id, requested_start, requested_end,
     state, committed_by, committed_at, released_by, released_at, release_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`)
    .run(old.id, old.organization_id, old.chat_id, old.booking_id, old.resource_id,
      old.starts_at, old.ends_at, old.state, old.committed_by, old.committed_at, old.released_by, old.released_at);

  // Emulate PR #235 v80: service_resource_id + index, but no commitment ledger.
  db.exec('DROP TABLE service_resource_commitments');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_service_bookings_resource_window
      ON service_bookings(organization_id, chat_id, service_resource_id, status, requested_start, requested_end);
  `);
  db.prepare('DELETE FROM schema_migrations WHERE version = 81').run();
  assert.ok(db.prepare('SELECT version FROM schema_migrations WHERE version = 80').get());
  db.close();

  restartStore();

  let migrated = new DatabaseSync(dbPath);
  for (const booking of [legacyLedgerBooking, assignedColumnBooking]) {
    const bridged = migrated.prepare('SELECT * FROM service_resource_commitments WHERE booking_id = ?').get(booking.id);
    assert.ok(bridged, `migration 81 must bridge booking ${booking.id}; diagnostics=${JSON.stringify({
      migrations: migrated.prepare('SELECT version FROM schema_migrations WHERE version IN (80,81)').all(),
      booking: migrated.prepare('SELECT id,status,service_resource_id,assigned_resource_id,organization_id,chat_id,requested_start,requested_end FROM service_bookings WHERE id=?').get(booking.id),
      legacy: migrated.prepare('SELECT * FROM service_booking_resource_commitments WHERE booking_id=?').get(booking.id),
      commitments: migrated.prepare('SELECT * FROM service_resource_commitments').all(),
    })}`);
    assert.equal(bridged.resource_id, resource.resource.id);
    assert.equal(bridged.state, 'COMMITTED');
    assert.equal(bridged.starts_at, booking.booking.requested_start);
    assert.equal(bridged.ends_at, booking.booking.requested_end);
  }
  assert.ok(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 81').get());
  assert.ok(migrated.prepare(`PRAGMA index_list('service_bookings')`).all()
    .some(index => index.name === 'idx_service_bookings_resource_window'));
  migrated.close();

  restartStore();
  migrated = new DatabaseSync(dbPath);
  assert.equal(migrated.prepare('SELECT count(*) AS count FROM service_resource_commitments').get().count, 2,
    'replaying migration 81 must not duplicate commitments');
  migrated.close();

  console.log('Service Resource Migration 80/81 Compatibility Regression: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
