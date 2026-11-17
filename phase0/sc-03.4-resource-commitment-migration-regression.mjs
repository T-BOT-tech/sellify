import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempDir = await mkdtemp(path.join(os.tmpdir(), 'sellify-sc034-migration-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

try {
  const store = await import('../backend/lib/store-sqlite.js');
  const db = store.getDatabaseForTests();

  const migration = db.prepare('SELECT version FROM schema_migrations WHERE version = 80').get();
  assert.ok(migration, 'SC-03.4 migration 80 must be recorded exactly once');

  const bookingColumns = new Set(
    db.prepare('PRAGMA table_info(service_bookings)').all().map(row => String(row.name))
  );
  assert.ok(bookingColumns.has('service_resource_id'),
    'service_bookings must expose the optional resource binding without replacing existing booking fields');

  const commitmentTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='service_resource_commitments'"
  ).get();
  assert.ok(commitmentTable, 'canonical resource commitment table must exist');

  const commitmentColumns = new Set(
    db.prepare('PRAGMA table_info(service_resource_commitments)').all().map(row => String(row.name))
  );
  for (const column of [
    'id', 'organization_id', 'chat_id', 'resource_id', 'booking_id',
    'starts_at', 'ends_at', 'state', 'committed_by', 'committed_at',
    'released_by', 'released_at',
  ]) {
    assert.ok(commitmentColumns.has(column), `commitment schema must include ${column}`);
  }

  const stateColumn = db.prepare('PRAGMA table_info(service_resource_commitments)')
    .all().find(row => row.name === 'state');
  assert.equal(stateColumn?.notnull, 1, 'commitment state must be required');

  const indexes = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='service_resource_commitments'"
  ).all().map(row => row.name);
  assert.ok(indexes.includes('idx_service_resource_commitments_overlap'),
    'overlap lookup index must be installed');

  const foreignKeys = db.prepare('PRAGMA foreign_key_list(service_resource_commitments)').all();
  assert.ok(foreignKeys.some(row => row.table === 'service_bookings' && row.from === 'booking_id'),
    'each commitment must reference its canonical service booking');
  assert.ok(foreignKeys.some(row => row.table === 'service_resources' && row.from === 'resource_id'),
    'each commitment must reference the canonical service resource');

  const duplicateBookingUnique = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='service_resource_commitments'"
  ).get()?.sql || '';
  assert.match(duplicateBookingUnique, /booking_id\s+TEXT\s+NOT NULL\s+UNIQUE/i,
    'a booking may have at most one commitment record');

  const stateCheck = /state\s+TEXT\s+NOT NULL\s+CHECK\s*\(state\s+IN\s*\('COMMITTED','RELEASED'\)\)/i;
  assert.match(duplicateBookingUnique, stateCheck,
    'commitment lifecycle must use the canonical COMMITTED/RELEASED vocabulary');

  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 80').get().count,
    1,
    'migration 80 must not be recorded more than once',
  );

  console.log('SC-03.4 resource commitment migration regression passed');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
