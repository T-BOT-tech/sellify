import assert from 'node:assert/strict';
import {
  WORKFORCE_REPOSITORY_CONTRACT_VERSION,
  WORKFORCE_REPOSITORY_ENTITIES,
  WORKFORCE_REPOSITORY_OPERATIONS,
  WORKFORCE_REPOSITORY_ENTITY_OPERATIONS,
  workforceRepositoryContract,
  validateWorkforceRepositoryContext,
  validateWorkforceRepositoryOperation,
  workforceRepositoryCapability,
} from '../backend/lib/workforce-repository-contract.js';

const contract = workforceRepositoryContract();

assert.equal(contract.contract_version, WORKFORCE_REPOSITORY_CONTRACT_VERSION);
assert.equal(contract.capability, 'workforce.membership');
assert.equal(contract.persistence_ready, true);
assert.equal(contract.organization_scoped, true);
assert.equal(contract.tenant_scoped, true);
assert.equal(contract.reuses_existing_user_identity, true);
assert.equal(contract.reuses_existing_organization_authority, true);
assert.equal(contract.creates_duplicate_user_identity, false);
assert.deepEqual(contract.entities, WORKFORCE_REPOSITORY_ENTITIES);
assert.deepEqual(contract.operations, WORKFORCE_REPOSITORY_OPERATIONS);
assert.deepEqual(contract.entity_operations, WORKFORCE_REPOSITORY_ENTITY_OPERATIONS);
assert.equal(contract.entity_specific_lifecycle, true);
assert.ok(contract.entities.includes('calendar_exception'));
assert.ok(contract.entities.includes('department'));
assert.ok(contract.entities.includes('position'));
assert.ok(contract.entities.includes('shift_template'));
assert.ok(contract.entities.includes('leave_request'));
assert.ok(contract.entities.includes('absence'));
assert.ok(contract.entities.includes('scheduling_policy'));
assert.ok(contract.entity_operations.scheduling_policy.includes('activate'));
assert.ok(contract.entity_operations.scheduling_policy.includes('deactivate'));
assert.equal(contract.supports_versioned_scheduling_policies, true);
assert.ok(contract.entity_operations.leave_request.includes('approve'));
assert.ok(contract.entity_operations.leave_request.includes('withdraw'));
assert.ok(contract.entity_operations.absence.includes('void'));
assert.ok(contract.entity_operations.shift.includes('reassign'));
assert.equal(workforceRepositoryCapability().supports_versioned_scheduling_policies, true);
assert.ok(contract.entity_operations.shift_template.includes('deactivate'));
assert.ok(contract.entity_operations.shift_template.includes('activate'));
assert.ok(contract.entity_operations.shift_template.includes('generate'));
assert.ok(contract.entity_operations.department.includes('deactivate'));
assert.ok(contract.entity_operations.position.includes('activate'));
assert.ok(contract.entity_operations.shift.includes('confirm'));
assert.ok(contract.entity_operations.shift.includes('complete'));
assert.ok(contract.entity_operations.allocation.includes('approve'));
assert.ok(contract.entity_operations.allocation.includes('release'));
assert.ok(contract.entity_operations.engagement.includes('end'));
assert.ok(contract.entity_operations.member.includes('link_account'));
assert.ok(contract.entity_operations.member.includes('unlink_account'));

const validContext = validateWorkforceRepositoryContext({
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
});
assert.equal(validContext.valid, true);
assert.deepEqual(validContext.errors, []);

const invalidContext = validateWorkforceRepositoryContext({});
assert.equal(invalidContext.valid, false);
assert.ok(invalidContext.errors.includes('Missing required context: organization_id'));
assert.ok(invalidContext.errors.includes('Missing required context: tenant_id'));

const validCreate = validateWorkforceRepositoryOperation('member', 'create', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  idempotency_key: 'member-create-1',
});
assert.equal(validCreate.valid, true);
assert.deepEqual(validCreate.errors, []);

const invalidCreate = validateWorkforceRepositoryOperation('member', 'create', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
});
assert.equal(invalidCreate.valid, false);
assert.ok(invalidCreate.errors.includes('Missing required idempotency_key for create'));

const validUpdate = validateWorkforceRepositoryOperation('member', 'update', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  expected_version: 2,
});
assert.equal(validUpdate.valid, true);
assert.deepEqual(validUpdate.errors, []);

const invalidUpdate = validateWorkforceRepositoryOperation('member', 'update', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  expected_version: 0,
});
assert.equal(invalidUpdate.valid, false);
assert.ok(invalidUpdate.errors.includes('expected_version must be a positive integer'));

const invalidLifecycleForEntity = validateWorkforceRepositoryOperation('shift', 'activate', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  expected_version: 1,
});
assert.equal(invalidLifecycleForEntity.valid, false);
assert.ok(invalidLifecycleForEntity.errors.includes('Operation activate is not supported for entity: shift'));

const validAccountLink = validateWorkforceRepositoryOperation('member', 'link_account', {
  organization_id: 'org-1', tenant_id: 'tenant-1', expected_version: 1,
});
assert.equal(validAccountLink.valid, true);
const validAccountUnlink = validateWorkforceRepositoryOperation('member', 'unlink_account', {
  organization_id: 'org-1', tenant_id: 'tenant-1', expected_version: 2,
});
assert.equal(validAccountUnlink.valid, true);

const validShiftConfirm = validateWorkforceRepositoryOperation('shift', 'confirm', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  expected_version: 2,
});
assert.equal(validShiftConfirm.valid, true);

const validAllocationApprove = validateWorkforceRepositoryOperation('allocation', 'approve', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  expected_version: 2,
});
assert.equal(validAllocationApprove.valid, true);

const invalidEntity = validateWorkforceRepositoryOperation('team', 'create', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  idempotency_key: 'team-create-1',
});
assert.equal(invalidEntity.valid, false);
assert.ok(invalidEntity.errors.includes('Invalid entity: team'));

const invalidOperation = validateWorkforceRepositoryOperation('member', 'archive', {
  organization_id: 'org-1',
  tenant_id: 'tenant-1',
  expected_version: 1,
});
assert.equal(invalidOperation.valid, false);
assert.ok(invalidOperation.errors.includes('Invalid operation: archive'));

const capability = workforceRepositoryCapability();
assert.equal(capability.supports_organization_scope, true);
assert.equal(capability.supports_resource_scope, true);
assert.equal(capability.supports_entity_specific_lifecycle, true);
assert.equal(capability.supports_tenant_scope, true);
assert.equal(capability.supports_idempotency, true);
assert.equal(capability.supports_optimistic_concurrency, true);
assert.equal(capability.supports_authorization, true);
assert.equal(capability.supports_audit_provenance, true);
assert.equal(capability.supports_leave_request_approval, true);
assert.equal(capability.supports_unplanned_absence_recording, true);
assert.equal(capability.pending_leave_blocks_availability, false);
assert.equal(capability.approved_leave_blocks_availability, true);
assert.equal(capability.recorded_absence_blocks_availability, true);
const validLeaveSubmit = validateWorkforceRepositoryOperation('leave_request','submit',{ organization_id:'org-1',tenant_id:'tenant-1',expected_version:1 });
assert.equal(validLeaveSubmit.valid,true);
const validAbsenceVoid = validateWorkforceRepositoryOperation('absence','void',{ organization_id:'org-1',tenant_id:'tenant-1',expected_version:1 });
assert.equal(validAbsenceVoid.valid,true);

console.log('Workforce repository contract regression: PASS');
