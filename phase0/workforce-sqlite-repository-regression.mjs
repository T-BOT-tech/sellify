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
      chat_id TEXT NOT NULL REFERENCES tenants(chat_id)
    );
    CREATE TABLE service_bookings (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      chat_id TEXT NOT NULL REFERENCES tenants(chat_id)
    );
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, action TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT,
      created_at TEXT NOT NULL, organization_id TEXT
    );
    INSERT INTO organizations(id) VALUES ('org-a'), ('org-b');
    INSERT INTO tenants(chat_id, tenant_id, organization_id)
      VALUES ('chat-a','tenant-a','org-a'), ('chat-b','tenant-b','org-b');
    INSERT INTO users(id) VALUES ('user-a'), ('user-b');
    INSERT INTO memberships(id,user_id,chat_id,status)
      VALUES ('membership-a','user-a','chat-a','active'), ('membership-b','user-b','chat-b','active');
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

  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.ok(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'workforce.%'").get().count >= 4);

  console.log('PASS Workforce SQLite repository: CRUD, idempotency, optimistic concurrency, tenant/organization isolation, resource and provider scoping');
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
