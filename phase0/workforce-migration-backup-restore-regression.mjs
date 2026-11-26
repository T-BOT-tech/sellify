import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = await mkdtemp(path.join(os.tmpdir(), 'sellify-workforce-restore-'));
const sourceDir = path.join(root, 'source');
const backupDir = path.join(root, 'backups');
const restoreDir = path.join(root, 'restore');
const sourceDb = path.join(sourceDir, 'sellify.sqlite');
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

try {
  const sourceStore = await import(`../backend/lib/store-sqlite.js?workforce-restore-source=${crypto.randomUUID()}`);
  const user = await sourceStore.getOrCreateUserByTelegram('workforce-restore-user', 'Workforce Restore');
  await sourceStore.getOrCreateTenant('workforce-restore-tenant');

  const source = new DatabaseSync(sourceDb);
  const timestamp = new Date().toISOString();
  const ids = {
    product: 'workforce-restore-product',
    member: 'workforce-restore-member',
    profile: 'workforce-restore-profile',
    availability: 'workforce-restore-availability',
    shift: 'workforce-restore-shift',
  };
  let organizationId;
  let tenantId;
  try {
    const tenant = source.prepare(
      'SELECT chat_id, tenant_id, organization_id FROM tenants WHERE chat_id = ?'
    ).get('workforce-restore-tenant');
    assert.ok(tenant?.organization_id, 'existing Sellify tenant must have a canonical organization');
    organizationId = tenant.organization_id;
    tenantId = tenant.tenant_id;

    // Preserve a representative pre-existing canonical catalog record across
    // the Workforce schema and backup/restore boundary.
    source.prepare(`
      INSERT INTO catalog_products
        (chat_id, product_id, product_json, price_minor, stock, marketplace_listed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenant.chat_id, ids.product,
      JSON.stringify({ id: ids.product, name: 'Restore fixture product', item_type: 'product' }),
      12500, 17, 0, timestamp,
    );

    source.prepare(`
      INSERT INTO workforce_members
        (id, organization_id, tenant_id, chat_id, user_id, member_type, status, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'EMPLOYEE', 'ACTIVE', ?, ?, ?)
    `).run(ids.member, organizationId, tenantId, tenant.chat_id, user.id, 'Restore fixture member', timestamp, timestamp);

    source.prepare(`
      INSERT INTO workforce_profiles
        (id, organization_id, tenant_id, chat_id, member_id, skills_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(ids.profile, organizationId, tenantId, tenant.chat_id, ids.member,
      JSON.stringify(['inventory-counting']), timestamp, timestamp);

    source.prepare(`
      INSERT INTO workforce_availability_windows
        (id, organization_id, tenant_id, chat_id, member_id, availability, starts_at, ends_at, timezone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?, ?, 'Africa/Addis_Ababa', ?, ?)
    `).run(ids.availability, organizationId, tenantId, tenant.chat_id, ids.member,
      '2026-12-01T05:00:00.000Z', '2026-12-01T13:00:00.000Z', timestamp, timestamp);

    source.prepare(`
      INSERT INTO workforce_shifts
        (id, organization_id, tenant_id, chat_id, member_id, starts_at, ends_at, timezone, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Africa/Addis_Ababa', 'CONFIRMED', ?, ?)
    `).run(ids.shift, organizationId, tenantId, tenant.chat_id, ids.member,
      '2026-12-01T05:00:00.000Z', '2026-12-01T13:00:00.000Z', timestamp, timestamp);

    assert.equal(source.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version BETWEEN 86 AND 100').get().count, 15,
      'the application startup path must have applied all Workforce migrations 86-100');
    assert.deepEqual(source.prepare('PRAGMA foreign_key_check').all(), [],
      'seeded pre-backup database must satisfy foreign keys');
  } finally {
    source.close();
  }

  const backup = await sourceStore.createDatabaseBackup();
  assertDatabaseIntegrity(backup.path, 'Workforce backup');

  await mkdir(restoreDir, { recursive: true });
  await copyFile(backup.path, restoredDb);
  assertDatabaseIntegrity(restoredDb, 'Workforce restored copy');

  // Re-open through the normal Sellify application initialization path, not a
  // test-only migration shortcut.
  process.env.SELLIFY_DATA_DIR = restoreDir;
  process.env.SELLIFY_DB_PATH = restoredDb;
  process.env.SELLIFY_BACKUP_DIR = path.join(restoreDir, 'backups');
  const restoredStore = await import(`../backend/lib/store-sqlite.js?workforce-restore-target=${crypto.randomUUID()}`);
  const restoredUser = await restoredStore.getOrCreateUserByTelegram('workforce-restore-user', 'Workforce Restore');
  assert.equal(restoredUser.id, user.id, 'restored canonical user identity must remain stable');
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

    const versions = restored.prepare('SELECT version FROM schema_migrations WHERE version BETWEEN 86 AND 100 ORDER BY version')
      .all().map(row => Number(row.version));
    assert.deepEqual(versions, Array.from({ length: 15 }, (_, index) => index + 86),
      'all Workforce migration markers 86-100 must remain present and ordered');
  } finally {
    restored.close();
  }

  console.log('Workforce migration backup/restore regression passed: application startup, canonical tenant/user/catalog preservation, Workforce member/profile/availability/shift preservation, migrations 86-100, SQLite integrity, and foreign-key integrity.');
  console.log('Scope limit: this isolated regression does not replace a rehearsal against a production-derived sanitized database or certify production recovery timing.');
} finally {
  await rm(root, { recursive: true, force: true });
}
