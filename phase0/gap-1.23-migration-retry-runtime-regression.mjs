import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const storePath = new URL('../backend/lib/store-sqlite.js', import.meta.url);
const store = fs.readFileSync(storePath, 'utf8');
const marker = store.indexOf('// GAP-1.23 — durable provider notification identity and authentication lineage.');
assert.notEqual(marker, -1, 'migration 63 source marker must exist');
const start = store.indexOf('  if (!applied.includes(63)) {', marker);
const end = store.indexOf('\n  // GAP-1.2 — link existing canonical payments', start);
assert.ok(start > marker && end > start, 'migration 63 block boundaries must be identifiable');
const migrationBlock = store.slice(start, end).trim();
assert.match(migrationBlock, /PRAGMA table_info\(payment_evidence\)/);

function runScenario(existingColumns) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-gap123-'));
  const dbPath = path.join(directory, 'migration-test.sqlite');
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
      CREATE TABLE payment_evidence (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        payment_account_id TEXT,
        evidence_payload TEXT NOT NULL
        ${existingColumns.includes('provider_notification_id') ? ', provider_notification_id TEXT' : ''}
        ${existingColumns.includes('authentication_reference') ? ', authentication_reference TEXT' : ''}
      );
      INSERT INTO payment_evidence (id, organization_id, provider_id, payment_account_id, evidence_payload)
      VALUES ('evidence-1', 'org-1', 'provider-1', 'account-1', 'preserve-me');
    `);
    const executeMigration = new Function('db', 'applied', 'nowIso', migrationBlock);
    executeMigration(db, [], () => '2026-10-09T00:00:00.000Z');

    const columns = db.prepare('PRAGMA table_info(payment_evidence)').all().map(row => row.name);
    assert.ok(columns.includes('provider_notification_id'), 'provider notification column must exist');
    assert.ok(columns.includes('authentication_reference'), 'authentication reference column must exist');
    assert.equal(db.prepare('SELECT evidence_payload FROM payment_evidence WHERE id = ?').get('evidence-1').evidence_payload, 'preserve-me', 'existing evidence must remain intact');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 63').get().count, 1, 'migration version must be recorded exactly once');
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='uq_payment_evidence_notification'").get(), 'notification uniqueness index must exist');
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_payment_evidence_auth_reference'").get(), 'authentication reference index must exist');
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

runScenario([]);
runScenario(['provider_notification_id']);
runScenario(['authentication_reference']);
runScenario(['provider_notification_id', 'authentication_reference']);
console.log('GAP-1.23 Migration Retry Runtime Regression: PASS');
console.log('Fresh schema, either partial-column state, both existing columns, indexes, version recording, and evidence preservation: PASS');
