import assert from 'node:assert/strict';
import { WORKFORCE_MEMBER_OPTIONAL_FIELDS } from '../backend/lib/workforce-member-contract.js';
import {
  WORKFORCE_MEMBER_CONTRACT_VERSION,
  WORKFORCE_MEMBER_PERMISSIONS,
  WORKFORCE_MEMBER_TRANSITIONS,
  workforceMemberContract,
  canTransitionWorkforceMemberStatus,
  validateWorkforceMemberCreate,
  validateWorkforceMemberUpdate,
  validateWorkforceMemberLifecycle,
  workforceMemberLifecyclePermission,
} from '../backend/lib/workforce-member-contract.js';

const contract = workforceMemberContract();

assert.equal(contract.contract_version, WORKFORCE_MEMBER_CONTRACT_VERSION);
assert.equal(contract.capability, 'workforce.membership');
assert.equal(contract.entity, 'workforce_member');
assert.equal(contract.organization_scoped, true);
assert.equal(contract.reuses_existing_user_identity, true);
assert.equal(contract.reuses_existing_organization_authority, true);
assert.equal(contract.creates_duplicate_user_identity, false);

assert.deepEqual(contract.permissions, WORKFORCE_MEMBER_PERMISSIONS);
assert.deepEqual(contract.transitions, WORKFORCE_MEMBER_TRANSITIONS);

assert.equal(canTransitionWorkforceMemberStatus('DRAFT', 'ACTIVE'), true);
assert.equal(canTransitionWorkforceMemberStatus('ACTIVE', 'SUSPENDED'), true);
assert.equal(canTransitionWorkforceMemberStatus('ACTIVE', 'INACTIVE'), true);
assert.equal(canTransitionWorkforceMemberStatus('SUSPENDED', 'ACTIVE'), true);
assert.equal(canTransitionWorkforceMemberStatus('SUSPENDED', 'INACTIVE'), true);
assert.equal(canTransitionWorkforceMemberStatus('INACTIVE', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceMemberStatus('DRAFT', 'SUSPENDED'), false);
assert.equal(canTransitionWorkforceMemberStatus('DRAFT', 'INACTIVE'), false);
assert.equal(canTransitionWorkforceMemberStatus('ACTIVE', 'DRAFT'), false);
assert.equal(canTransitionWorkforceMemberStatus('UNKNOWN', 'ACTIVE'), false);
assert.equal(canTransitionWorkforceMemberStatus('ACTIVE', 'UNKNOWN'), false);

const validExternalCreate = validateWorkforceMemberCreate({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_type: 'CONTRACTOR',
  idempotency_key: 'member-create-external-1',
});
assert.equal(validExternalCreate.valid, true, 'external professionals do not require a Sellify user');
assert.ok(WORKFORCE_MEMBER_OPTIONAL_FIELDS.includes('employee_number'));
assert.equal(validateWorkforceMemberCreate({ organization_id: 'org-1', chat_id: 'chat-1', member_type: 'EMPLOYEE', idempotency_key: 'm2', employee_number: 'EMP-1' }).valid, true);
assert.equal(validateWorkforceMemberCreate({ organization_id: 'org-1', chat_id: 'chat-1', member_type: 'EMPLOYEE', idempotency_key: 'm3', employee_number: 123 }).valid, false);
assert.deepEqual(validExternalCreate.errors, []);

const validCreate = validateWorkforceMemberCreate({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  user_id: 'user-1',
  member_type: 'EMPLOYEE',
  idempotency_key: 'member-create-1',
});
assert.equal(validCreate.valid, true);
assert.deepEqual(validCreate.errors, []);

const invalidCreate = validateWorkforceMemberCreate({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_type: 'MANAGER',
});
assert.equal(invalidCreate.valid, false);
assert.ok(invalidCreate.errors.includes('Missing required field: idempotency_key'));
assert.ok(invalidCreate.errors.includes('Invalid member_type: MANAGER'));

const validUpdate = validateWorkforceMemberUpdate({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  expected_version: 2,
  member_type: 'CONTRACTOR',
});
assert.equal(validUpdate.valid, true);
assert.deepEqual(validUpdate.errors, []);

const invalidUpdate = validateWorkforceMemberUpdate({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  expected_version: 0,
  member_type: 'MANAGER',
});
assert.equal(invalidUpdate.valid, false);
assert.ok(invalidUpdate.errors.includes('expected_version must be a positive integer'));
assert.ok(invalidUpdate.errors.includes('Invalid member_type: MANAGER'));

const validLifecycle = validateWorkforceMemberLifecycle({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  expected_version: 3,
});
assert.equal(validLifecycle.valid, true);
assert.deepEqual(validLifecycle.errors, []);

const invalidLifecycle = validateWorkforceMemberLifecycle({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  expected_version: 'three',
});
assert.equal(invalidLifecycle.valid, false);
assert.ok(invalidLifecycle.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceMemberLifecyclePermission('activate'), 'workforce:member:activate');
assert.equal(workforceMemberLifecyclePermission('suspend'), 'workforce:member:suspend');
assert.equal(workforceMemberLifecyclePermission('update'), 'workforce:member:manage');

console.log('Workforce member lifecycle contract regression: PASS');
