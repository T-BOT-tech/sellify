import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  runWorkforceSqliteMigrations,
  WORKFORCE_SQLITE_MIGRATION_VERSION,
} from '../backend/lib/workforce-sqlite-migrations.js';

const directory = mkdtempSync(path.join(os.tmpdir(), 'sellify-workforce-migration-'));
const db = new DatabaseSync(path.join(directory, 'workforce.sqlite'));

try {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE organizations (id TEXT PRIMARY KEY);
    CREATE TABLE tenants (chat_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL UNIQUE);
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE locations (id TEXT PRIMARY KEY);
    CREATE TABLE service_resources (id TEXT PRIMARY KEY);
    CREATE TABLE service_bookings (id TEXT PRIMARY KEY);
    INSERT INTO organizations(id) VALUES ('org-a');
    INSERT INTO tenants(chat_id, tenant_id) VALUES ('chat-a', 'tenant-a'), ('chat-b', 'tenant-b');
    INSERT INTO users(id) VALUES ('user-a');
  `);

  const first = runWorkforceSqliteMigrations(db);
  assert.deepEqual(first, { applied: true, version: WORKFORCE_SQLITE_MIGRATION_VERSION });
  const second = runWorkforceSqliteMigrations(db);
  assert.deepEqual(second, { applied: false, version: WORKFORCE_SQLITE_MIGRATION_VERSION });

  const expectedTables = [
    'workforce_members',
    'workforce_profiles',
    'workforce_engagements',
    'workforce_calendars',
    'workforce_calendar_exceptions',
    'workforce_availability_windows',
    'workforce_assignments',
    'workforce_shifts',
    'workforce_allocations',
    'workforce_utilization_events',
  ];
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
  for (const table of expectedTables) assert.ok(tables.has(table), `missing table: ${table}`);

  const memberIndexes = db.prepare('PRAGMA index_list(workforce_members)').all().map(row => row.name);
  assert.ok(memberIndexes.includes('idx_workforce_members_org_status'));
  const assignmentIndexes = db.prepare('PRAGMA index_list(workforce_assignments)').all().map(row => row.name);
  assert.ok(assignmentIndexes.includes('idx_workforce_assignments_resource'));
  assert.ok(assignmentIndexes.includes('idx_workforce_assignments_booking'));

  db.prepare(`
    INSERT INTO workforce_members
      (id, organization_id, tenant_id, chat_id, user_id, member_type, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('member-a', 'org-a', 'tenant-a', 'chat-a', 'user-a', 'EMPLOYEE', 'ACTIVE', '2026-01-01', '2026-01-01');

  assert.throws(() => db.prepare(`
    INSERT INTO workforce_profiles
      (id, organization_id, tenant_id, chat_id, member_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('profile-cross-scope', 'org-a', 'tenant-b', 'chat-b', 'member-a', '2026-01-01', '2026-01-01'));

  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_SQLITE_MIGRATION_VERSION).count, 1);

  console.log('PASS Workforce SQLite migration 86: additive tables, indexes, idempotent guard, and scoped member foreign keys');
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
