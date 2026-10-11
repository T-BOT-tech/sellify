import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

// Migration 54 must be independently evaluated when migration 53 is already
// present in schema_migrations. Nesting 54 under the 53 conditional silently
// skips the unique verification index on partially upgraded databases.
const migration53 = source.match(
  /if \(!applied\.includes\(53\)\)\s*\{([\s\S]*?)run\(53, nowIso\(\)\);([\s\S]*?)\}/,
);
assert.ok(migration53, 'migration 53 has an explicit, closed migration block');

const migration54 = source.match(
  /if \(!applied\.includes\(54\)\)\s*\{([\s\S]*?)run\(54, nowIso\(\)\);\s*\}/,
);
assert.ok(migration54, 'migration 54 has its own independent migration block');
assert.match(
  migration54[1],
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_verifications_evidence_verifier\s+ON payment_verifications\(evidence_id, verifier, verifier_version\)/,
  'migration 54 installs the verification idempotency index',
);

// Guard the precise regression: the migration-53 block must close before the
// migration-54 conditional begins.
const start53 = source.indexOf('if (!applied.includes(53))');
const end53 = source.indexOf('run(53, nowIso());', start53);
const close53 = source.indexOf('\n  }', end53);
const start54 = source.indexOf('if (!applied.includes(54))', start53);
assert.ok(start53 >= 0 && end53 > start53 && close53 > end53 && start54 > close53,
  'migration 54 is not nested inside migration 53');

// Runtime upgrade simulation: a database can have migration 53 recorded while
// migration 54 was missed by an interrupted/older deployment. Start from that
// recorded state and let the real SQLite store migration runner complete.
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

const tempDir = await mkdtemp(join(tmpdir(), 'sellify-migration54-recovery-'));
const dbPath = join(tempDir, 'sellify.sqlite');
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = dbPath;
let inspectDb;
try {
  const seededDb = new DatabaseSync(dbPath);
  seededDb.exec(`CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
  INSERT INTO schema_migrations (version, applied_at)
  VALUES (53, '2026-10-01T00:00:00.000Z');`);
  seededDb.close();

  const store = await import('../backend/lib/store-sqlite.js?gap118i-runtime');
  await store.getOrCreateUserByTelegram('gap118i-migration-user', 'GAP-1.18I Migration Test');

  inspectDb = new DatabaseSync(dbPath);
  const migration54Row = inspectDb.prepare(
    'SELECT version FROM schema_migrations WHERE version = 54'
  ).get();
  assert.ok(migration54Row, 'real migration runner records migration 54 when 53 already exists');
  const index = inspectDb.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_payment_verifications_evidence_verifier'"
  ).get();
  assert.ok(index, 'real migration runner creates the provider-verification uniqueness index');
  const indexMetadata = inspectDb.prepare("PRAGMA index_list('payment_verifications')").all()
    .find(row => row.name === 'idx_payment_verifications_evidence_verifier');
  assert.equal(Number(indexMetadata?.unique), 1, 'the installed verification index is unique');
  console.log('GAP-1.18I runtime migration recovery passed (migration 53 present, 54 missing).');
} finally {
  if (inspectDb) inspectDb.close();
  await rm(tempDir, { recursive: true, force: true });
}

console.log('GAP-1.18I migration independence regression passed');
