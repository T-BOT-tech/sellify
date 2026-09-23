import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import {
  executeApprovedVerticalMutation,
  assertVerticalApprovalBoundary,
  VerticalApprovalRequiredError,
  VerticalApprovalDeniedError,
  verticalApprovalBoundaryContract,
} from '../backend/lib/vertical-approval-boundary.js';
import { RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';
import { VerticalMutationDeniedError } from '../backend/lib/vertical-mutation-enforcement.js';

const session = {
  userId: 'user-1', sessionId: 'session-1', chatId: 'chat-1',
  organizationId: 'org-1', locationId: 'loc-1', role: 'owner',
};
const tenant = { chatId: 'chat-1', organizationId: 'org-1' };
const location = { id: 'loc-1', organizationId: 'org-1' };
const entry = RESOURCE_ACTION_REGISTRY.find(
  (candidate) => candidate.packId === 'restaurant' && candidate.resource === 'table' && candidate.action === 'manage',
);
assert.ok(entry);

let pass = 0;
const check = async (name, fn) => { await fn(); pass += 1; console.log(`PASS ${name}`); };

await check('approval boundary remains persistence-neutral', () => {
  const contract = verticalApprovalBoundaryContract();
  assert.equal(contract.authorization_authority, 'backend/lib/authorization.js');
  assert.equal(contract.mutation_authority, 'backend/lib/vertical-mutation-enforcement.js');
  assert.equal(contract.approval_authority, 'external_existing_or_future_approval_workflow');
  assert.deepEqual(contract.approval_evidence, ['status', 'approvedBy', 'approvedAt']);
  assert.equal(contract.requires_approval, 'approval_evidence_required_before_mutation');
  assert.equal(contract.persistence, 'none');
  assert.equal(contract.approval_store, 'none');
  assert.equal(contract.audit_store, 'none');
  assert.equal(contract.event_store, 'none');
  assert.equal(contract.configuration_store, 'none');
});

await check('REQUIRES_APPROVAL blocks without evidence', () => {
  assert.throws(
    () => assertVerticalApprovalBoundary(AUTHZ.REQUIRES_APPROVAL, {
      packId: entry.packId, resource: entry.resource, action: entry.action,
    }),
    (error) => error instanceof VerticalApprovalRequiredError && error.code === 'VERTICAL_APPROVAL_REQUIRED',
  );
});

await check('REQUIRES_APPROVAL blocks incomplete evidence', () => {
  assert.throws(
    () => assertVerticalApprovalBoundary(AUTHZ.REQUIRES_APPROVAL, {
      packId: entry.packId, resource: entry.resource, action: entry.action,
      approval: { status: 'APPROVED', approvedBy: 'approver-1' },
    }),
    (error) => error instanceof VerticalApprovalRequiredError,
  );
});

await check('REQUIRES_APPROVAL accepts complete evidence without creating approval authority', () => {
  assert.equal(
    assertVerticalApprovalBoundary(AUTHZ.REQUIRES_APPROVAL, {
      packId: entry.packId, resource: entry.resource, action: entry.action,
      approval: { status: 'APPROVED', approvedBy: 'approver-1', approvedAt: '2026-09-08T19:00:00Z' },
    }),
    AUTHZ.ALLOW,
  );
});

await check('DENY remains denied at approval boundary', () => {
  assert.throws(
    () => assertVerticalApprovalBoundary(AUTHZ.DENY, {
      packId: entry.packId, resource: entry.resource, action: entry.action,
    }),
    (error) => error instanceof VerticalMutationDeniedError && error.decision === AUTHZ.DENY,
  );
});

await check('invalid approval evidence is not treated as approval', () => {
  assert.throws(
    () => assertVerticalApprovalBoundary(AUTHZ.REQUIRES_APPROVAL, {
      packId: entry.packId, resource: entry.resource, action: entry.action,
      approval: { status: 'REJECTED', approvedBy: 'approver-1', approvedAt: '2026-09-08T19:00:00Z' },
    }),
    (error) => error instanceof VerticalApprovalRequiredError,
  );
});

await check('normal ALLOW path still executes through mutation gate', async () => {
  let calls = 0;
  const result = await executeApprovedVerticalMutation(
    session, tenant, entry.packId, entry.resource, entry.action,
    { location, mutation: () => { calls += 1; return 'canonical'; } },
  );
  assert.equal(result, 'canonical');
  assert.equal(calls, 1);
});

await check('REQUIRES_APPROVAL without evidence cannot reach mutation callback', async () => {
  let calls = 0;
  await assert.rejects(
    executeApprovedVerticalMutation(
      session, tenant, entry.packId, entry.resource, entry.action,
      { location, decision: AUTHZ.REQUIRES_APPROVAL, mutation: () => { calls += 1; } },
    ),
    (error) => error instanceof VerticalApprovalRequiredError,
  );
  assert.equal(calls, 0);
});

await check('approval evidence does not bypass canonical authorization', async () => {
  let calls = 0;
  const deniedSession = { ...session, role: 'viewer' };
  await assert.rejects(
    executeApprovedVerticalMutation(
      deniedSession, tenant, entry.packId, entry.resource, entry.action,
      {
        location,
        decision: AUTHZ.REQUIRES_APPROVAL,
        approval: { status: 'APPROVED', approvedBy: 'approver-1', approvedAt: '2026-09-08T19:00:00Z' },
        mutation: () => { calls += 1; },
      },
    ),
    (error) => error instanceof VerticalMutationDeniedError && error.decision === AUTHZ.DENY,
  );
  assert.equal(calls, 0);
});

await check('current Phase 10.3 policy remains unchanged', () => {
  assert.equal(authorize(session, tenant.organizationId, location, entry.resource, entry.permission), AUTHZ.ALLOW);
});

await check('no approval persistence/evaluator authority introduced', () => {
  const source = fs.readFileSync(path.resolve('backend/lib/vertical-approval-boundary.js'), 'utf8');
  assert.doesNotMatch(source, /store-sqlite|ROLE_PERMISSIONS|RolePermissionStore|permissionStore|approvalStore|CREATE TABLE|INSERT INTO|UPDATE .*approval/i);
});

await check('later-phase boundaries remain deferred', () => {
  const source = fs.readFileSync(path.resolve('backend/lib/vertical-approval-boundary.js'), 'utf8');
  assert.doesNotMatch(source, /recordAuditEvent|publishEvent|from ['"]\.\/.*(?:audit|event|outbox|config)/i);
});

console.log('Phase 13.12.9 Approval Boundary Regression: PASS');
console.log(`Golden assertions: ${pass} PASS / 0 FAIL`);
console.log('REQUIRES_APPROVAL blocks mutation without approval evidence: PASS');
console.log('Approval evidence cannot bypass canonical authorization: PASS');
console.log('No approval persistence/evaluator authority introduced: BLOCKED');
console.log('Audit / events / configuration remain deferred: PASS');
