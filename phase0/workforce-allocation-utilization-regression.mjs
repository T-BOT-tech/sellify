import assert from 'node:assert/strict';
import {
  WORKFORCE_ALLOCATION_CONTRACT_VERSION,
  WORKFORCE_ALLOCATION_PERMISSIONS,
  WORKFORCE_ALLOCATION_TRANSITIONS,
  workforceAllocationContract,
  canTransitionWorkforceAllocationState,
  validateWorkforceAllocation,
  workforceAllocationPermission,
} from '../backend/lib/workforce-allocation-contract.js';
import {
  WORKFORCE_UTILIZATION_CONTRACT_VERSION,
  WORKFORCE_UTILIZATION_PERMISSIONS,
  workforceUtilizationContract,
  isValidWorkforceUtilizationStatus,
  validateWorkforceUtilization,
  workforceUtilizationPermission,
} from '../backend/lib/workforce-utilization-contract.js';

const allocationContract = workforceAllocationContract();

assert.equal(allocationContract.contract_version, WORKFORCE_ALLOCATION_CONTRACT_VERSION);
assert.equal(allocationContract.capability, 'workforce.membership');
assert.equal(allocationContract.entity, 'workforce_allocation');
assert.equal(allocationContract.organization_scoped, true);
assert.equal(allocationContract.member_scoped, true);
assert.equal(allocationContract.resource_scoped, true);
assert.equal(allocationContract.booking_scoped, true);
assert.equal(allocationContract.operational_task_scoped, true);
assert.equal(allocationContract.reuses_existing_user_identity, true);
assert.equal(allocationContract.reuses_existing_organization_authority, true);
assert.equal(allocationContract.creates_duplicate_user_identity, false);
assert.deepEqual(allocationContract.transitions, WORKFORCE_ALLOCATION_TRANSITIONS);
assert.deepEqual(allocationContract.permissions, WORKFORCE_ALLOCATION_PERMISSIONS);

assert.equal(canTransitionWorkforceAllocationState('DRAFT', 'PENDING_APPROVAL'), true);
assert.equal(canTransitionWorkforceAllocationState('DRAFT', 'CANCELLED'), true);
assert.equal(canTransitionWorkforceAllocationState('PENDING_APPROVAL', 'COMMITTED'), true);
assert.equal(canTransitionWorkforceAllocationState('PENDING_APPROVAL', 'CANCELLED'), true);
assert.equal(canTransitionWorkforceAllocationState('COMMITTED', 'RELEASED'), true);
assert.equal(canTransitionWorkforceAllocationState('COMMITTED', 'CANCELLED'), true);
assert.equal(canTransitionWorkforceAllocationState('RELEASED', 'COMMITTED'), false);
assert.equal(canTransitionWorkforceAllocationState('CANCELLED', 'COMMITTED'), false);
assert.equal(canTransitionWorkforceAllocationState('DRAFT', 'COMMITTED'), false);
assert.equal(canTransitionWorkforceAllocationState('UNKNOWN', 'COMMITTED'), false);
assert.equal(canTransitionWorkforceAllocationState('COMMITTED', 'UNKNOWN'), false);

const validAllocation = validateWorkforceAllocation({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  starts_at: '2026-01-01T09:00:00.000Z',
  ends_at: '2026-01-01T17:00:00.000Z',
  expected_version: 1,
});
assert.equal(validAllocation.valid, true);
assert.deepEqual(validAllocation.errors, []);

const invalidAllocation = validateWorkforceAllocation({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  starts_at: '2026-01-01T17:00:00.000Z',
  ends_at: '2026-01-01T09:00:00.000Z',
  expected_version: 0,
});
assert.equal(invalidAllocation.valid, false);
assert.ok(invalidAllocation.errors.includes('starts_at must be before ends_at'));
assert.ok(invalidAllocation.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceAllocationPermission('view'), 'workforce:allocation:view');
assert.equal(workforceAllocationPermission('release'), 'workforce:allocation:release');
assert.equal(workforceAllocationPermission('update'), 'workforce:allocation:manage');

const utilizationContract = workforceUtilizationContract();

assert.equal(utilizationContract.contract_version, WORKFORCE_UTILIZATION_CONTRACT_VERSION);
assert.equal(utilizationContract.capability, 'workforce.membership');
assert.equal(utilizationContract.entity, 'workforce_utilization_event');
assert.equal(utilizationContract.organization_scoped, true);
assert.equal(utilizationContract.member_scoped, true);
assert.equal(utilizationContract.resource_scoped, true);
assert.equal(utilizationContract.booking_scoped, true);
assert.equal(utilizationContract.operational_task_scoped, true);
assert.equal(utilizationContract.reuses_existing_user_identity, true);
assert.equal(utilizationContract.reuses_existing_organization_authority, true);
assert.equal(utilizationContract.creates_duplicate_user_identity, false);
assert.deepEqual(utilizationContract.permissions, WORKFORCE_UTILIZATION_PERMISSIONS);

assert.equal(isValidWorkforceUtilizationStatus('PLANNED'), true);
assert.equal(isValidWorkforceUtilizationStatus('IN_PROGRESS'), true);
assert.equal(isValidWorkforceUtilizationStatus('COMPLETED'), true);
assert.equal(isValidWorkforceUtilizationStatus('CANCELLED'), true);
assert.equal(isValidWorkforceUtilizationStatus('ARCHIVED'), false);

const validUtilization = validateWorkforceUtilization({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  planned_starts_at: '2026-01-01T09:00:00.000Z',
  planned_ends_at: '2026-01-01T17:00:00.000Z',
  actual_starts_at: '2026-01-01T09:10:00.000Z',
  actual_ends_at: '2026-01-01T17:05:00.000Z',
  status: 'COMPLETED',
  evidence_source: 'SHIFT_COMPLETION',
  expected_version: 1,
});
assert.equal(validUtilization.valid, true);
assert.deepEqual(validUtilization.errors, []);

const invalidUtilization = validateWorkforceUtilization({
  organization_id: 'org-1',
  chat_id: 'chat-1',
  member_id: 'member-1',
  planned_starts_at: '2026-01-01T17:00:00.000Z',
  planned_ends_at: '2026-01-01T09:00:00.000Z',
  actual_starts_at: '2026-01-01T17:05:00.000Z',
  actual_ends_at: '2026-01-01T09:10:00.000Z',
  status: 'ARCHIVED',
  evidence_source: 'SHIFT_COMPLETION',
  expected_version: 0,
});
assert.equal(invalidUtilization.valid, false);
assert.ok(invalidUtilization.errors.includes('planned_starts_at must be before planned_ends_at'));
assert.ok(invalidUtilization.errors.includes('actual_starts_at must be before actual_ends_at'));
assert.ok(invalidUtilization.errors.includes('Invalid status: ARCHIVED'));
assert.ok(invalidUtilization.errors.includes('expected_version must be a positive integer'));

assert.equal(workforceUtilizationPermission('view'), 'workforce:utilization:view');
assert.equal(workforceUtilizationPermission('update'), 'workforce:utilization:manage');

console.log('Workforce allocation and utilization contract regression: PASS');
