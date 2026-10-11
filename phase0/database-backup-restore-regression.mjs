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
  await sourceStore.getOrCreateTenant('restore-regression-tenant');

  // Seed representative financial history and an unresolved provider-in-flight
  // command. The backup must preserve these exact rows, not just the schema.
  const sourceDbHandle = new DatabaseSync(sourceDb);
  const paymentId = crypto.randomUUID();
  const ledgerEntryId = crypto.randomUUID();
  const statusCommandId = crypto.randomUUID();
  const statusClaimToken = crypto.randomUUID();
  const statusIdempotencyKey = 'restore-inflight-' + crypto.randomUUID();
  const timestamp = new Date().toISOString();
  try {
    const organization = sourceDbHandle.prepare(
      'SELECT id FROM organizations WHERE id IN (SELECT organization_id FROM tenants WHERE organization_id IS NOT NULL) ORDER BY created_at LIMIT 1'
    ).get();
    assert.ok(organization?.id, 'fixture must have a tenant organization');
    sourceDbHandle.prepare(
      'INSERT INTO payments (id, organization_id, provider_id, channel, amount_minor, currency, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(paymentId, organization.id, 'restore-test-provider', 'api', 12500, 'ETB', 'UNPAID', timestamp, timestamp);
    sourceDbHandle.prepare(
      'INSERT INTO payment_ledger_entries (id, payment_id, organization_id, entry_type, amount_minor, currency, from_state, to_state, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(ledgerEntryId, paymentId, organization.id, 'CREATED', 12500, 'ETB', null, 'UNPAID', 'backup restore regression fixture', timestamp);
    sourceDbHandle.prepare(
      'INSERT INTO payment_status_query_commands (id, organization_id, payment_id, idempotency_key, request_hash, status, response_json, error_json, created_at, updated_at, claim_generation, claim_token, phase, lease_expires_at) VALUES (?, ?, ?, ?, ?, \'IN_PROGRESS\', NULL, NULL, ?, ?, 1, ?, \'PROVIDER_IN_FLIGHT\', NULL)'
    ).run(statusCommandId, organization.id, paymentId, statusIdempotencyKey, 'restore-fixture-request-hash', timestamp, timestamp, statusClaimToken);
  } finally {
    sourceDbHandle.close();
  }

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
    assert.equal(check.prepare('SELECT COUNT(*) AS count FROM payments WHERE id = ?').get(paymentId).count, 1,
      'restored database must preserve the canonical payment');
    assert.equal(check.prepare('SELECT COUNT(*) AS count FROM payment_ledger_entries WHERE id = ? AND payment_id = ?').get(ledgerEntryId, paymentId).count, 1,
      'restored database must preserve the linked financial ledger entry');
    const restoredCommand = check.prepare(
      'SELECT status, phase, claim_generation, claim_token, idempotency_key FROM payment_status_query_commands WHERE id = ? AND payment_id = ?'
    ).get(statusCommandId, paymentId);
    assert.ok(restoredCommand, 'restored database must preserve the status-query command');
    assert.equal(restoredCommand.status, 'IN_PROGRESS', 'uncertain provider command must remain unresolved after restore');
    assert.equal(restoredCommand.phase, 'PROVIDER_IN_FLIGHT', 'restore must not turn provider-in-flight work into reclaimable work');
    assert.equal(restoredCommand.claim_generation, 1, 'restore must preserve claim generation');
    assert.equal(restoredCommand.claim_token, statusClaimToken, 'restore must preserve claim ownership token');
    assert.equal(restoredCommand.idempotency_key, statusIdempotencyKey, 'restore must preserve idempotency identity');
  } finally {
    check.close();
  }

  console.log('Database backup/restore regression passed: backup and restored SQLite integrity, persisted identity, and migration 67 verified.');
  console.log('Scope limit: this isolated regression does not certify restoration of a production database or specific payment-lineage rows.');
} finally {
  await rm(root, { recursive: true, force: true });
}
