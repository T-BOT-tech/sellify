import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');

function runChild(mode, databasePath) {
  const result = spawnSync(process.execPath, [scriptPath, mode], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SELLIFY_DATA_DIR: path.dirname(databasePath),
      SELLIFY_DB_PATH: databasePath,
      SELLIFY_BACKUP_DIR: path.join(path.dirname(databasePath), 'backups'),
    },
  });
  if (result.status !== 0) {
    throw new Error(`Migration child ${mode} failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

async function childMain(mode) {
  const { getDatabaseForTests } = await import('../backend/lib/store-sqlite.js');
  const db = getDatabaseForTests();

  if (mode === 'prepare-full' || mode === 'prepare-partial') {
    db.exec('PRAGMA foreign_keys = OFF');
    db.prepare(`
      INSERT INTO supplier_network_capacity_signals
        (id, organization_id, subject_type, subject_id, quantity, unit, period_type,
         availability, visibility, source, status, metadata_json, created_at, updated_at, version,
         observed_at, valid_until)
      VALUES ('legacy-capacity-1', 'legacy-org', 'PRODUCT', 'legacy-product', 42, 'kg',
        'ON_DEMAND', 'AVAILABLE', 'NETWORK', 'DECLARED', 'ACTIVE', '{}',
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 7, NULL, NULL)
    `).run();
    if (mode === 'prepare-full') db.exec('ALTER TABLE supplier_network_capacity_signals DROP COLUMN observed_at');
    db.exec('ALTER TABLE supplier_network_capacity_signals DROP COLUMN valid_until');
    db.prepare('DELETE FROM schema_migrations WHERE version = 84').run();
    return;
  }

  if (mode === 'verify-fresh') {
    const columns = new Set(db.prepare('PRAGMA table_info(supplier_network_capacity_signals)').all().map(row => row.name));
    assert.equal(columns.has('observed_at'), true);
    assert.equal(columns.has('valid_until'), true);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 84').get().count, 1);
    return;
  }

  if (mode === 'verify') {
    const columns = new Set(db.prepare('PRAGMA table_info(supplier_network_capacity_signals)').all().map(row => row.name));
    assert.equal(columns.has('observed_at'), true, 'migration restores observed_at');
    assert.equal(columns.has('valid_until'), true, 'migration restores valid_until');
    const row = db.prepare('SELECT * FROM supplier_network_capacity_signals WHERE id = ?').get('legacy-capacity-1');
    assert.ok(row, 'legacy capacity row survives migration');
    assert.equal(row.quantity, 42);
    assert.equal(row.version, 7);
    assert.equal(row.observed_at, null, 'migration does not fabricate an observation timestamp');
    assert.equal(row.valid_until, null, 'migration does not fabricate a validity timestamp');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 84').get().count, 1);
    return;
  }

  throw new Error(`Unknown migration test mode: ${mode}`);
}

if (process.argv[2]) {
  await childMain(process.argv[2]);
} else {
  const temp = mkdtempSync(path.join(tmpdir(), 'sellify-capacity-migration-'));
  try {
    runChild('verify-fresh', path.join(temp, 'fresh.sqlite'));
    for (const scenario of ['full', 'partial']) {
      const databasePath = path.join(temp, `${scenario}.sqlite`);
      runChild(`prepare-${scenario}`, databasePath);
      runChild('verify', databasePath);
      runChild('verify', databasePath);
    }
    console.log('Phase 21.17 Capacity Evidence Migration Regression: PASS');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}
