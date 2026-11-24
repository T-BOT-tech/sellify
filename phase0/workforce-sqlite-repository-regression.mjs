import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runWorkforceSqliteMigrations, runWorkforceServiceBookingMigration } from '../backend/lib/workforce-sqlite-migrations.js';
import { WorkforceSqliteRepository } from '../backend/lib/workforce-sqlite-repository.js';

const directory = mkdtempSync(path.join(os.tmpdir(), 'sellify-workforce-repository-'));
const db = new DatabaseSync(path.join(directory, 'workforce.sqlite'));
const scopeA = { organization_id: 'org-a', tenant_id: 'tenant-a', chat_id: 'chat-a', actor_id: 'user-a' };
const scopeB = { organization_id: 'org-b', tenant_id: 'tenant-b', chat_id: 'chat-b', actor_id: 'user-b' };
const repository = new WorkforceSqliteRepository({
  db,
  authorize: () => true,
  clock: () => '2026-11-24T12:00:00.000Z',
  idFactory: (() => { let id = 0; return () => `workforce-${++id}`; })(),
});

try {
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE organizations (id TEXT PRIMARY KEY);
    CREATE TABLE tenants (
      chat_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL REFERENCES organizations(id)
    );
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE memberships (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
      chat_id TEXT NOT NULL REFERENCES tenants(chat_id), status TEXT NOT NULL
    );
    CREATE TABLE locations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id));
    CREATE TABLE service_resources (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      chat_id TEXT NOT NULL REFERENCES tenants(chat_id), status TEXT NOT NULL DEFAULT 'ACTIVE'
    );
    CREATE TABLE service_bookings (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      chat_id TEXT NOT NULL REFERENCES tenants(chat_id), status TEXT NOT NULL DEFAULT 'REQUESTED'
    );
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, action TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT,
      created_at TEXT NOT NULL, organization_id TEXT
    );
    INSERT INTO organizations(id) VALUES ('org-a'), ('org-b');
    INSERT INTO tenants(chat_id, tenant_id, organization_id)
      VALUES ('chat-a','tenant-a','org-a'), ('chat-b','tenant-b','org-b');
    INSERT INTO users(id) VALUES ('user-a'), ('user-b'), ('user-c'), ('user-d');
    INSERT INTO memberships(id,user_id,chat_id,status)
      VALUES ('membership-a','user-a','chat-a','active'), ('membership-b','user-b','chat-b','active'), ('membership-c','user-c','chat-a','active'), ('membership-d','user-d','chat-a','inactive');
    INSERT INTO locations(id,organization_id) VALUES ('location-a','org-a'), ('location-b','org-b');
    INSERT INTO service_resources(id,organization_id,chat_id)
      VALUES ('resource-a','org-a','chat-a'), ('resource-b','org-b','chat-b');
    INSERT INTO service_bookings(id,organization_id,chat_id)
      VALUES ('booking-a','org-a','chat-a'), ('booking-b','org-b','chat-b');
  `);
  runWorkforceSqliteMigrations(db);
  runWorkforceServiceBookingMigration(db);

  const created = repository.create('member', {
    idempotency_key: 'member-create-a',
    user_id: 'user-a',
    member_type: 'PROVIDER',
    display_name: 'Provider A',
  }, scopeA);
  assert.equal(created.duplicate, false);
  assert.equal(created.record.status, 'DRAFT');
  assert.equal(created.record.version, 1);

  const externalMember = repository.create('member', {
    idempotency_key: 'member-create-external-a',
    member_type: 'CONTRACTOR',
    display_name: 'External Contractor A',
  }, scopeA);
  assert.equal(externalMember.record.user_id, null, 'external professionals are not required to have a Sellify account');
  assert.equal(repository.get('member', externalMember.record.id, scopeA).user_id, null);
  assert.deepEqual(repository.list('member', { ...scopeA, provider_user_id: 'user-a' }).map(record => record.id), [created.record.id],
    'provider-scoped reads must not expose unlinked external professionals');
  assert.throws(() => repository.get('member', externalMember.record.id, {
    ...scopeA, provider_user_id: 'user-a',
  }), error => error.code === 'WORKFORCE_SCOPE_NOT_FOUND',
  'an unlinked external professional must not be readable as an authenticated provider');
  assert.throws(() => repository.linkAccount('member', externalMember.record.id, {
    expected_version: 1, user_id: 'user-a',
  }, scopeA), error => error.code === 'WORKFORCE_USER_ALREADY_LINKED');
  assert.throws(() => repository.linkAccount('member', externalMember.record.id, {
    expected_version: 1, user_id: 'user-b',
  }, scopeA), error => error.code === 'WORKFORCE_USER_MEMBERSHIP_REQUIRED');
  assert.throws(() => repository.linkAccount('member', externalMember.record.id, {
    expected_version: 1, user_id: 'user-d',
  }, scopeA), error => error.code === 'WORKFORCE_USER_MEMBERSHIP_REQUIRED',
  'inactive tenant membership cannot authorize an account link');
  const linkedExternal = repository.linkAccount('member', externalMember.record.id, {
    expected_version: 1, user_id: 'user-c',
  }, scopeA);
  assert.equal(linkedExternal.user_id, 'user-c');
  assert.equal(linkedExternal.version, 2);
  const unlinkedExternal = repository.unlinkAccount('member', externalMember.record.id, {
    expected_version: 2,
  }, scopeA);
  assert.equal(unlinkedExternal.user_id, null);
  assert.equal(unlinkedExternal.version, 3);
  assert.throws(() => repository.unlinkAccount('member', externalMember.record.id, {
    expected_version: 3,
  }, scopeA), error => error.code === 'WORKFORCE_ACCOUNT_NOT_LINKED');
  const accountAuditActions = db.prepare(`
    SELECT action FROM audit_events WHERE entity_id = ? AND action IN ('workforce.member.account_linked','workforce.member.account_unlinked')
    ORDER BY id
  `).all(externalMember.record.id).map(row => row.action);
  assert.deepEqual(accountAuditActions, ['workforce.member.account_linked','workforce.member.account_unlinked'],
    'account link and unlink must be auditable');
  const deniedAccountLinkRepository = new WorkforceSqliteRepository({
    db, authorize: request => request.operation !== 'link_account',
  });
  assert.throws(() => deniedAccountLinkRepository.linkAccount('member', externalMember.record.id, {
    expected_version: 3, user_id: 'user-c',
  }, scopeA), error => error.code === 'WORKFORCE_FORBIDDEN',
  'account linking requires Workforce management authorization');

  const duplicate = repository.create('member', {
    idempotency_key: 'member-create-a',
    user_id: 'user-a',
    member_type: 'PROVIDER',
    display_name: 'Provider A',
  }, scopeA);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.record.id, created.record.id);

  assert.throws(() => repository.create('member', {
    idempotency_key: 'member-create-a',
    user_id: 'user-a',
    member_type: 'PROVIDER',
    display_name: 'Different payload',
  }, scopeA), (error) => error.code === 'WORKFORCE_IDEMPOTENCY_CONFLICT');

  const updated = repository.update('member', created.record.id, {
    expected_version: 1,
    display_name: 'Provider A Updated',
  }, scopeA);
  assert.equal(updated.version, 2);
  assert.equal(updated.display_name, 'Provider A Updated');

  assert.throws(() => repository.update('member', created.record.id, {
    expected_version: 1,
    display_name: 'Stale update',
  }, scopeA), (error) => error.code === 'WORKFORCE_VERSION_CONFLICT');

  const activated = repository.activate('member', created.record.id, { expected_version: 2 }, scopeA);
  assert.equal(activated.status, 'ACTIVE');
  assert.equal(activated.version, 3);

  assert.throws(() => repository.get('member', created.record.id, scopeB),
    (error) => error.code === 'WORKFORCE_SCOPE_NOT_FOUND');

  const secondMember = repository.create('member', {
    idempotency_key: 'member-create-b',
    user_id: 'user-b',
    member_type: 'PROVIDER',
    display_name: 'Provider B',
  }, scopeB);
  assert.throws(() => repository.get('member', secondMember.record.id, scopeA),
    (error) => error.code === 'WORKFORCE_SCOPE_NOT_FOUND');

  const assignment = repository.create('assignment', {
    idempotency_key: 'assignment-create-a',
    member_id: created.record.id,
    resource_id: 'resource-a',
    location_id: 'location-a',
    assignment_type: 'RESOURCE',
    starts_at: '2026-11-25T09:00:00.000Z',
    ends_at: '2026-11-25T17:00:00.000Z',
    booking_id: 'booking-a',
  }, { ...scopeA, resource_id: 'resource-a' });
  assert.equal(assignment.record.status, 'DRAFT');

  assert.throws(() => repository.get('assignment', assignment.record.id, {
    ...scopeA, resource_id: 'resource-b',
  }), (error) => error.code === 'WORKFORCE_SCOPE_NOT_FOUND');

  assert.deepEqual(repository.list('assignment', {
    ...scopeA, resource_id: 'resource-b',
  }), []);

  assert.throws(() => repository.create('assignment', {
    idempotency_key: 'assignment-cross-tenant',
    member_id: created.record.id,
    resource_id: 'resource-b',
    assignment_type: 'RESOURCE',
    starts_at: '2026-11-25T09:00:00.000Z',
    ends_at: '2026-11-25T17:00:00.000Z',
  }, scopeA), (error) => error.code === 'WORKFORCE_RESOURCE_SCOPE_INVALID');

  const providerARecords = repository.list('assignment', {
    ...scopeA, resource_id: 'resource-a', provider_user_id: 'user-a',
  });
  assert.equal(providerARecords.length, 1);
  assert.equal(providerARecords[0].id, assignment.record.id);

  const assignmentActive = repository.activate('assignment', assignment.record.id, { expected_version: 1 }, scopeA);
  assert.equal(assignmentActive.status, 'ACTIVE');

  const profile = repository.create('profile', {
    idempotency_key: 'profile-create-a',
    member_id: created.record.id,
    skills: ['consultation','customer-care'],
    qualifications: ['licensed-provider'],
    languages: ['en','am'],
    service_capabilities: ['consultation'],
    visibility: 'ORGANIZATION',
    effective_from: '2026-11-24',
  }, scopeA);
  assert.deepEqual(profile.record.skills, ['consultation','customer-care']);
  const profileUpdated = repository.update('profile', profile.record.id, {
    expected_version: 1, notes: 'Verified profile',
  }, scopeA);
  assert.equal(profileUpdated.version, 2);
  assert.equal(repository.get('profile', profile.record.id, scopeA).notes, 'Verified profile');

  const engagement = repository.create('engagement', {
    idempotency_key: 'engagement-create-a',
    member_id: created.record.id,
    engagement_type: 'CONTRACT',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-12-25T15:00:00.000Z',
  }, scopeA);
  const submittedEngagement = repository.submit('engagement', engagement.record.id, { expected_version: 1 }, scopeA);
  const activeEngagement = repository.activate('engagement', engagement.record.id, { expected_version: 2 }, scopeA);
  const suspendedEngagement = repository.suspend('engagement', engagement.record.id, { expected_version: 3 }, scopeA);
  const endedEngagement = repository.end('engagement', engagement.record.id, { expected_version: 4 }, scopeA);
  assert.equal(submittedEngagement.status, 'PENDING_APPROVAL');
  assert.equal(activeEngagement.status, 'ACTIVE');
  assert.equal(suspendedEngagement.status, 'SUSPENDED');
  assert.equal(endedEngagement.status, 'ENDED');

  const calendar = repository.create('calendar', {
    idempotency_key: 'calendar-create-a',
    member_id: created.record.id,
    timezone: 'Africa/Addis_Ababa',
    weekly_schedule: [{ day: 'MONDAY', intervals: [{ start: '09:00', end: '17:00' }] }],
    holiday_calendar: [],
    effective_from: '2026-11-24',
  }, scopeA);
  assert.equal(calendar.record.status, 'ACTIVE');
  const calendarUpdated = repository.update('calendar', calendar.record.id, {
    expected_version: 1,
    weekly_schedule: [{ day: 'TUESDAY', intervals: [{ start: '10:00', end: '16:00' }] }],
  }, scopeA);
  assert.equal(calendarUpdated.version, 2);

  const exception = repository.create('calendar_exception', {
    idempotency_key: 'calendar-exception-create-a',
    calendar_id: calendar.record.id,
    exception_type: 'LEAVE',
    starts_at: '2026-11-27T06:00:00.000Z',
    ends_at: '2026-11-28T15:00:00.000Z',
    all_day: true,
    reason: 'Annual leave',
  }, scopeA);
  assert.equal(exception.record.status, 'ACTIVE');
  assert.equal(repository.list('calendar_exception', { ...scopeA, provider_user_id: 'user-a' }).length, 1);
  const cancelledException = repository.cancel('calendar_exception', exception.record.id, { expected_version: 1 }, scopeA);
  assert.equal(cancelledException.status, 'CANCELLED');

  const availability = repository.create('availability', {
    idempotency_key: 'availability-create-a',
    member_id: created.record.id,
    resource_id: 'resource-a',
    location_id: 'location-a',
    availability: 'AVAILABLE',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T15:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
    effective_from: '2026-11-25',
  }, scopeA);
  assert.equal(availability.record.availability, 'AVAILABLE');
  const unavailable = repository.update('availability', availability.record.id, {
    expected_version: 1, availability: 'UNAVAILABLE',
  }, scopeA);
  assert.equal(unavailable.availability, 'UNAVAILABLE');
  assert.throws(() => repository.create('availability', {
    idempotency_key: 'availability-invalid-recurrence-a',
    member_id: created.record.id,
    availability: 'AVAILABLE',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T15:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
    recurrence_rule: 'FREQ=MONTHLY',
    effective_from: '2026-11-25',
  }, scopeA), error => error?.code === 'WORKFORCE_RECURRENCE_RULE_INVALID');


  const shift = repository.create('shift', {
    idempotency_key: 'shift-create-a',
    member_id: created.record.id,
    resource_id: 'resource-a',
    location_id: 'location-a',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T15:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
    break_rules: [{ starts_at: '2026-11-25T10:00:00.000Z', duration_minutes: 30 }],
  }, scopeA);
  const confirmedShift = repository.confirm('shift', shift.record.id, { expected_version: 1 }, scopeA);
  const startedShift = repository.start('shift', shift.record.id, { expected_version: 2 }, scopeA);
  const completedShift = repository.complete('shift', shift.record.id, { expected_version: 3 }, scopeA);
  assert.equal(confirmedShift.status, 'CONFIRMED');
  assert.equal(startedShift.status, 'IN_PROGRESS');
  assert.equal(completedShift.status, 'COMPLETED');

  const allocation = repository.create('allocation', {
    idempotency_key: 'allocation-create-a',
    member_id: created.record.id,
    resource_id: 'resource-a',
    booking_id: 'booking-a',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T15:00:00.000Z',
  }, scopeA);
  const submittedAllocation = repository.submit('allocation', allocation.record.id, { expected_version: 1 }, scopeA);
  const approvedAllocation = repository.approve('allocation', allocation.record.id, { expected_version: 2 }, scopeA);
  const releasedAllocation = repository.release('allocation', allocation.record.id, { expected_version: 3 }, scopeA);
  assert.equal(submittedAllocation.state, 'PENDING_APPROVAL');
  assert.equal(approvedAllocation.state, 'COMMITTED');
  assert.equal(releasedAllocation.state, 'RELEASED');

  const utilization = repository.create('utilization', {
    idempotency_key: 'utilization-create-a',
    member_id: created.record.id,
    resource_id: 'resource-a',
    booking_id: 'booking-a',
    planned_starts_at: '2026-11-25T06:00:00.000Z',
    planned_ends_at: '2026-11-25T15:00:00.000Z',
    evidence_source: 'REGRESSION_TEST',
  }, scopeA);
  const startedUtilization = repository.start('utilization', utilization.record.id, { expected_version: 1 }, scopeA);
  const updatedUtilization = repository.update('utilization', utilization.record.id, {
    expected_version: 2,
    actual_starts_at: '2026-11-25T06:05:00.000Z',
    actual_ends_at: '2026-11-25T15:10:00.000Z',
  }, scopeA);
  const completedUtilization = repository.complete('utilization', utilization.record.id, {
    expected_version: 3,
  }, scopeA);
  assert.equal(startedUtilization.status, 'IN_PROGRESS');
  assert.equal(updatedUtilization.actual_starts_at, '2026-11-25T06:05:00.000Z');
  assert.equal(completedUtilization.status, 'COMPLETED');
  const utilizationSummary = repository.summarizeUtilization(scopeA, {
    from: '2026-11-25T00:00:00.000Z',
    to: '2026-11-26T00:00:00.000Z',
  });
  assert.equal(utilizationSummary.event_count, 1);
  assert.equal(utilizationSummary.completed_events, 1);
  assert.equal(utilizationSummary.open_events, 0);
  assert.equal(utilizationSummary.planned_minutes, 540);
  assert.equal(utilizationSummary.measured_planned_minutes, 540);
  assert.equal(utilizationSummary.actual_minutes, 545);
  assert.equal(utilizationSummary.variance_minutes, 5);
  assert.equal(utilizationSummary.by_member[0].member_id, created.record.id);
  assert.equal(utilizationSummary.by_resource[0].resource_id, 'resource-a');
  assert.equal(repository.summarizeUtilization(scopeA, {
    from: '2026-11-26T00:00:00.000Z',
  }).event_count, 0, 'planned start date filters must be applied');
  assert.equal(repository.summarizeUtilization(scopeB).event_count, 0,
    'utilization analytics must remain tenant-scoped');
  assert.throws(() => repository.summarizeUtilization(scopeA, {
    from: '2026-11-26T00:00:00.000Z',
    to: '2026-11-25T00:00:00.000Z',
  }), error => error?.code === 'WORKFORCE_ANALYTICS_RANGE_INVALID');


  const deniedRepository = new WorkforceSqliteRepository({ db, authorize: () => false });
  assert.throws(() => deniedRepository.get('member', created.record.id, scopeA),
    error => error.code === 'WORKFORCE_FORBIDDEN');
  assert.throws(() => deniedRepository.summarizeUtilization(scopeA),
    error => error.code === 'WORKFORCE_FORBIDDEN');
  assert.throws(() => repository.update('member', created.record.id, {
    expected_version: 3, user_id: 'user-b',
  }, scopeA), error => error.code === 'WORKFORCE_UPDATE_EMPTY');

  const suspendedMember = repository.suspend('member', created.record.id, { expected_version: 3 }, scopeA);
  const deactivatedMember = repository.deactivate('member', created.record.id, { expected_version: 4 }, scopeA);
  assert.equal(suspendedMember.status, 'SUSPENDED');
  assert.equal(deactivatedMember.status, 'INACTIVE');

  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.ok(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'workforce.%'").get().count >= 4);

  console.log('PASS Workforce SQLite repository: all entity CRUD/lifecycle paths, idempotency, optimistic concurrency, authorization, tenant/organization isolation, resource and provider scoping');
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
