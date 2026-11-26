import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = await mkdtemp(path.join(os.tmpdir(), 'sellify-workforce-restore-'));
const sourceDir = path.join(root, 'source');
const legacyDir = path.join(root, 'legacy');
const upgradedDir = path.join(root, 'upgraded');
const backupDir = path.join(root, 'backups');
const restoreDir = path.join(root, 'restore');
const sourceDb = path.join(sourceDir, 'sellify.sqlite');
const legacyDb = path.join(legacyDir, 'sellify.sqlite');
const upgradedDb = path.join(upgradedDir, 'sellify.sqlite');
const restoredDb = path.join(restoreDir, 'sellify.sqlite');

process.env.SELLIFY_DATA_DIR = sourceDir;
process.env.SELLIFY_DB_PATH = sourceDb;
process.env.SELLIFY_BACKUP_DIR = backupDir;
process.env.SELLIFY_BACKUP_RETENTION = '7';

function assertDatabaseIntegrity(databasePath, label) {
  const check = new DatabaseSync(databasePath);
  try {
    const integrity = check.prepare('PRAGMA integrity_check').all();
    assert.deepEqual(integrity, [{ integrity_check: 'ok' }], label + ' SQLite integrity');
    check.exec('PRAGMA foreign_keys = ON');
    assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(), [], label + ' foreign-key integrity');
  } finally {
    check.close();
  }
}

function assertWorkforceMigrations(databasePath, label) {
  const check = new DatabaseSync(databasePath);
  try {
    const versions = check.prepare('SELECT version FROM schema_migrations WHERE version BETWEEN 86 AND 100 ORDER BY version')
      .all().map(row => Number(row.version));
    assert.deepEqual(versions, Array.from({ length: 15 }, (_, index) => index + 86),
      label + ' must contain all Workforce migration markers 86-100');
  } finally {
    check.close();
  }
}

try {
  const sourceStore = await import(`../backend/lib/store-sqlite.js?workforce-restore-source=${crypto.randomUUID()}`);
  const user = await sourceStore.getOrCreateUserByTelegram('workforce-restore-user', 'Workforce Restore');
  await sourceStore.getOrCreateTenant('workforce-restore-tenant');

  const ids = {
    product: 'workforce-restore-product',
    member: 'workforce-restore-member',
    profile: 'workforce-restore-profile',
    availability: 'workforce-restore-availability',
    shift: 'workforce-restore-shift',
  };
  const timestamp = new Date().toISOString();
  const source = new DatabaseSync(sourceDb);
  let organizationId;
  let tenantId;
  try {
    const tenant = source.prepare(
      'SELECT chat_id, tenant_id, organization_id FROM tenants WHERE chat_id = ?'
    ).get('workforce-restore-tenant');
    assert.ok(tenant?.organization_id, 'existing Sellify tenant must have a canonical organization');
    organizationId = tenant.organization_id;
    tenantId = tenant.tenant_id;

    // Seed a canonical business record before simulating the pre-Workforce
    // database state. The upgrade must not rewrite or lose this row.
    source.prepare(`
      INSERT INTO catalog_products
        (chat_id, product_id, product_json, price_minor, stock, marketplace_listed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenant.chat_id, ids.product,
      JSON.stringify({ id: ids.product, name: 'Restore fixture product', item_type: 'product' }),
      12500, 17, 0, timestamp,
    );
  } finally {
    source.close();
  }

  // Start from a consistent full Sellify snapshot, then remove only the
  // Workforce additions to model a database whose schema is at version 85.
  const baselineSnapshot = await sourceStore.createDatabaseBackup();
  await mkdir(legacyDir, { recursive: true });
  await copyFile(baselineSnapshot.path, legacyDb);
  const legacy = new DatabaseSync(legacyDb);
  try {
    legacy.exec('PRAGMA foreign_keys = OFF');
    legacy.exec('DROP INDEX IF EXISTS idx_service_bookings_workforce_member');

    // Rebuild only the existing Service Booking table from its own SQLite DDL,
    // excluding the one additive Workforce reference. This keeps every
    // pre-existing Service Booking column, constraint, row, and index intact.
    const bookingDdl = legacy.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'service_bookings'"
    ).get()?.sql;
    assert.ok(bookingDdl, 'legacy fixture must contain the canonical Service Booking table');
    assert.match(bookingDdl, /workforce_member_id/i, 'source snapshot must include the additive Workforce member reference');
    const bookingIndexes = legacy.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'service_bookings' AND sql IS NOT NULL"
    ).all().map(row => row.sql);
    const bookingTriggers = legacy.prepare(
      "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'service_bookings' AND sql IS NOT NULL"
    ).all().map(row => row.sql);
    const workforceColumnPosition = bookingDdl.indexOf('workforce_member_id');
    const workforceColumnStart = bookingDdl.lastIndexOf(',', workforceColumnPosition);
    const tableDefinitionEnd = bookingDdl.lastIndexOf(')');
    assert.ok(workforceColumnPosition >= 0 && workforceColumnStart >= 0 && tableDefinitionEnd > workforceColumnPosition,
      'Workforce member reference must be an appended Service Booking column');
    const legacyBookingDdl = (bookingDdl.slice(0, workforceColumnStart) + bookingDdl.slice(tableDefinitionEnd))
      .replace(/^CREATE TABLE service_bookings/i, 'CREATE TABLE service_bookings_preworkforce');
    assert.ok(!legacyBookingDdl.includes('workforce_member_id'),
      'legacy Service Booking DDL must remove the Workforce-only column');
    legacy.exec(legacyBookingDdl);
    const bookingColumns = legacy.prepare('PRAGMA table_info(service_bookings_preworkforce)').all()
      .filter(column => column.name !== 'workforce_member_id')
      .map(column => '"' + String(column.name).replaceAll('"', '""') + '"');
    const bookingColumnSql = bookingColumns.join(', ');
    legacy.exec('INSERT INTO service_bookings_preworkforce (' + bookingColumnSql + ') SELECT ' + bookingColumnSql + ' FROM service_bookings');
    legacy.exec('DROP TABLE service_bookings');
    legacy.exec('ALTER TABLE service_bookings_preworkforce RENAME TO service_bookings');
    for (const sql of bookingIndexes) legacy.exec(sql);
    for (const sql of bookingTriggers) legacy.exec(sql);

    const workforceTables = legacy.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'workforce_%' ORDER BY name DESC"
    ).all().map(row => String(row.name));
    for (const table of workforceTables) {
      legacy.exec('DROP TABLE IF EXISTS "' + table.replaceAll('"', '""') + '"');
    }
    legacy.prepare('DELETE FROM schema_migrations WHERE version BETWEEN 86 AND 100').run();
    assert.equal(legacy.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version, 85,
      'simulated legacy database must be at the pre-Workforce migration version');
    assert.equal(legacy.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name LIKE 'workforce_%'").get().count, 0,
      'simulated legacy database must not contain Workforce tables');
    assert.ok(!legacy.prepare('PRAGMA table_info(service_bookings)').all()
      .some(column => column.name === 'workforce_member_id'),
    'simulated legacy Service Booking schema must not contain the Workforce link');
    assert.deepEqual(legacy.prepare('PRAGMA foreign_key_check').all(), [],
      'simulated pre-Workforce database must retain valid canonical foreign keys');
  } finally {
    legacy.close();
  }

  // Run the real application startup/migration path against the pre-Workforce
  // snapshot. This exercises the same migration registration as deployment.
  await mkdir(upgradedDir, { recursive: true });
  await copyFile(legacyDb, upgradedDb);
  process.env.SELLIFY_DATA_DIR = upgradedDir;
  process.env.SELLIFY_DB_PATH = upgradedDb;
  process.env.SELLIFY_BACKUP_DIR = path.join(upgradedDir, 'backups');
  const upgradedStore = await import(`../backend/lib/store-sqlite.js?workforce-upgrade=${crypto.randomUUID()}`);
  const upgradedUser = await upgradedStore.getOrCreateUserByTelegram('workforce-restore-user', 'Workforce Restore');
  assert.equal(upgradedUser.id, user.id, 'canonical user identity must survive the pre-Workforce upgrade');
  assertWorkforceMigrations(upgradedDb, 'upgraded database');
  assertDatabaseIntegrity(upgradedDb, 'upgraded database');

  const upgraded = new DatabaseSync(upgradedDb);
  try {
    const product = upgraded.prepare('SELECT product_json, price_minor, stock FROM catalog_products WHERE chat_id = ? AND product_id = ?')
      .get('workforce-restore-tenant', ids.product);
    assert.ok(product, 'pre-existing canonical catalog record must survive migration');
    assert.equal(JSON.parse(product.product_json).name, 'Restore fixture product');
    assert.equal(product.price_minor, 12500);
    assert.equal(product.stock, 17);

    upgraded.prepare(`
      INSERT INTO workforce_members
        (id, organization_id, tenant_id, chat_id, user_id, member_type, status, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, ?, ?)
    `).run(ids.member, organizationId, tenantId, 'workforce-restore-tenant', user.id,
      'Restore fixture member', timestamp, timestamp);

    upgraded.prepare(`
      INSERT INTO workforce_profiles
        (id, organization_id, tenant_id, chat_id, member_id, skills_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ids.profile, organizationId, tenantId, 'workforce-restore-tenant', ids.member,
      JSON.stringify(['inventory-counting']), timestamp, timestamp);

    upgraded.prepare(`
      INSERT INTO workforce_availability_windows
        (id, organization_id, tenant_id, chat_id, member_id, availability, starts_at, ends_at, timezone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, 'Africa/Addis_Ababa', ?, ?)
    `).run(ids.availability, organizationId, tenantId, 'workforce-restore-tenant', ids.member,
      '2026-12-01T05:00:00.000Z', '2026-12-01T13:00:00.000Z', timestamp, timestamp);

    upgraded.prepare(`
      INSERT INTO workforce_shifts
        (id, organization_id, tenant_id, chat_id, member_id, starts_at, ends_at, timezone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Africa/Addis_Ababa', 'CONFIRMED', ?, ?)
    `).run(ids.shift, organizationId, tenantId, 'workforce-restore-tenant', ids.member,
      '2026-12-01T05:00:00.000Z', '2026-12-01T13:00:00.000Z', timestamp, timestamp);

    assert.deepEqual(upgraded.prepare('PRAGMA foreign_key_check').all(), [],
      'seeded upgraded database must satisfy foreign keys');
  } finally {
    upgraded.close();
  }

  // Snapshot the migrated database, restore it to a separate path, then open
  // it again through Sellify's normal startup path.
  const backup = await upgradedStore.createDatabaseBackup();
  assertDatabaseIntegrity(backup.path, 'Workforce backup');
  await mkdir(restoreDir, { recursive: true });
  await copyFile(backup.path, restoredDb);
  assertDatabaseIntegrity(restoredDb, 'Workforce restored copy');

  process.env.SELLIFY_DATA_DIR = restoreDir;
  process.env.SELLIFY_DB_PATH = restoredDb;
  process.env.SELLIFY_BACKUP_DIR = path.join(restoreDir, 'backups');
  const restoredStore = await import(`../backend/lib/store-sqlite.js?workforce-restore-target=${crypto.randomUUID()}`);
  const restoredUser = await restoredStore.getOrCreateUserByTelegram('workforce-restore-user', 'Workforce Restore');
  assert.equal(restoredUser.id, user.id, 'restored canonical user identity must remain stable');
  assertWorkforceMigrations(restoredDb, 'restored database');
  assertDatabaseIntegrity(restoredDb, 'Workforce database after application startup');

  const restored = new DatabaseSync(restoredDb);
  try {
    const tenant = restored.prepare('SELECT organization_id, tenant_id FROM tenants WHERE chat_id = ?')
      .get('workforce-restore-tenant');
    assert.equal(tenant.organization_id, organizationId, 'canonical tenant organization must be preserved');
    assert.equal(tenant.tenant_id, tenantId, 'canonical tenant identity must be preserved');

    const product = restored.prepare('SELECT product_json, price_minor, stock FROM catalog_products WHERE chat_id = ? AND product_id = ?')
      .get('workforce-restore-tenant', ids.product);
    assert.ok(product, 'pre-existing canonical catalog record must survive restore');
    assert.equal(JSON.parse(product.product_json).name, 'Restore fixture product');
    assert.equal(product.price_minor, 12500);
    assert.equal(product.stock, 17);

    const member = restored.prepare('SELECT organization_id, tenant_id, chat_id, user_id, status FROM workforce_members WHERE id = ?')
      .get(ids.member);
    assert.ok(member, 'Workforce member must survive restore');
    assert.equal(member.organization_id, organizationId);
    assert.equal(member.tenant_id, tenantId);
    assert.equal(member.chat_id, 'workforce-restore-tenant');
    assert.equal(member.user_id, user.id);
    assert.equal(member.status, 'ACTIVE');

    assert.equal(restored.prepare('SELECT COUNT(*) AS count FROM workforce_profiles WHERE id = ? AND member_id = ?')
      .get(ids.profile, ids.member).count, 1, 'Workforce profile and member relation must survive');
    assert.equal(restored.prepare('SELECT COUNT(*) AS count FROM workforce_availability_windows WHERE id = ? AND member_id = ?')
      .get(ids.availability, ids.member).count, 1, 'Workforce availability and member relation must survive');
    assert.equal(restored.prepare('SELECT COUNT(*) AS count FROM workforce_shifts WHERE id = ? AND member_id = ?')
      .get(ids.shift, ids.member).count, 1, 'Workforce shift and member relation must survive');
  } finally {
    restored.close();
  }

  console.log('Workforce migration backup/restore regression passed: simulated pre-Workforce schema at version 85, real application upgrade through migrations 86-100, canonical tenant/user/catalog preservation, Workforce member/profile/availability/shift preservation, SQLite integrity, and foreign-key integrity.');
  console.log('Scope limit: this isolated regression does not replace a rehearsal against a production-derived sanitized database or certify production recovery timing.');
} finally {
  await rm(root, { recursive: true, force: true });
}
