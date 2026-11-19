// SC-03.5 — canonical location timezone persistence and validation regression.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-location-timezone-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram('location-timezone-owner-' + suffix, 'Location Owner');
  const seller = await store.createTenantForUser({
    userId: owner.id, sellerName: 'Timezone Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });

  const initial = await store.listOrganizationLocations(seller.chatId, { includeInactive: true });
  const defaultLocation = initial.find(location => location.code === 'DEFAULT');
  assert.ok(defaultLocation, 'canonical default location must exist');
  assert.equal(defaultLocation.timeZone, null, 'legacy/default location inherits organization timezone');
  assert.equal(store.getDatabaseForTests().prepare('SELECT version FROM schema_migrations WHERE version = 82').get()?.version, 82,
    'location timezone migration must be applied');

  const created = await store.createOrganizationLocation(seller.chatId, {
    code: 'BRANCH-TZ-' + suffix.slice(-6), name: 'Addis Branch',
    type: 'STORE', timezone: 'Africa/Addis_Ababa',
  });
  assert.equal(created.timeZone, 'Africa/Addis_Ababa');

  const listed = await store.listOrganizationLocations(seller.chatId, { includeInactive: true });
  assert.equal(listed.find(location => location.id === created.id)?.timeZone, 'Africa/Addis_Ababa');

  const updated = await store.updateOrganizationLocation(seller.chatId, created.id, { timezone: 'Europe/London' });
  assert.equal(updated.timeZone, 'Europe/London');

  const inherited = await store.updateOrganizationLocation(seller.chatId, created.id, { timezone: null });
  assert.equal(inherited.timeZone, null, 'explicit null restores organization-timezone inheritance');

  await assert.rejects(
    store.createOrganizationLocation(seller.chatId, {
      code: 'BAD-TZ-' + suffix.slice(-6), name: 'Invalid Timezone',
      timezone: 'Mars/Olympus_Mons',
    }),
    error => error?.code === 'LOCATION_TIMEZONE_INVALID',
  );

  const otherOwner = await store.getOrCreateUserByTelegram('location-timezone-other-' + suffix, 'Other Owner');
  const otherSeller = await store.createTenantForUser({
    userId: otherOwner.id, sellerName: 'Other Seller', businessType: 'services',
    country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
  });
  await assert.rejects(
    store.updateOrganizationLocation(otherSeller.chatId, created.id, { timezone: 'Europe/Paris' }),
    error => error?.statusCode === 404,
    'a location from another organization must not be mutable',
  );

  // Simulate a legacy/diverged database whose migration ledger already records
  // version 82 but whose locations table lacks the timezone column. Reopening
  // the store must repair the schema rather than trusting the version marker.
  const db = store.getDatabaseForTests();
  db.exec('ALTER TABLE locations DROP COLUMN timezone');
  db.close();
  const repair = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const store = await import('./backend/lib/store-sqlite.js');
    const columns = store.getDatabaseForTests().prepare('PRAGMA table_info(locations)').all();
    if (!columns.some(column => column.name === 'timezone')) {
      throw new Error('location timezone column was not repaired on reopen');
    }
    const migration = store.getDatabaseForTests().prepare(
      'SELECT version FROM schema_migrations WHERE version = 82'
    ).get();
    if (migration?.version !== 82) throw new Error('migration 82 marker unexpectedly missing');
    store.getDatabaseForTests().close();
  `], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
  assert.equal(repair.status, 0,
    'stale migration marker must not hide missing timezone column:\\n' + repair.stdout + repair.stderr);

  console.log('SC-03.5 canonical location timezone persistence regression: PASS');
  console.log('Migration, organization fallback, IANA validation, update and tenant isolation: PASS');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
