import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  runWorkforceSqliteMigrations,
  WORKFORCE_SQLITE_MIGRATION_VERSION,
  runWorkforceServiceBookingMigration,
  WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION,
  runWorkforceExternalMemberMigration,
  WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION,
  runWorkforceEmployeeNumberMigration,
  WORKFORCE_EMPLOYEE_NUMBER_MIGRATION_VERSION,
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
    CREATE TABLE service_bookings (id TEXT PRIMARY KEY, organization_id TEXT, chat_id TEXT, status TEXT);
    INSERT INTO organizations(id) VALUES ('org-a'), ('org-b');
    INSERT INTO tenants(chat_id, tenant_id) VALUES ('chat-a', 'tenant-a'), ('chat-b', 'tenant-b');
    INSERT INTO users(id) VALUES ('user-a'), ('user-b');
  `);

  const first = runWorkforceSqliteMigrations(db);
  assert.deepEqual(first, { applied: true, version: WORKFORCE_SQLITE_MIGRATION_VERSION });
  const second = runWorkforceSqliteMigrations(db);
  const bookingMigration = runWorkforceServiceBookingMigration(db);
  const bookingMigrationReplay = runWorkforceServiceBookingMigration(db);
  assert.deepEqual(second, { applied: false, version: WORKFORCE_SQLITE_MIGRATION_VERSION });
  assert.deepEqual(bookingMigration, { applied: true, version: WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION });
  assert.deepEqual(bookingMigrationReplay, { applied: false, version: WORKFORCE_SERVICE_BOOKING_MIGRATION_VERSION });
  assert.ok(db.prepare('PRAGMA table_info(service_bookings)').all().some(column => column.name === 'workforce_member_id'));
  assert.ok(db.prepare('PRAGMA index_list(service_bookings)').all().some(index => index.name === 'idx_service_bookings_workforce_member'));

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

  db.prepare(`
    INSERT INTO workforce_members
      (id, organization_id, tenant_id, chat_id, user_id, member_type, status, created_at, updated_at)
    VALUES ('member-b', 'org-b', 'tenant-b', 'chat-b', 'user-b', 'EMPLOYEE', 'ACTIVE', '2026-01-01', '2026-01-01')
  `).run();

  assert.throws(() => db.prepare(`
    INSERT INTO workforce_profiles
      (id, organization_id, tenant_id, chat_id, member_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run('profile-cross-scope', 'org-a', 'tenant-b', 'chat-b', 'member-a', '2026-01-01', '2026-01-01'));

  db.prepare(`
    INSERT INTO workforce_profiles
      (id, organization_id, tenant_id, chat_id, member_id, created_at, updated_at)
    VALUES ('profile-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_engagements
      (id, organization_id, tenant_id, chat_id, member_id, engagement_type, created_at, updated_at)
    VALUES ('engagement-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', 'EMPLOYMENT', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_calendars
      (id, organization_id, tenant_id, chat_id, member_id, timezone, created_at, updated_at)
    VALUES ('calendar-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', 'Africa/Addis_Ababa', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_calendar_exceptions
      (id, organization_id, tenant_id, chat_id, calendar_id, exception_type, starts_at, created_at, updated_at)
    VALUES ('exception-a', 'org-a', 'tenant-a', 'chat-a', 'calendar-a', 'LEAVE', '2026-02-01', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_availability_windows
      (id, organization_id, tenant_id, chat_id, member_id, availability, timezone, created_at, updated_at)
    VALUES ('availability-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', 'AVAILABLE', 'Africa/Addis_Ababa', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_assignments
      (id, organization_id, tenant_id, chat_id, member_id, assignment_type, created_at, updated_at)
    VALUES ('assignment-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', 'RESOURCE', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_shifts
      (id, organization_id, tenant_id, chat_id, member_id, starts_at, ends_at, timezone, created_at, updated_at)
    VALUES ('shift-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', '2026-02-01T06:00:00Z', '2026-02-01T14:00:00Z', 'Africa/Addis_Ababa', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_allocations
      (id, organization_id, tenant_id, chat_id, member_id, created_at, updated_at)
    VALUES ('allocation-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_utilization_events
      (id, organization_id, tenant_id, chat_id, member_id, created_at, updated_at)
    VALUES ('utilization-a', 'org-a', 'tenant-a', 'chat-a', 'member-a', '2026-01-01', '2026-01-01')
  `).run();
  db.prepare('INSERT INTO service_bookings (id, workforce_member_id) VALUES (?, ?)')
    .run('booking-workforce-a', 'member-a');

  db.exec('PRAGMA foreign_keys = OFF');
  db.prepare(`
    INSERT INTO workforce_profiles
      (id, organization_id, tenant_id, chat_id, member_id, created_at, updated_at)
    VALUES ('profile-invalid-member', 'org-a', 'tenant-a', 'chat-a', 'missing-member', '2026-01-01', '2026-01-01')
  `).run();
  db.exec('PRAGMA foreign_keys = ON');
  assert.throws(() => runWorkforceExternalMemberMigration(db),
    error => error.code === 'WORKFORCE_MEMBER_MIGRATION_FOREIGN_KEY_CHECK_FAILED');
  const preRollbackUserColumn = db.prepare('PRAGMA table_info(workforce_members)').all()
    .find(column => column.name === 'user_id');
  assert.equal(preRollbackUserColumn.notnull, 1, 'failed migration must roll back the table rebuild');
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION).count, 0, 'failed migration must not record its version');
  assert.equal(db.prepare('SELECT user_id FROM workforce_members WHERE id = ?').get('member-a').user_id, 'user-a');
  db.prepare('DELETE FROM workforce_profiles WHERE id = ?').run('profile-invalid-member');

  const externalMigration = runWorkforceExternalMemberMigration(db);
  const externalMigrationReplay = runWorkforceExternalMemberMigration(db);
  assert.deepEqual(externalMigration, { applied: true, version: WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION });
  assert.deepEqual(externalMigrationReplay, { applied: false, version: WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION });
  const userColumn = db.prepare('PRAGMA table_info(workforce_members)').all()
    .find(column => column.name === 'user_id');
  assert.equal(userColumn.notnull, 0, 'user_id must be nullable after migration 88');
  assert.equal(db.prepare('SELECT user_id FROM workforce_members WHERE id = ?').get('member-a').user_id, 'user-a');
  assert.equal(db.prepare('SELECT user_id FROM workforce_members WHERE id = ?').get('member-b').user_id, 'user-b');
  assert.equal(db.prepare('SELECT workforce_member_id FROM service_bookings WHERE id = ?').get('booking-workforce-a').workforce_member_id, 'member-a');
  for (const table of expectedTables.slice(1)) {
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ' + table).get().count, 1, table + ' child row must survive member table rebuild');
  }
  db.prepare(`
    INSERT INTO workforce_members
      (id, organization_id, tenant_id, chat_id, member_type, status, created_at, updated_at)
    VALUES ('member-external', 'org-a', 'tenant-a', 'chat-a', 'CONTRACTOR', 'DRAFT', '2026-01-02', '2026-01-02')
  `).run();
  assert.equal(db.prepare('SELECT user_id FROM workforce_members WHERE id = ?').get('member-external').user_id, null);
  const employeeNumberMigration = runWorkforceEmployeeNumberMigration(db);
  const employeeNumberReplay = runWorkforceEmployeeNumberMigration(db);
  assert.deepEqual(employeeNumberMigration, { applied: true, version: WORKFORCE_EMPLOYEE_NUMBER_MIGRATION_VERSION });
  assert.deepEqual(employeeNumberReplay, { applied: false, version: WORKFORCE_EMPLOYEE_NUMBER_MIGRATION_VERSION });
  assert.ok(db.prepare('PRAGMA table_info(workforce_members)').all().some(column => column.name === 'employee_number'));
  db.prepare('UPDATE workforce_members SET employee_number = ? WHERE id = ?').run('EMP-001', 'member-a');
  db.prepare('UPDATE workforce_members SET employee_number = ? WHERE id = ?').run('EMP-001', 'member-b');
  assert.throws(() => db.prepare('UPDATE workforce_members SET employee_number = ? WHERE id = ?').run('emp-001', 'member-external'));
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  const preservedMemberIndexes = new Set(db.prepare('PRAGMA index_list(workforce_members)').all().map(index => index.name));
  for (const name of ['idx_workforce_members_org_status','idx_workforce_members_tenant_status','idx_workforce_members_user','idx_workforce_members_location']) {
    assert.ok(preservedMemberIndexes.has(name), 'migration must preserve ' + name);
  }

  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_SQLITE_MIGRATION_VERSION).count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_EXTERNAL_MEMBER_MIGRATION_VERSION).count, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?')
    .get(WORKFORCE_EMPLOYEE_NUMBER_MIGRATION_VERSION).count, 1);

  console.log('PASS Workforce SQLite migrations 86-89: external professionals, employee numbers, all dependent records, Service Booking references, rollback, idempotency, and foreign-key integrity');
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
