import assert from 'node:assert/strict';
import {
  WORKFORCE_REPOSITORY_CONTRACT_VERSION,
  WORKFORCE_REPOSITORY_ENTITIES,
  WORKFORCE_REPOSITORY_OPERATIONS,
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
assert.equal(capability.supports_tenant_scope, true);
assert.equal(capability.supports_idempotency, true);
assert.equal(capability.supports_optimistic_concurrency, true);
assert.equal(capability.supports_authorization, true);
assert.equal(capability.supports_audit_provenance, true);

console.log('Workforce repository contract regression: PASS');
