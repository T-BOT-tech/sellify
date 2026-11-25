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
  runWorkforceOrganizationStructureMigration,
  WORKFORCE_ORGANIZATION_STRUCTURE_MIGRATION_VERSION,
  runWorkforceShiftTemplateMigration,
  WORKFORCE_SHIFT_TEMPLATE_MIGRATION_VERSION,
  runWorkforceShiftTemplateReferenceGuardMigration,
  WORKFORCE_SHIFT_TEMPLATE_REFERENCE_GUARD_MIGRATION_VERSION,
  runWorkforceShiftInstanceProvenanceMigration,
  WORKFORCE_SHIFT_INSTANCE_PROVENANCE_MIGRATION_VERSION,
  runWorkforceLeaveAbsenceMigration,
  WORKFORCE_LEAVE_ABSENCE_MIGRATION_VERSION,
  WORKFORCE_MEMBER_ORG_REFERENCES_MIGRATION_VERSION,
  WORKFORCE_DEPARTMENT_MIGRATION_VERSION,
  WORKFORCE_POSITION_MIGRATION_VERSION,
  WORKFORCE_REPORTING_RELATIONSHIP_MIGRATION_VERSION,
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
    CREATE TABLE locations (id TEXT PRIMARY KEY, organization_id TEXT);
    CREATE TABLE service_resources (id TEXT PRIMARY KEY);
    CREATE TABLE service_bookings (id TEXT PRIMARY KEY, organization_id TEXT, chat_id TEXT, status TEXT);
    INSERT INTO organizations(id) VALUES ('org-a'), ('org-b');
    INSERT INTO tenants(chat_id, tenant_id) VALUES ('chat-a', 'tenant-a'), ('chat-b', 'tenant-b');
    INSERT INTO users(id) VALUES ('user-a'), ('user-b');
    INSERT INTO locations(id, organization_id) VALUES ('location-a','org-a'), ('location-b','org-b');
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
  const structureMigration = runWorkforceOrganizationStructureMigration(db);
  const structureReplay = runWorkforceOrganizationStructureMigration(db);
  assert.deepEqual(structureMigration, { applied: true, version: WORKFORCE_ORGANIZATION_STRUCTURE_MIGRATION_VERSION });
  assert.deepEqual(structureReplay, { applied: false, version: WORKFORCE_ORGANIZATION_STRUCTURE_MIGRATION_VERSION });
  for (const field of ['department_id','position_id','supervisor_member_id']) {
    assert.ok(db.prepare('PRAGMA table_info(workforce_members)').all().some(column => column.name === field));
  }
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workforce_departments'").get());
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workforce_positions'").get());
  const shiftTemplateMigration = runWorkforceShiftTemplateMigration(db);
  const shiftTemplateReplay = runWorkforceShiftTemplateMigration(db);
  assert.deepEqual(shiftTemplateMigration, { applied: true, version: WORKFORCE_SHIFT_TEMPLATE_MIGRATION_VERSION });
  assert.deepEqual(shiftTemplateReplay, { applied: false, version: WORKFORCE_SHIFT_TEMPLATE_MIGRATION_VERSION });
  const templateGuardMigration = runWorkforceShiftTemplateReferenceGuardMigration(db);
  const templateGuardReplay = runWorkforceShiftTemplateReferenceGuardMigration(db);
  assert.deepEqual(templateGuardMigration, { applied: true, version: WORKFORCE_SHIFT_TEMPLATE_REFERENCE_GUARD_MIGRATION_VERSION });
  assert.deepEqual(templateGuardReplay, { applied: false, version: WORKFORCE_SHIFT_TEMPLATE_REFERENCE_GUARD_MIGRATION_VERSION });
  const shiftProvenanceMigration = runWorkforceShiftInstanceProvenanceMigration(db);
  const shiftProvenanceReplay = runWorkforceShiftInstanceProvenanceMigration(db);
  assert.deepEqual(shiftProvenanceMigration, { applied: true, version: WORKFORCE_SHIFT_INSTANCE_PROVENANCE_MIGRATION_VERSION });
  assert.deepEqual(shiftProvenanceReplay, { applied: false, version: WORKFORCE_SHIFT_INSTANCE_PROVENANCE_MIGRATION_VERSION });
  const leaveAbsenceMigration = runWorkforceLeaveAbsenceMigration(db);
  const leaveAbsenceReplay = runWorkforceLeaveAbsenceMigration(db);
  assert.deepEqual(leaveAbsenceMigration, { applied: true, version: WORKFORCE_LEAVE_ABSENCE_MIGRATION_VERSION });
  assert.deepEqual(leaveAbsenceReplay, { applied: false, version: WORKFORCE_LEAVE_ABSENCE_MIGRATION_VERSION });
  for (const table of ['workforce_leave_requests','workforce_absences']) {
    assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table), 'missing table: ' + table);
  }
  assert.ok(db.prepare('PRAGMA index_list(workforce_leave_requests)').all().some(index => index.name === 'idx_workforce_leave_approval_inbox'));
  assert.ok(db.prepare('PRAGMA index_list(workforce_absences)').all().some(index => index.name === 'idx_workforce_absences_member_status_start'));
  db.prepare(`INSERT INTO workforce_leave_requests
    (id,organization_id,tenant_id,chat_id,member_id,leave_category,starts_at,ends_at,timezone,reason,requested_by,idempotency_key,request_hash,created_at,updated_at)
    VALUES ('leave-a','org-a','tenant-a','chat-a','member-a','ANNUAL','2026-04-01T00:00:00.000Z','2026-04-03T00:00:00.000Z','Africa/Addis_Ababa','Annual leave','user-a','leave-key-a','hash-a','2026-01-01','2026-01-01')`).run();
  db.prepare(`INSERT INTO workforce_absences
    (id,organization_id,tenant_id,chat_id,member_id,absence_type,starts_at,ends_at,timezone,reason,recorded_by,idempotency_key,request_hash,created_at,updated_at)
    VALUES ('absence-a','org-a','tenant-a','chat-a','member-a','SICKNESS','2026-04-04T00:00:00.000Z','2026-04-04T08:00:00.000Z','Africa/Addis_Ababa','Unplanned sickness','user-a','absence-key-a','hash-absence-a','2026-01-01','2026-01-01')`).run();
  assert.throws(() => db.prepare(`INSERT INTO workforce_leave_requests
    (id,organization_id,tenant_id,chat_id,member_id,leave_category,starts_at,ends_at,timezone,reason,requested_by,idempotency_key,request_hash,created_at,updated_at)
    VALUES ('leave-cross','org-b','tenant-b','chat-b','member-a','ANNUAL','2026-04-01T00:00:00.000Z','2026-04-03T00:00:00.000Z','Africa/Addis_Ababa','Cross scope','user-b','leave-key-cross','hash-cross','2026-01-01','2026-01-01')`).run());
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  for (const field of ['shift_template_id','template_version','generated_local_date']) {
    assert.ok(db.prepare('PRAGMA table_info(workforce_shifts)').all().some(column => column.name === field));
  }
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workforce_shift_templates'").get());
  db.prepare("INSERT INTO workforce_departments (id,organization_id,tenant_id,chat_id,code,name,created_at,updated_at) VALUES ('dept-a','org-a','tenant-a','chat-a','OPS','Operations','2026-01-01','2026-01-01')").run();
  db.prepare("INSERT INTO workforce_positions (id,organization_id,tenant_id,chat_id,code,name,department_id,created_at,updated_at) VALUES ('position-a','org-a','tenant-a','chat-a','LEAD','Team Lead','dept-a','2026-01-01','2026-01-01')").run();
  db.prepare('UPDATE workforce_members SET department_id = ?, position_id = ? WHERE id = ?').run('dept-a','position-a','member-a');
  assert.throws(() => db.prepare("INSERT INTO workforce_positions (id,organization_id,tenant_id,chat_id,code,name,department_id,created_at,updated_at) VALUES ('position-cross','org-b','tenant-b','chat-b','CROSS','Cross Scope','dept-a','2026-01-01','2026-01-01')").run());
  assert.throws(() => db.prepare('UPDATE workforce_members SET department_id = ? WHERE id = ?').run('dept-a','member-b'));
  assert.throws(() => db.prepare('UPDATE workforce_members SET supervisor_member_id = id WHERE id = ?').run('member-a'));
  db.prepare("UPDATE workforce_members SET status='ACTIVE' WHERE id = 'member-external'").run();
  db.prepare('UPDATE workforce_members SET supervisor_member_id = ? WHERE id = ?').run('member-external','member-a');
  assert.throws(() => db.prepare('UPDATE workforce_members SET supervisor_member_id = ? WHERE id = ?').run('member-a','member-external'));
  db.prepare('UPDATE workforce_members SET supervisor_member_id = NULL WHERE id = ?').run('member-a');
  db.prepare(`
    INSERT INTO workforce_shift_templates
      (id,organization_id,tenant_id,chat_id,name,start_local_time,end_local_time,timezone,
       break_rules_json,work_days_json,department_id,position_id,location_id,effective_from,created_at,updated_at)
    VALUES ('template-a','org-a','tenant-a','chat-a','Morning Shift','08:00','16:30','Africa/Addis_Ababa',
      '[{"start_local_time":"12:00","end_local_time":"12:30"}]','[1,2,3,4,5]','dept-a','position-a','location-a','2026-01-01','2026-01-01','2026-01-01')
  `).run();
  assert.equal(db.prepare('SELECT name FROM workforce_shift_templates WHERE id=?').get('template-a').name, 'Morning Shift');
  db.prepare(`
    INSERT INTO workforce_shifts
      (id,organization_id,tenant_id,chat_id,member_id,starts_at,ends_at,timezone,shift_template_id,template_version,generated_local_date,created_at,updated_at)
    VALUES ('generated-shift-a','org-a','tenant-a','chat-a','member-a','2026-01-02T05:00:00.000Z','2026-01-02T13:00:00.000Z','Africa/Addis_Ababa','template-a',1,'2026-01-02','2026-01-01','2026-01-01')
  `).run();
  assert.equal(db.prepare('SELECT template_version FROM workforce_shifts WHERE id=?').get('generated-shift-a').template_version, 1);
  assert.throws(() => db.prepare(`
    INSERT INTO workforce_shifts
      (id,organization_id,tenant_id,chat_id,member_id,starts_at,ends_at,timezone,shift_template_id,template_version,generated_local_date,created_at,updated_at)
    VALUES ('generated-shift-duplicate','org-a','tenant-a','chat-a','member-a','2026-01-02T05:00:00.000Z','2026-01-02T13:00:00.000Z','Africa/Addis_Ababa','template-a',1,'2026-01-02','2026-01-01','2026-01-01')
  `).run());
  assert.throws(() => db.prepare(`
    INSERT INTO workforce_shifts
      (id,organization_id,tenant_id,chat_id,member_id,starts_at,ends_at,timezone,shift_template_id,template_version,generated_local_date,created_at,updated_at)
    VALUES ('generated-shift-cross','org-b','tenant-b','chat-b','member-b','2026-01-02T05:00:00.000Z','2026-01-02T13:00:00.000Z','Africa/Addis_Ababa','template-a',1,'2026-01-02','2026-01-01','2026-01-01')
  `).run(), /WORKFORCE_SHIFT_TEMPLATE_SCOPE_INVALID/);
  db.prepare("INSERT INTO workforce_departments (id,organization_id,tenant_id,chat_id,code,name,created_at,updated_at) VALUES ('dept-template-only','org-a','tenant-a','chat-a','SCHED','Scheduling','2026-01-01','2026-01-01')").run();
  db.prepare("INSERT INTO workforce_positions (id,organization_id,tenant_id,chat_id,code,name,created_at,updated_at) VALUES ('position-template-only','org-a','tenant-a','chat-a','SCHED-LEAD','Scheduling Lead','2026-01-01','2026-01-01')").run();
  db.prepare(`
    INSERT INTO workforce_shift_templates
      (id,organization_id,tenant_id,chat_id,name,start_local_time,end_local_time,timezone,effective_from,department_id,created_at,updated_at)
    VALUES ('template-department-guard','org-a','tenant-a','chat-a','Department Template','08:00','16:00','Africa/Addis_Ababa','2026-01-01','dept-template-only','2026-01-01','2026-01-01')
  `).run();
  db.prepare(`
    INSERT INTO workforce_shift_templates
      (id,organization_id,tenant_id,chat_id,name,start_local_time,end_local_time,timezone,effective_from,position_id,created_at,updated_at)
    VALUES ('template-position-guard','org-a','tenant-a','chat-a','Position Template','08:00','16:00','Africa/Addis_Ababa','2026-01-01','position-template-only','2026-01-01','2026-01-01')
  `).run();
  assert.throws(() => db.prepare("UPDATE workforce_departments SET status='INACTIVE' WHERE id='dept-template-only'").run(),
    /WORKFORCE_DEPARTMENT_HAS_ACTIVE_SHIFT_TEMPLATES/);
  assert.throws(() => db.prepare("UPDATE workforce_positions SET status='INACTIVE' WHERE id='position-template-only'").run(),
    /WORKFORCE_POSITION_HAS_ACTIVE_SHIFT_TEMPLATES/);
  assert.throws(() => db.prepare(`
    INSERT INTO workforce_shift_templates
      (id,organization_id,tenant_id,chat_id,name,start_local_time,end_local_time,timezone,effective_from,department_id,created_at,updated_at)
    VALUES ('template-cross','org-b','tenant-b','chat-b','Cross','08:00','16:00','Africa/Addis_Ababa','2026-01-01','dept-a','2026-01-01','2026-01-01')
  `).run(), /WORKFORCE_TEMPLATE_DEPARTMENT_SCOPE_INVALID/);
  assert.throws(() => db.prepare(`
    INSERT INTO workforce_shift_templates
      (id,organization_id,tenant_id,chat_id,name,start_local_time,end_local_time,timezone,effective_from,location_id,created_at,updated_at)
    VALUES ('template-location-cross','org-b','tenant-b','chat-b','Cross','08:00','16:00','Africa/Addis_Ababa','2026-01-01','location-a','2026-01-01','2026-01-01')
  `).run(), /WORKFORCE_TEMPLATE_LOCATION_SCOPE_INVALID/);
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
  for (const version of [
    WORKFORCE_MEMBER_ORG_REFERENCES_MIGRATION_VERSION,
    WORKFORCE_DEPARTMENT_MIGRATION_VERSION,
    WORKFORCE_POSITION_MIGRATION_VERSION,
    WORKFORCE_REPORTING_RELATIONSHIP_MIGRATION_VERSION,
    WORKFORCE_SHIFT_TEMPLATE_MIGRATION_VERSION,
    WORKFORCE_SHIFT_TEMPLATE_REFERENCE_GUARD_MIGRATION_VERSION,
    WORKFORCE_SHIFT_INSTANCE_PROVENANCE_MIGRATION_VERSION,
  ]) assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = ?').get(version).count, 1);

  console.log('PASS Workforce SQLite migrations 86-97: external professionals, employee numbers, departments, positions, reporting references, shift templates, rollback, idempotency, and foreign-key integrity');
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
