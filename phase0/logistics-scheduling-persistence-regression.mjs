import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'sellify-l11-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'l11.sqlite');

try {
  const { getDatabaseForTests } = await import('../backend/lib/store-sqlite.js');
  const db = getDatabaseForTests();

  const migration = db.prepare(
    'SELECT version FROM schema_migrations WHERE version = 58'
  ).get();
  assert.equal(Number(migration?.version), 58);

  const columns = db.prepare(
    'PRAGMA table_info(logistics_scheduling_activities)'
  ).all();
  const names = new Set(columns.map(column => column.name));

  for (const required of [
    'id',
    'organization_id',
    'location_id',
    'activity_type',
    'mode',
    'status',
    'related_order_id',
    'related_fulfillment_id',
    'related_movement_id',
    'requested_start',
    'requested_end',
    'scheduled_start',
    'scheduled_end',
    'timezone',
    'recurrence_json',
    'confirmed_by_user_id',
    'confirmed_at',
    'created_by_user_id',
    'updated_by_user_id',
    'idempotency_key',
    'last_command_key',
    'created_at',
    'updated_at',
    'version',
  ]) {
    assert.equal(names.has(required), true, required);
  }

  const foreignKeys = db.prepare(
    'PRAGMA foreign_key_list(logistics_scheduling_activities)'
  ).all();
  const fkTables = new Set(foreignKeys.map(fk => fk.table));
  assert.equal(fkTables.has('organizations'), true);
  assert.equal(fkTables.has('locations'), true);
  assert.equal(fkTables.has('fulfillments'), true);
  assert.equal(fkTables.has('users'), true);

  const indexes = db.prepare(
    'PRAGMA index_list(logistics_scheduling_activities)'
  ).all();
  const indexNames = new Set(indexes.map(index => index.name));
  assert.equal(indexNames.has('idx_logistics_scheduling_org_status'), true);
  assert.equal(indexNames.has('idx_logistics_scheduling_org_location'), true);
  assert.equal(indexNames.has('idx_logistics_scheduling_order'), true);
  assert.equal(indexNames.has('idx_logistics_scheduling_fulfillment'), true);

  const sql = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='logistics_scheduling_activities'"
  ).get()?.sql || '';
  assert.match(sql, /UNIQUE\s*\(organization_id, idempotency_key\)/);
  assert.match(sql, /CHECK \(version > 0\)/);

  // Persistence contains coordination state only; no payment, inventory,
  // GPS, route, dispatch, provider-registry, or capacity-ledger columns.
  for (const forbidden of [
    'payment', 'inventory', 'gps', 'route_engine',
    'dispatch_engine', 'provider_registry', 'capacity_ledger',
  ]) {
    assert.equal(names.has(forbidden), false, forbidden);
  }

  console.log('L11.3 Logistics Scheduling Persistence Regression: PASS');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
