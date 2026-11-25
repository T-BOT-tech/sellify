import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { runWorkforceSqliteMigrations, runWorkforceServiceBookingMigration, runWorkforceExternalMemberMigration, runWorkforceEmployeeNumberMigration, runWorkforceOrganizationStructureMigration, runWorkforceShiftTemplateMigration, runWorkforceShiftTemplateReferenceGuardMigration, runWorkforceShiftInstanceProvenanceMigration, runWorkforceLeaveAbsenceMigration, runWorkforceSchedulingPolicyMigration, runWorkforceShiftSchedulingAssessmentMigration, runWorkforceShiftSchedulingOverrideMigration } from '../backend/lib/workforce-sqlite-migrations.js';
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
      chat_id TEXT NOT NULL REFERENCES tenants(chat_id), status TEXT NOT NULL DEFAULT 'REQUESTED',
      requested_start TEXT, requested_end TEXT
    );
    CREATE TABLE orders (
      server_order_id TEXT PRIMARY KEY, chat_id TEXT NOT NULL REFERENCES tenants(chat_id)
    );
    CREATE TABLE fulfillments (
      id TEXT PRIMARY KEY, server_order_id TEXT NOT NULL REFERENCES orders(server_order_id),
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      fulfillment_type TEXT NOT NULL, scheduled_at TEXT
    );
    CREATE TABLE delivery_assignments (
      id TEXT PRIMARY KEY, fulfillment_id TEXT NOT NULL REFERENCES fulfillments(id),
      organization_id TEXT NOT NULL REFERENCES organizations(id),
      courier_user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL,
      assigned_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT, action TEXT NOT NULL,
      entity_type TEXT NOT NULL, entity_id TEXT, metadata_json TEXT,
      created_at TEXT NOT NULL, organization_id TEXT
    );
    INSERT INTO organizations(id) VALUES ('org-a'), ('org-b');
    INSERT INTO tenants(chat_id, tenant_id, organization_id)
      VALUES ('chat-a','tenant-a','org-a'), ('chat-a2','tenant-a2','org-a'), ('chat-b','tenant-b','org-b');
    INSERT INTO users(id) VALUES ('user-a'), ('user-b'), ('user-c'), ('user-d'), ('user-e');
    INSERT INTO memberships(id,user_id,chat_id,status)
      VALUES ('membership-a','user-a','chat-a','active'), ('membership-b','user-b','chat-b','active'), ('membership-c','user-c','chat-a','active'), ('membership-d','user-d','chat-a','inactive'), ('membership-e','user-e','chat-a','active');
    INSERT INTO locations(id,organization_id) VALUES ('location-a','org-a'), ('location-b','org-b');
    INSERT INTO service_resources(id,organization_id,chat_id)
      VALUES ('resource-a','org-a','chat-a'), ('resource-b','org-b','chat-b');
    INSERT INTO service_bookings(id,organization_id,chat_id)
      VALUES ('booking-a','org-a','chat-a'), ('booking-b','org-b','chat-b');
  `);
  runWorkforceSqliteMigrations(db);
  runWorkforceServiceBookingMigration(db);
  runWorkforceExternalMemberMigration(db);
  runWorkforceEmployeeNumberMigration(db);
  runWorkforceOrganizationStructureMigration(db);
  runWorkforceShiftTemplateMigration(db);
  runWorkforceShiftTemplateReferenceGuardMigration(db);
  runWorkforceShiftInstanceProvenanceMigration(db);
  runWorkforceLeaveAbsenceMigration(db);
  runWorkforceSchedulingPolicyMigration(db);
  runWorkforceShiftSchedulingAssessmentMigration(db);
  runWorkforceShiftSchedulingOverrideMigration(db);

  const department = repository.create('department', { idempotency_key: 'department-ops', code: 'ops', name: 'Operations' }, scopeA);
  assert.equal(department.record.code, 'OPS');
  const position = repository.create('position', { idempotency_key: 'position-lead', code: 'lead', name: 'Team Lead', department_id: department.record.id }, scopeA);
  assert.equal(position.record.department_id, department.record.id);
  assert.equal(repository.get('department', department.record.id, scopeA).name, 'Operations');
  assert.equal(repository.list('department', scopeA).length, 1);
  const shiftTemplate = repository.create('shift_template', {
    idempotency_key: 'shift-template-morning-a',
    name: 'Morning Shift',
    start_local_time: '08:00',
    end_local_time: '16:30',
    timezone: 'Africa/Addis_Ababa',
    break_rules: [{ start_local_time: '12:00', end_local_time: '12:30' }],
    work_days: [1,2,3,4,5],
    department_id: department.record.id,
    position_id: position.record.id,
    location_id: 'location-a',
    effective_from: '2026-01-01',
  }, scopeA);
  assert.equal(shiftTemplate.record.status, 'ACTIVE');
  assert.deepEqual(shiftTemplate.record.work_days, [1,2,3,4,5]);
  assert.deepEqual(shiftTemplate.record.break_rules, [{ start_local_time: '12:00', end_local_time: '12:30' }]);
  assert.equal(repository.get('shift_template', shiftTemplate.record.id, scopeA).timezone, 'Africa/Addis_Ababa');
  assert.equal(repository.list('shift_template', scopeA).length, 1);
  const updatedTemplate = repository.update('shift_template', shiftTemplate.record.id, {
    expected_version: 1, name: 'Morning Shift Updated',
  }, scopeA);
  assert.equal(updatedTemplate.version, 2);
  const inactiveTemplate = repository.deactivate('shift_template', shiftTemplate.record.id, { expected_version: 2 }, scopeA);
  assert.equal(inactiveTemplate.status, 'INACTIVE');
  const activeTemplate = repository.activate('shift_template', shiftTemplate.record.id, { expected_version: 3 }, scopeA);
  assert.equal(activeTemplate.status, 'ACTIVE');
  const templateDepartment = repository.create('department', {
    idempotency_key: 'department-template-only', code: 'SCHED', name: 'Scheduling',
  }, scopeA);
  repository.create('shift_template', {
    idempotency_key: 'shift-template-department-guard', name: 'Scheduling Team',
    start_local_time: '08:00', end_local_time: '16:00', timezone: 'Africa/Addis_Ababa',
    effective_from: '2026-01-01', department_id: templateDepartment.record.id,
  }, scopeA);
  assert.throws(() => repository.deactivate('department', templateDepartment.record.id, { expected_version: 1 }, scopeA),
    error => error.code === 'WORKFORCE_DEPARTMENT_HAS_ACTIVE_SHIFT_TEMPLATES');
  const templatePosition = repository.create('position', {
    idempotency_key: 'position-template-only', code: 'SCHED-LEAD', name: 'Scheduling Lead',
  }, scopeA);
  repository.create('shift_template', {
    idempotency_key: 'shift-template-position-guard', name: 'Scheduling Lead Shift',
    start_local_time: '08:00', end_local_time: '16:00', timezone: 'Africa/Addis_Ababa',
    effective_from: '2026-01-01', position_id: templatePosition.record.id,
  }, scopeA);
  assert.throws(() => repository.deactivate('position', templatePosition.record.id, { expected_version: 1 }, scopeA),
    error => error.code === 'WORKFORCE_POSITION_HAS_ACTIVE_SHIFT_TEMPLATES');
  assert.throws(() => repository.create('shift_template', {
    idempotency_key: 'shift-template-cross-department', name: 'Cross Department',
    start_local_time: '08:00', end_local_time: '16:00', timezone: 'Africa/Addis_Ababa',
    effective_from: '2026-01-01', department_id: department.record.id,
  }, scopeB), error => error.code === 'WORKFORCE_TEMPLATE_DEPARTMENT_SCOPE_INVALID');
  assert.throws(() => repository.create('shift_template', {
    idempotency_key: 'shift-template-invalid-time', name: 'Invalid Time',
    start_local_time: '25:00', end_local_time: '16:00', timezone: 'Africa/Addis_Ababa',
    effective_from: '2026-01-01',
  }, scopeA), error => error.code === 'WORKFORCE_LOCAL_TIME_INVALID');
  assert.throws(() => repository.create('shift_template', {
    idempotency_key: 'shift-template-invalid-break', name: 'Invalid Break',
    start_local_time: '08:00', end_local_time: '16:00', timezone: 'Africa/Addis_Ababa',
    break_rules: [{ start_local_time: '17:00', end_local_time: '17:30' }],
    effective_from: '2026-01-01',
  }, scopeA), error => error.code === 'WORKFORCE_BREAK_RULES_INVALID');
  const updatedDepartment = repository.update('department', department.record.id, { expected_version: 1, description: 'Operations team' }, scopeA);
  assert.equal(updatedDepartment.version, 2);
  const updatedPosition = repository.update('position', position.record.id, { expected_version: 1, classification: 'LEAD' }, scopeA);
  assert.equal(updatedPosition.version, 2);
  assert.throws(() => repository.create('position', { idempotency_key: 'position-cross', code: 'cross', name: 'Cross', department_id: department.record.id }, scopeB), error => error.code === 'WORKFORCE_DEPARTMENT_SCOPE_INVALID');
  assert.throws(() => repository.create('department', { idempotency_key: 'department-duplicate', code: 'OPS', name: 'Duplicate' }, scopeA), error => error.code === 'WORKFORCE_CONSTRAINT_CONFLICT');

  const created = repository.create('member', {
    idempotency_key: 'member-create-a',
    user_id: 'user-a',
    member_type: 'PROVIDER',
    display_name: 'Provider A',
    primary_location_id: 'location-a',
    employee_number: ' EMP-001 ',
    department_id: department.record.id,
    position_id: position.record.id,
  }, scopeA);
  assert.equal(created.duplicate, false);
  assert.equal(created.record.status, 'DRAFT');
  assert.equal(created.record.version, 1);
  assert.equal(created.record.employee_number, 'EMP-001', 'employee number is normalized');
  assert.equal(created.record.department_id, department.record.id);
  assert.equal(created.record.position_id, position.record.id);
  const otherOrganizationMember = repository.create('member', {
    idempotency_key: 'member-create-b-employee-number', member_type: 'EMPLOYEE', employee_number: 'EMP-001',
  }, scopeB);
  assert.equal(otherOrganizationMember.record.employee_number, 'EMP-001', 'employee numbers may repeat in another organization');
  assert.throws(() => repository.create('member', {
    idempotency_key: 'member-create-duplicate-employee-number', member_type: 'EMPLOYEE', employee_number: 'emp-001',
  }, scopeA), error => error.code === 'WORKFORCE_CONSTRAINT_CONFLICT');

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
    primary_location_id: 'location-a',
    employee_number: 'EMP-001',
    department_id: department.record.id,
    position_id: position.record.id,
  }, scopeA);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.record.id, created.record.id);

  assert.throws(() => repository.create('member', {
    idempotency_key: 'member-create-a',
    user_id: 'user-a',
    member_type: 'PROVIDER',
    display_name: 'Different payload',
  }, scopeA), (error) => error.code === 'WORKFORCE_IDEMPOTENCY_CONFLICT');
  assert.throws(() => repository.create('member', {
    idempotency_key: 'member-create-duplicate-user',
    user_id: 'user-a',
    member_type: 'PROVIDER',
    display_name: 'Duplicate provider identity',
  }, scopeA), error => error.code === 'WORKFORCE_USER_ALREADY_LINKED',
  'a Sellify account cannot be linked to multiple Workforce members within one organization/tenant scope');

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
  const supervisor = repository.create('member', { idempotency_key: 'member-supervisor', member_type: 'EMPLOYEE', display_name: 'Operations Supervisor' }, scopeA);
  assert.throws(() => repository.create('shift', {
    idempotency_key: 'shift-inactive-member',
    member_id: supervisor.record.id,
    starts_at: '2026-11-25T09:00:00.000Z',
    ends_at: '2026-11-25T10:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA), error => error.code === 'WORKFORCE_MEMBER_NOT_ELIGIBLE',
  'direct shift creation must reject inactive Workforce members');
  const activeSupervisor = repository.activate('member', supervisor.record.id, { expected_version: 1 }, scopeA);
  const reporting = repository.update('member', created.record.id, { expected_version: 3, supervisor_member_id: activeSupervisor.id }, scopeA);
  assert.equal(reporting.supervisor_member_id, activeSupervisor.id);
  const replacementSupervisor = repository.create('member', { idempotency_key: 'member-replacement-supervisor', member_type: 'EMPLOYEE', display_name: 'Replacement Supervisor' }, scopeA);
  const activeReplacementSupervisor = repository.activate('member', replacementSupervisor.record.id, { expected_version: 1 }, scopeA);
  const reassigned = repository.update('member', created.record.id, { expected_version: 4, supervisor_member_id: activeReplacementSupervisor.id }, scopeA);
  assert.equal(reassigned.supervisor_member_id, activeReplacementSupervisor.id, 'reporting lines can be safely reassigned');
  assert.throws(() => repository.update('member', activeReplacementSupervisor.id, { expected_version: 2, supervisor_member_id: created.record.id }, scopeA), error => error.code === 'WORKFORCE_REPORTING_CYCLE_INVALID');
  assert.throws(() => repository.update('member', created.record.id, { expected_version: 5, supervisor_member_id: created.record.id }, scopeA), error => error.code === 'WORKFORCE_SUPERVISOR_SELF_INVALID');
  const inactiveOldSupervisor = repository.deactivate('member', activeSupervisor.id, { expected_version: 2 }, scopeA);
  assert.equal(inactiveOldSupervisor.status, 'INACTIVE', 'a supervisor can be deactivated after active reports are reassigned');
  assert.throws(() => repository.deactivate('member', activeReplacementSupervisor.id, { expected_version: 2 }, scopeA), error => error.code === 'WORKFORCE_SUPERVISOR_HAS_ACTIVE_REPORTS');
  assert.equal(Number(db.prepare('SELECT COUNT(*) AS count FROM audit_events WHERE entity_id = ? AND action = ?').get(created.record.id, 'workforce.member.reporting_relationship_changed').count), 2);
  assert.throws(() => repository.deactivate('department', department.record.id, { expected_version: 2 }, scopeA), error => error.code === 'WORKFORCE_DEPARTMENT_HAS_ACTIVE_ASSIGNMENTS');
  assert.throws(() => repository.deactivate('position', position.record.id, { expected_version: 2 }, scopeA), error => error.code === 'WORKFORCE_POSITION_HAS_ACTIVE_ASSIGNMENTS');

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
    starts_at: '2026-11-25T00:00:00.000Z',
    ends_at: '2026-12-25T15:00:00.000Z',
  }, scopeA);
  const submittedEngagement = repository.submit('engagement', engagement.record.id, { expected_version: 1 }, scopeA);
  const activeEngagement = repository.activate('engagement', engagement.record.id, { expected_version: 2 }, scopeA);
  const employeeScopeA = { ...scopeA, actor: { role: 'staff' }, member_user_id: 'user-a' };
  const employeeLeave = repository.create('leave_request', {
    idempotency_key: 'leave-self-service-a', member_id: created.record.id,
    leave_category: 'PERSONAL', starts_at: '2026-12-10T00:00:00.000Z',
    ends_at: '2026-12-11T00:00:00.000Z', timezone: 'Africa/Addis_Ababa',
    reason: 'Personal appointment', all_day: true,
  }, employeeScopeA);
  assert.equal(employeeLeave.record.status, 'DRAFT');
  assert.equal(employeeLeave.record.requested_by, 'user-a');
  const employeeLeaveUpdated = repository.update('leave_request', employeeLeave.record.id, {
    expected_version: 1, reason: 'Personal appointment updated',
  }, employeeScopeA);
  assert.equal(employeeLeaveUpdated.version, 2);
  const employeeLeaveSubmitted = repository.submit('leave_request', employeeLeave.record.id, { expected_version: 2 }, employeeScopeA);
  assert.equal(employeeLeaveSubmitted.status, 'PENDING_APPROVAL');
  assert.equal(employeeLeaveSubmitted.submitted_by, 'user-a');
  const employeeLeaveWithdrawn = repository.withdraw('leave_request', employeeLeave.record.id, {
    expected_version: 3, reason: 'Plans changed',
  }, employeeScopeA);
  assert.equal(employeeLeaveWithdrawn.status, 'WITHDRAWN');
  assert.equal(repository.list('leave_request', employeeScopeA).length, 1,
    'employee self-service reads must remain scoped to the linked Workforce member');

  const managerScopeA = { ...scopeA, actor_id: 'user-c', actor: { role: 'manager' } };
  const approverScopeA = { ...scopeA, actor_id: 'user-e', actor: { role: 'manager' } };
  const approvedLeaveRequest = repository.create('leave_request', {
    idempotency_key: 'leave-manager-created-a', member_id: created.record.id,
    leave_category: 'ANNUAL', starts_at: '2026-12-01T00:00:00.000Z',
    ends_at: '2026-12-03T00:00:00.000Z', timezone: 'Africa/Addis_Ababa',
    reason: 'Planned annual leave', all_day: true,
  }, managerScopeA);
  const approvedLeaveSubmitted = repository.submit('leave_request', approvedLeaveRequest.record.id, { expected_version: 1 }, managerScopeA);
  assert.throws(() => repository.approve('leave_request', approvedLeaveRequest.record.id, {
    expected_version: 2,
  }, managerScopeA), error => error.code === 'WORKFORCE_LEAVE_SELF_APPROVAL_FORBIDDEN');
  const approvedLeave = repository.approve('leave_request', approvedLeaveRequest.record.id, {
    expected_version: approvedLeaveSubmitted.version, decision_reason: 'Coverage confirmed',
  }, approverScopeA);
  assert.equal(approvedLeave.status, 'APPROVED');
  assert.equal(approvedLeave.decided_by, 'user-e');
  assert.throws(() => repository.create('shift', {
    idempotency_key: 'shift-during-approved-leave', member_id: created.record.id,
    starts_at: '2026-12-02T06:00:00.000Z', ends_at: '2026-12-02T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA), error => error.code === 'WORKFORCE_LEAVE_AVAILABILITY_CONFLICT');
  const cancelledLeave = repository.cancel('leave_request', approvedLeave.id, {
    expected_version: approvedLeave.version, reason: 'Business coverage changed',
  }, approverScopeA);
  assert.equal(cancelledLeave.status, 'CANCELLED');
  assert.ok(repository.listEntityHistory('leave_request', cancelledLeave.id, approverScopeA)
    .some(event => event.action === 'workforce.leave_request.cancel'
      && event.metadata.reason === 'Business coverage changed'));

  const absence = repository.create('absence', {
    idempotency_key: 'absence-sickness-a', member_id: created.record.id,
    absence_type: 'SICKNESS', starts_at: '2026-11-29T06:00:00.000Z',
    ends_at: '2026-11-29T14:00:00.000Z', timezone: 'Africa/Addis_Ababa',
    reason: 'Unplanned sickness',
  }, managerScopeA);
  assert.equal(absence.record.status, 'RECORDED');
  assert.throws(() => repository.create('shift', {
    idempotency_key: 'shift-during-recorded-absence', member_id: created.record.id,
    starts_at: '2026-11-29T07:00:00.000Z', ends_at: '2026-11-29T08:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA), error => error.code === 'WORKFORCE_ABSENCE_AVAILABILITY_CONFLICT');
  const voidedAbsence = repository.void('absence', absence.record.id, {
    expected_version: 1, reason: 'Absence was recorded against the wrong member',
  }, approverScopeA);
  assert.equal(voidedAbsence.status, 'VOIDED');
  assert.ok(repository.listEntityHistory('absence', voidedAbsence.id, approverScopeA)
    .some(event => event.action === 'workforce.absence.void'
      && event.metadata.reason === 'Absence was recorded against the wrong member'));
  const shiftAfterAbsenceCorrection = repository.create('shift', {
    idempotency_key: 'shift-after-absence-correction', member_id: created.record.id,
    starts_at: '2026-11-29T07:00:00.000Z', ends_at: '2026-11-29T08:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA);
  assert.equal(shiftAfterAbsenceCorrection.record.status, 'PLANNED');

  const legacyLongShift = repository.create('shift', {
    idempotency_key: 'shift-created-before-policy-long', member_id: created.record.id,
    starts_at: '2026-12-21T06:00:00.000Z', ends_at: '2026-12-21T16:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA);
  assert.equal(legacyLongShift.record.constraint_policy_id, null);
  assert.equal(legacyLongShift.record.constraint_state, 'UNKNOWN');

  const schedulingPolicy = repository.create('scheduling_policy', {
    idempotency_key: 'scheduling-policy-org-a',
    name: 'Operations scheduling policy',
    effective_from: '2026-11-25',
    rules: { max_shift_minutes: 600, max_daily_minutes: 600, minimum_rest_minutes: 660,
      minimum_break_after_minutes: 360, minimum_break_duration_minutes: 30,
      enforcement: { max_daily_minutes: 'WARN' } },
  }, managerScopeA);
  assert.equal(schedulingPolicy.record.status, 'DRAFT');
  assert.equal(schedulingPolicy.record.version, 1);
  assert.equal(schedulingPolicy.record.rules.max_daily_minutes, 600);
  const activeSchedulingPolicy = repository.activate('scheduling_policy', schedulingPolicy.record.id, {
    expected_version: 1,
  }, managerScopeA);
  assert.equal(activeSchedulingPolicy.status, 'ACTIVE');
  assert.equal(activeSchedulingPolicy.version, 2);
  const updatedSchedulingPolicy = repository.update('scheduling_policy', activeSchedulingPolicy.id, {
    expected_version: 2, rules: { max_shift_minutes: 540, max_daily_minutes: 540, allow_overrides: true,
      allow_unknown_overrides: false, enforcement: { max_daily_minutes: 'BLOCK' } },
  }, managerScopeA);
  assert.equal(updatedSchedulingPolicy.version, 3);
  assert.equal(updatedSchedulingPolicy.rules.max_shift_minutes, 540);

  assert.throws(() => repository.create('shift', {
    idempotency_key: 'shift-policy-max-duration-a', member_id: created.record.id,
    starts_at: '2026-12-20T06:00:00.000Z', ends_at: '2026-12-20T16:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA), error => error.code === 'WORKFORCE_SCHEDULING_CONSTRAINT_CONFLICT'
    && error.details?.assessment?.policy_version === 3
    && error.details?.assessment?.findings?.some(item => item.code === 'MAX_SHIFT_DURATION'));
  const policyCompliantShift = repository.create('shift', {
    idempotency_key: 'shift-policy-compliant-a', member_id: created.record.id,
    starts_at: '2026-12-20T06:00:00.000Z', ends_at: '2026-12-20T14:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA);
  assert.equal(policyCompliantShift.record.constraint_state, 'PASS');
  assert.equal(policyCompliantShift.record.constraint_policy_id, activeSchedulingPolicy.id);
  assert.equal(policyCompliantShift.record.constraint_policy_version, 3);
  assert.deepEqual(policyCompliantShift.record.constraint_findings, []);
  assert.throws(() => repository.create('shift', {
    idempotency_key: 'shift-policy-max-daily-a', member_id: created.record.id,
    starts_at: '2026-12-20T15:00:00.000Z', ends_at: '2026-12-20T17:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, managerScopeA), error => error.code === 'WORKFORCE_SCHEDULING_CONSTRAINT_CONFLICT'
    && error.details?.assessment?.findings?.some(item => item.code === 'MAX_DAILY_HOURS'));

  assert.throws(() => repository.update('scheduling_policy', activeSchedulingPolicy.id, {
    expected_version: 2, name: 'Stale policy update',
  }, managerScopeA), error => error.code === 'WORKFORCE_VERSION_CONFLICT');
  const policyHistory = repository.listEntityHistory('scheduling_policy', activeSchedulingPolicy.id, managerScopeA);
  assert.ok(policyHistory.some(event => event.metadata.policy_version === 3
    && event.metadata.rules.max_shift_minutes === 540),
  'scheduling policy audit must preserve the exact rules used by each policy version');
  const policyB = repository.create('scheduling_policy', {
    idempotency_key: 'scheduling-policy-org-b', name: 'Other organization policy',
    effective_from: '2026-11-25', rules: { max_weekly_minutes: 2400 },
  }, { ...scopeB, actor: { role: 'manager' } });
  const activePolicyB = repository.activate('scheduling_policy', policyB.record.id, {
    expected_version: 1,
  }, { ...scopeB, actor: { role: 'manager' } });
  assert.equal(activePolicyB.status, 'ACTIVE');


  const replacementProfessional = repository.create('member', {
    idempotency_key: 'member-shift-reassignment', member_type: 'EMPLOYEE',
    display_name: 'Replacement Professional', primary_location_id: 'location-a',
    department_id: department.record.id, position_id: position.record.id,
  }, scopeA);
  const activeReplacementProfessional = repository.activate('member', replacementProfessional.record.id, { expected_version: 1 }, scopeA);
  const replacementEngagement = repository.create('engagement', {
    idempotency_key: 'engagement-shift-reassignment', member_id: replacementProfessional.record.id,
    engagement_type: 'EMPLOYMENT', starts_at: '2026-11-25T00:00:00.000Z', ends_at: '2026-12-25T15:00:00.000Z',
  }, scopeA);
  const submittedReplacementEngagement = repository.submit('engagement', replacementEngagement.record.id, { expected_version: 1 }, scopeA);
  repository.activate('engagement', replacementEngagement.record.id, { expected_version: submittedReplacementEngagement.version }, scopeA);
  const reassignedWithOverride = repository.reassignShift('shift', legacyLongShift.record.id, {
    expected_version: 1, member_id: activeReplacementProfessional.id,
    reason: 'Emergency coverage transfer',
    override_reason: 'Emergency coverage approved by manager',
  }, managerScopeA);
  assert.equal(reassignedWithOverride.constraint_state, 'BLOCKING_CONFLICT');
  assert.equal(reassignedWithOverride.constraint_policy_version, 3);
  assert.equal(reassignedWithOverride.constraint_override_reason, 'Emergency coverage approved by manager');
  assert.equal(reassignedWithOverride.constraint_override_by, managerScopeA.actor_id);
  assert.ok(reassignedWithOverride.constraint_override_at);
  const overrideHistory = repository.listEntityHistory('shift', legacyLongShift.record.id, managerScopeA);
  const overrideEvent = overrideHistory.find(event => event.action === 'workforce.shift.reassigned');
  assert.equal(overrideEvent?.metadata.constraint_state, 'BLOCKING_CONFLICT');
  assert.equal(overrideEvent?.metadata.constraint_override_reason, 'Emergency coverage approved by manager');
  assert.equal(overrideEvent?.metadata.constraint_policy_version, 3);
  assert.throws(() => repository.create('shift', {
    idempotency_key: 'shift-unauthorized-override', member_id: created.record.id,
    starts_at: '2026-12-22T06:00:00.000Z', ends_at: '2026-12-22T16:00:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
    override_reason: 'Emergency manager override requested',
  }, employeeScopeA), error => error.code === 'WORKFORCE_SCHEDULING_OVERRIDE_UNAUTHORIZED');

  const generatedShifts = repository.generateShiftsFromTemplate(shiftTemplate.record.id, {
    expected_version: activeTemplate.version,
    member_id: created.record.id,
    from_date: '2026-11-26',
    to_date: '2026-11-28',
    idempotency_key: 'shift-generation-batch-a',
  }, scopeA);
  assert.equal(generatedShifts.created_count, 2);
  assert.equal(generatedShifts.existing_count, 0);
  assert.equal(generatedShifts.conflict_count, 0);
  assert.equal(generatedShifts.skipped_count, 1, 'Saturday is excluded by the Monday-Friday template');
  assert.equal(generatedShifts.created_records[0].generated_local_date, '2026-11-26');
  assert.equal(generatedShifts.created_records[0].template_version, activeTemplate.version);
  assert.equal(generatedShifts.created_records[0].starts_at, '2026-11-26T05:00:00.000Z');
  assert.equal(generatedShifts.created_records[0].ends_at, '2026-11-26T13:30:00.000Z');
  assert.deepEqual(generatedShifts.created_records[0].break_rules, [{ starts_at: '2026-11-26T09:00:00.000Z', duration_minutes: 30 }]);
  assert.equal(generatedShifts.created_records[0].constraint_policy_version, 3);
  assert.equal(generatedShifts.created_records[0].constraint_state, 'PASS');
  const lateTemplate = repository.create('shift_template', {
    idempotency_key: 'shift-template-daily-limit', name: 'Late daily-limit template',
    start_local_time: '18:00', end_local_time: '20:00', timezone: 'Africa/Addis_Ababa',
    work_days: [4], effective_from: '2026-11-26',
  }, scopeA);
  const policyConflictGeneration = repository.generateShiftsFromTemplate(lateTemplate.record.id, {
    expected_version: lateTemplate.record.version, member_id: created.record.id,
    from_date: '2026-11-26', to_date: '2026-11-26', idempotency_key: 'daily-limit-generation',
  }, scopeA);
  assert.equal(policyConflictGeneration.created_count, 0);
  assert.equal(policyConflictGeneration.conflict_count, 1);
  assert.equal(policyConflictGeneration.conflicts[0].reason, 'WORKFORCE_SCHEDULING_CONSTRAINT_CONFLICT');
  assert.ok(policyConflictGeneration.conflicts[0].assessment.findings.some(item => item.code === 'MAX_DAILY_HOURS'));

  const generatedReplay = repository.generateShiftsFromTemplate(shiftTemplate.record.id, {
    expected_version: activeTemplate.version, member_id: created.record.id,
    from_date: '2026-11-26', to_date: '2026-11-28', idempotency_key: 'shift-generation-batch-a-replay',
  }, scopeA);
  assert.equal(generatedReplay.created_count, 0);
  assert.equal(generatedReplay.existing_count, 2, 'repeated generation must not duplicate dated shifts');
  const reassignedShift = repository.reassignShift('shift', generatedShifts.created_records[0].id, {
    expected_version: 1, member_id: activeReplacementProfessional.id, reason: 'Coverage transfer',
  }, scopeA);
  assert.equal(reassignedShift.member_id, activeReplacementProfessional.id);
  assert.equal(reassignedShift.version, 2);
  assert.equal(reassignedShift.constraint_policy_id, activeSchedulingPolicy.id);
  assert.equal(reassignedShift.constraint_policy_version, 3);
  assert.equal(reassignedShift.constraint_state, 'PASS');
  assert.throws(() => repository.reassignShift('shift', reassignedShift.id, {
    expected_version: 1, member_id: created.record.id, reason: 'Stale manager screen',
  }, scopeA), error => error.code === 'WORKFORCE_VERSION_CONFLICT');
  const shiftHistory = repository.listShiftHistory('shift', reassignedShift.id, scopeA);
  const reassignmentEvent = shiftHistory.find(event => event.action === 'workforce.shift.reassigned');
  assert.equal(reassignmentEvent?.metadata.from_member_id, created.record.id);
  assert.equal(reassignmentEvent?.metadata.to_member_id, activeReplacementProfessional.id);
  assert.equal(reassignmentEvent?.metadata.reason, 'Coverage transfer');
  assert.equal(reassignmentEvent?.metadata.constraint_policy_version, 3);
  assert.equal(reassignmentEvent?.metadata.constraint_state, 'PASS');
  assert.throws(() => repository.listShiftHistory('shift', reassignedShift.id, scopeB),
    error => error.code === 'WORKFORCE_SCOPE_NOT_FOUND', 'shift history must remain tenant-scoped');
  assert.throws(() => repository.cancel('shift', generatedShifts.created_records[1].id, { expected_version: 1 }, scopeA),
    error => error.code === 'WORKFORCE_SHIFT_CANCELLATION_REASON_REQUIRED');
  const cancelledGeneratedShift = repository.cancel('shift', generatedShifts.created_records[1].id, {
    expected_version: 1, reason: 'Branch closed for maintenance',
  }, scopeA);
  assert.equal(cancelledGeneratedShift.status, 'CANCELLED');
  const cancellationEvent = repository.listShiftHistory('shift', cancelledGeneratedShift.id, scopeA)
    .find(event => event.action === 'workforce.shift.cancel');
  assert.equal(cancellationEvent?.metadata.reason, 'Branch closed for maintenance');
  const templateAfterGeneration = repository.update('shift_template', shiftTemplate.record.id, {
    expected_version: activeTemplate.version, start_local_time: '09:00',
  }, scopeA);
  assert.equal(templateAfterGeneration.version, activeTemplate.version + 1);
  assert.equal(repository.get('shift', generatedShifts.created_records[0].id, scopeA).starts_at, '2026-11-26T05:00:00.000Z',
    'template edits must not rewrite already generated dated shifts');
  repository.create('shift', {
    idempotency_key: 'manual-overlap-shift', member_id: created.record.id, location_id: 'location-a',
    starts_at: '2026-11-30T05:00:00.000Z', ends_at: '2026-11-30T13:30:00.000Z',
    timezone: 'Africa/Addis_Ababa', break_rules: [],
  }, scopeA);
  const shiftUpdateCandidate = repository.create('shift', {
    idempotency_key: 'shift-update-candidate',
    member_id: created.record.id,
    location_id: 'location-a',
    starts_at: '2026-12-01T05:00:00.000Z',
    ends_at: '2026-12-01T06:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.throws(() => repository.update('shift', shiftUpdateCandidate.record.id, {
    expected_version: 1,
    starts_at: '2026-11-30T05:30:00.000Z',
    ends_at: '2026-11-30T06:30:00.000Z',
  }, scopeA), error => error.code === 'WORKFORCE_SCHEDULING_CONSTRAINT_CONFLICT',
  'shift updates must rerun overlap and active scheduling-policy checks inside the write transaction');
  const conflictedGeneration = repository.generateShiftsFromTemplate(shiftTemplate.record.id, {
    expected_version: templateAfterGeneration.version, member_id: created.record.id,
    from_date: '2026-11-30', to_date: '2026-11-30', idempotency_key: 'shift-generation-conflict',
  }, scopeA);
  assert.equal(conflictedGeneration.created_count, 0);
  assert.equal(conflictedGeneration.conflict_count, 1, 'overlapping dated shifts must be reported rather than duplicated');
  const suspendedEngagement = repository.suspend('engagement', engagement.record.id, { expected_version: 3 }, scopeA);
  const reactivatedEngagement = repository.activate('engagement', engagement.record.id, { expected_version: 4 }, scopeA);
  const endedEngagement = repository.end('engagement', engagement.record.id, { expected_version: 5 }, scopeA);
  assert.equal(submittedEngagement.status, 'PENDING_APPROVAL');
  assert.equal(activeEngagement.status, 'ACTIVE');
  assert.equal(suspendedEngagement.status, 'SUSPENDED');
  assert.equal(reactivatedEngagement.status, 'ACTIVE');
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
    weekly_schedule: [
      { day: 'TUESDAY', intervals: [{ start: '10:00', end: '16:00' }] },
      { day: 'WEDNESDAY', intervals: [{ start: '09:00', end: '17:00' }] },
    ],
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
  const assessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(assessment.state, 'UNAVAILABLE',
    'an explicit UNAVAILABLE availability window must prevent availability');
  assert.ok(assessment.findings.some(item => item.code === 'AVAILABILITY_WINDOW_BLOCK'
    && item.state === 'UNAVAILABLE'),
  'the assessment must explain the declared unavailable window');
  assert.equal(assessment.is_booking, false);
  assert.equal(assessment.source_versions.find(item => item.source === 'operational_commitments')?.status, 'COMPLETE',
    'linked members with no active Logistics delivery assignment have complete assignment evidence');
  assert.equal(assessment.source_versions.find(item => item.source === 'calendar')?.status, 'COMPLETE',
    'the weekly calendar is complete when the requested interval is covered in its IANA timezone');
  assert.ok(!assessment.findings.some(item => item.code === 'CALENDAR_SCHEDULE_EVALUATION_UNKNOWN'));
  const outsideCalendarAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T15:00:00.000Z',
    ends_at: '2026-11-25T15:30:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.ok(outsideCalendarAssessment.findings.some(item => item.code === 'CALENDAR_WORKING_HOURS_NOT_COVERED'
    && item.state === 'UNAVAILABLE'),
  'a request outside declared weekly working hours must be unavailable');
  db.prepare(`
    INSERT INTO service_bookings
      (id, organization_id, chat_id, status, requested_start, requested_end, workforce_member_id)
    VALUES (?, ?, ?, 'CONFIRMED', ?, ?, ?)
  `).run('booking-assessment-a', scopeA.organization_id, scopeA.chat_id,
    '2026-11-25T06:00:00.000Z', '2026-11-25T07:00:00.000Z', created.record.id);
  db.prepare('INSERT INTO orders(server_order_id, chat_id) VALUES (?, ?)').run('order-other-tenant', 'chat-a2');
  db.prepare(`
    INSERT INTO fulfillments(id, server_order_id, organization_id, fulfillment_type, scheduled_at)
    VALUES (?, ?, ?, 'delivery', ?)
  `).run('fulfillment-other-tenant', 'order-other-tenant', scopeA.organization_id, '2026-11-25T06:30:00.000Z');
  db.prepare(`
    INSERT INTO delivery_assignments
      (id, fulfillment_id, organization_id, courier_user_id, status, assigned_at, updated_at)
    VALUES (?, ?, ?, ?, 'ACCEPTED', ?, ?)
  `).run('delivery-assignment-other-tenant', 'fulfillment-other-tenant', scopeA.organization_id,
    'user-a', '2026-11-25T05:00:00.000Z', '2026-11-25T05:00:00.000Z');
  const crossTenantLogisticsAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(crossTenantLogisticsAssessment.source_versions
    .find(item => item.source === 'operational_commitments')?.status, 'COMPLETE',
  'a Logistics assignment belonging to another tenant in the same organization must not contaminate this assessment');
  assert.ok(!crossTenantLogisticsAssessment.findings.some(item =>
    item.code === 'LOGISTICS_DELIVERY_WINDOW_UNKNOWN'
      && item.record_id === 'delivery-assignment-other-tenant'));
  db.prepare('INSERT INTO orders(server_order_id, chat_id) VALUES (?, ?)').run('order-assessment-a', scopeA.chat_id);
  db.prepare(`
    INSERT INTO fulfillments(id, server_order_id, organization_id, fulfillment_type, scheduled_at)
    VALUES (?, ?, ?, 'delivery', ?)
  `).run('fulfillment-assessment-a', 'order-assessment-a', scopeA.organization_id, '2026-11-25T06:30:00.000Z');
  db.prepare(`
    INSERT INTO delivery_assignments
      (id, fulfillment_id, organization_id, courier_user_id, status, assigned_at, updated_at)
    VALUES (?, ?, ?, ?, 'ACCEPTED', ?, ?)
  `).run('delivery-assignment-assessment-a', 'fulfillment-assessment-a', scopeA.organization_id,
    'user-a', '2026-11-25T05:00:00.000Z', '2026-11-25T05:00:00.000Z');
  const logisticsAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.ok(logisticsAssessment.findings.some(item =>
    item.code === 'LOGISTICS_DELIVERY_WINDOW_UNKNOWN'
      && item.state === 'UNKNOWN'
      && item.record_id === 'delivery-assignment-assessment-a'),
  'an active Logistics delivery assignment without a bounded time window must fail closed');
  assert.equal(logisticsAssessment.source_versions
    .find(item => item.source === 'operational_commitments')?.status, 'MISSING');
  const externalMemberAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: externalMember.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(externalMemberAssessment.source_versions
    .find(item => item.source === 'operational_commitments')?.status, 'COMPLETE',
  'Logistics is not applicable to an unlinked external professional, while Service Booking evidence is still checked');
  const bookingAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(bookingAssessment.state, 'UNKNOWN',
    'unverified Logistics evidence keeps the aggregate result UNKNOWN');
  const recurringBlackout = repository.create('availability', {
    idempotency_key: 'availability-recurring-blackout-a',
    member_id: created.record.id,
    availability: 'BLACKOUT',
    starts_at: '2026-11-18T06:00:00.000Z',
    ends_at: '2026-11-18T15:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
    recurrence_rule: 'FREQ=WEEKLY;BYDAY=WE;COUNT=3',
    effective_from: '2026-11-18',
  }, scopeA);
  assert.equal(recurringBlackout.record.availability, 'BLACKOUT');
  const recurringBlackoutAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-12-02T06:00:00.000Z',
    ends_at: '2026-12-02T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(recurringBlackoutAssessment.source_versions.find(item => item.source === 'availability_windows')?.status, 'COMPLETE',
    'valid recurring windows must be evaluated instead of automatically marking the source missing');
  assert.ok(recurringBlackoutAssessment.findings.some(item =>
    item.code === 'AVAILABILITY_WINDOW_BLOCK' && item.record_id === recurringBlackout.record.id),
  'a matching recurring blackout occurrence must block the requested interval');
  const recurringBlackoutPartialOverlap = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-12-02T05:30:00.000Z',
    ends_at: '2026-12-02T06:30:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.ok(recurringBlackoutPartialOverlap.findings.some(item =>
    item.code === 'AVAILABILITY_WINDOW_BLOCK' && item.record_id === recurringBlackout.record.id),
  'a partial overlap with a recurring blackout must not be missed');
  const nonMatchingRecurringDay = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-12-03T06:00:00.000Z',
    ends_at: '2026-12-03T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.ok(!nonMatchingRecurringDay.findings.some(item =>
    item.code === 'AVAILABILITY_WINDOW_BLOCK' && item.record_id === recurringBlackout.record.id),
  'a recurring blackout must not be projected onto a non-matching weekday');
  db.prepare(`
    INSERT INTO workforce_calendar_exceptions
      (id, organization_id, tenant_id, chat_id, calendar_id, exception_type,
       starts_at, ends_at, all_day, reason, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'BLACKOUT', ?, NULL, 1, ?, 'ACTIVE', ?, ?)
  `).run('calendar-exception-open-ended-a', scopeA.organization_id, scopeA.tenant_id,
    scopeA.chat_id, calendar.record.id, '2026-11-25T06:00:00.000Z',
    'Open-ended blackout regression', '2026-11-24T12:00:00.000Z', '2026-11-24T12:00:00.000Z');
  const openEndedExceptionAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.ok(openEndedExceptionAssessment.findings.some(item =>
    item.code === 'CALENDAR_EXCEPTION_OVERLAP'
    && item.record_id === 'calendar-exception-open-ended-a'),
  'an active calendar exception with no end time must not be omitted from assessment');
  assert.ok(bookingAssessment.findings.some(item => item.code === 'SERVICE_BOOKING_COMMITMENT'),
    'confirmed Service Booking overlap must be included as an operational conflict');
  const assessmentEngagement = repository.create('engagement', {
    idempotency_key: 'assessment-engagement-a',
    member_id: created.record.id,
    engagement_type: 'CONTRACT',
    starts_at: '2026-11-25T00:00:00.000Z',
    ends_at: '2026-12-01T00:00:00.000Z',
  }, scopeA);
  repository.submit('engagement', assessmentEngagement.record.id, { expected_version: 1 }, scopeA);
  repository.activate('engagement', assessmentEngagement.record.id, { expected_version: 2 }, scopeA);
  const pendingAssessmentLeave = repository.create('leave_request', {
    idempotency_key: 'assessment-pending-leave-a',
    member_id: created.record.id,
    leave_category: 'PERSONAL',
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T08:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
    reason: 'Pending assessment leave',
  }, scopeA);
  repository.submit('leave_request', pendingAssessmentLeave.record.id, { expected_version: 1 }, scopeA);
  const pendingLeaveAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(pendingLeaveAssessment.state, 'UNKNOWN');
  assert.ok(pendingLeaveAssessment.findings.some(item => item.code === 'PENDING_LEAVE_OVERLAP'),
    'pending leave must remain UNKNOWN until an authorized decision');
  const dstCalendar = repository.create('calendar', {
    idempotency_key: 'calendar-create-dst-a',
    member_id: created.record.id,
    timezone: 'America/New_York',
    weekly_schedule: [{ day: 'SUNDAY', intervals: [{ start: '02:30', end: '04:00' }] }],
    holiday_calendar: [],
    effective_from: '2027-03-01',
  }, scopeA);
  assert.equal(dstCalendar.record.status, 'ACTIVE');
  const dstAssessment = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2027-03-14T07:30:00.000Z',
    ends_at: '2027-03-14T08:00:00.000Z',
    timezone: 'America/New_York',
  }, scopeA);
  assert.equal(dstAssessment.source_versions.find(item => item.source === 'calendar')?.status, 'MISSING',
    'a nonexistent DST wall-clock boundary must make calendar evidence incomplete');
  assert.ok(dstAssessment.findings.some(item => item.code === 'CALENDAR_SCHEDULE_EVALUATION_UNKNOWN'
    && item.state === 'UNKNOWN'),
  'DST gaps must fail closed rather than being shifted silently');
  const historicalCalendarAfterFutureCalendar = repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeA);
  assert.equal(historicalCalendarAfterFutureCalendar.source_versions
    .find(item => item.source === 'calendar')?.status, 'COMPLETE',
  'a future-dated active calendar must not shadow the effective calendar for an earlier interval');

  assert.ok(!assessment.findings.some(item => item.code === 'EVIDENCE_INCOMPLETE'
    || item.code === 'EVIDENCE_SOURCE_MISSING'),
  'complete source evidence must not be reported as missing');
  assert.throws(() => repository.assessAvailability({
    organization_id: scopeA.organization_id,
    tenant_id: scopeA.tenant_id,
    chat_id: scopeA.chat_id,
    member_id: created.record.id,
    starts_at: '2026-11-25T06:00:00.000Z',
    ends_at: '2026-11-25T07:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
  }, scopeB), error => error?.code === 'WORKFORCE_SCOPE_NOT_FOUND'
    || error?.code === 'WORKFORCE_FORBIDDEN');

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

  const allocationMember = repository.create('member', {
    idempotency_key: 'allocation-member-a',
    member_type: 'CONTRACTOR',
    display_name: 'Allocation Test Contractor',
    primary_location_id: 'location-a',
  }, scopeA);
  repository.activate('member', allocationMember.record.id, { expected_version: 1 }, scopeA);
  const allocationEngagement = repository.create('engagement', {
    idempotency_key: 'allocation-engagement-a',
    member_id: allocationMember.record.id,
    engagement_type: 'CONTRACT',
    starts_at: '2026-11-25T00:00:00.000Z',
    ends_at: '2026-12-01T00:00:00.000Z',
  }, scopeA);
  repository.submit('engagement', allocationEngagement.record.id, { expected_version: 1 }, scopeA);
  repository.activate('engagement', allocationEngagement.record.id, { expected_version: 2 }, scopeA);
  repository.create('calendar', {
    idempotency_key: 'allocation-calendar-a',
    member_id: allocationMember.record.id,
    timezone: 'Africa/Addis_Ababa',
    weekly_schedule: [{ day: 'WEDNESDAY', intervals: [{ start: '09:00', end: '17:00' }] }],
    holiday_calendar: [],
    effective_from: '2026-11-25',
  }, scopeA);
  repository.create('availability', {
    idempotency_key: 'allocation-availability-a',
    member_id: allocationMember.record.id,
    availability: 'AVAILABLE',
    starts_at: '2026-11-25T08:00:00.000Z',
    ends_at: '2026-11-25T09:00:00.000Z',
    timezone: 'Africa/Addis_Ababa',
    effective_from: '2026-11-25',
  }, scopeA);
  const allocation = repository.create('allocation', {
    idempotency_key: 'allocation-create-a',
    member_id: allocationMember.record.id,
    resource_id: 'resource-a',
    booking_id: 'booking-a',
    starts_at: '2026-11-25T08:00:00.000Z',
    ends_at: '2026-11-25T09:00:00.000Z',
  }, scopeA);
  const submittedAllocation = repository.submit('allocation', allocation.record.id, { expected_version: 1 }, scopeA);
  const approvedAllocation = repository.approve('allocation', allocation.record.id, { expected_version: 2 }, scopeA);
  assert.throws(() => repository.update('allocation', allocation.record.id, {
    expected_version: 3, starts_at: '2026-11-25T09:00:00.000Z',
  }, scopeA), error => error.code === 'WORKFORCE_ALLOCATION_LOCKED',
  'committed allocations cannot be edited through the generic update path');
  const overlappingAllocation = repository.create('allocation', {
    idempotency_key: 'allocation-overlap-a',
    member_id: allocationMember.record.id,
    resource_id: 'resource-a',
    booking_id: 'booking-a',
    starts_at: '2026-11-25T08:00:00.000Z',
    ends_at: '2026-11-25T09:00:00.000Z',
  }, scopeA);
  repository.submit('allocation', overlappingAllocation.record.id, { expected_version: 1 }, scopeA);
  assert.throws(() => repository.approve('allocation', overlappingAllocation.record.id, {
    expected_version: 2,
  }, scopeA), error => error.code === 'WORKFORCE_ALLOCATION_AVAILABILITY_NOT_CONFIRMED',
  'overlapping committed allocations must block approval');
  repository.cancel('allocation', overlappingAllocation.record.id, { expected_version: 2 }, scopeA);
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
  const beforeNoopUpdate = repository.get('member', created.record.id, scopeA);
  assert.throws(() => repository.update('member', created.record.id, {
    expected_version: beforeNoopUpdate.version, user_id: 'user-b',
  }, scopeA), error => error.code === 'WORKFORCE_UPDATE_EMPTY');

  const beforeSuspend = repository.get('member', created.record.id, scopeA);
  const suspendedMember = repository.suspend('member', created.record.id, { expected_version: beforeSuspend.version }, scopeA);
  const deactivatedMember = repository.deactivate('member', created.record.id, { expected_version: suspendedMember.version }, scopeA);
  assert.equal(suspendedMember.status, 'SUSPENDED');
  assert.equal(deactivatedMember.status, 'INACTIVE');

  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  assert.ok(db.prepare("SELECT COUNT(*) AS count FROM audit_events WHERE action LIKE 'workforce.%'").get().count >= 4);

  console.log('PASS Workforce SQLite repository: all entity CRUD/lifecycle paths, idempotency, optimistic concurrency, authorization, tenant/organization isolation, resource and provider scoping');
} finally {
  db.close();
  rmSync(directory, { recursive: true, force: true });
}
