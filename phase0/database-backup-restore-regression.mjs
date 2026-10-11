import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = await mkdtemp(path.join(os.tmpdir(), 'sellify-backup-restore-'));
const sourceDir = path.join(root, 'source');
const backupDir = path.join(root, 'backups');
const restoreDir = path.join(root, 'restore');
const sourceDb = path.join(sourceDir, 'sellify.sqlite');
const restoredDb = path.join(restoreDir, 'sellify.sqlite');

process.env.SELLIFY_DATA_DIR = sourceDir;
process.env.SELLIFY_DB_PATH = sourceDb;
process.env.SELLIFY_BACKUP_DIR = backupDir;
process.env.SELLIFY_BACKUP_RETENTION = '7';

function assertIntegrity(databasePath, label) {
  const db = new DatabaseSync(databasePath);
  try {
    const rows = db.prepare('PRAGMA integrity_check').all();
    assert.equal(rows.length, 1, label + ' must return one integrity result');
    assert.equal(rows[0].integrity_check, 'ok', label + ' SQLite integrity check');
  } finally {
    db.close();
  }
}

try {
  const sourceStore = await import(`../backend/lib/store-sqlite.js?restore-source=${crypto.randomUUID()}`);
  const original = await sourceStore.getOrCreateUserByTelegram('restore-regression-user', 'Restore Regression');
  const backup = await sourceStore.createDatabaseBackup();

  assertIntegrity(backup.path, 'backup');
  await mkdir(restoreDir, { recursive: true });
  await copyFile(backup.path, restoredDb);
  assertIntegrity(restoredDb, 'restored copy');

  // Start a fresh store module against the restored database. Its normal
  // initialization/migration path must open the snapshot without data loss.
  process.env.SELLIFY_DATA_DIR = restoreDir;
  process.env.SELLIFY_DB_PATH = restoredDb;
  process.env.SELLIFY_BACKUP_DIR = path.join(restoreDir, 'backups');
  const restoredStore = await import(`../backend/lib/store-sqlite.js?restore-target=${crypto.randomUUID()}`);
  const restored = await restoredStore.getOrCreateUserByTelegram('restore-regression-user', 'Restore Regression');

  assert.equal(restored.id, original.id, 'restored database must preserve the seeded user identity');
  assertIntegrity(restoredDb, 'database after application startup');
  const check = new DatabaseSync(restoredDb);
  try {
    const latestMigration = check.prepare('SELECT MAX(version) AS version FROM schema_migrations').get();
    assert.equal(Number(latestMigration.version), 67, 'restored database must retain current schema migration state');
    assert.ok(check.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'payment_status_query_commands'").get(),
      'restored database must retain the payment status-query command table');
  } finally {
    check.close();
  }

  console.log('Database backup/restore regression passed: backup and restored SQLite integrity, persisted identity, and migration 67 verified.');
  console.log('Scope limit: this isolated regression does not certify restoration of a production database or specific payment-lineage rows.');
} finally {
  await rm(root, { recursive: true, force: true });
}
