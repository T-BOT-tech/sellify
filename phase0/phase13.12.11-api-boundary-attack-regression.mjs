import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import { assertTenantScope, assertLocationScope } from '../backend/lib/tenant-isolation.js';
import { authorizeVerticalCapability } from '../backend/lib/vertical-capability-authorization.js';
import { executeAuthorizedVerticalMutation } from '../backend/lib/vertical-mutation-enforcement.js';
import { assertVerticalApprovalBoundary } from '../backend/lib/vertical-approval-boundary.js';
import { buildSensitiveActionAuditRecord, recordSensitiveActionAudit } from '../backend/lib/vertical-sensitive-audit-boundary.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverSource = fs.readFileSync(path.join(ROOT, 'backend/server.js'), 'utf8');
let passed = 0;
async function ok(name, fn) { await fn(); passed += 1; console.log(`PASS: ${name}`); }
function denied(fn) { assert.throws(fn); passed += 1; }

const tenantA = { chatId: 'chat-a', organizationId: 'org-a' };
const tenantB = { chatId: 'chat-b', organizationId: 'org-b' };
const locationA = { id: 'loc-a', organizationId: 'org-a' };
const locationB = { id: 'loc-b', organizationId: 'org-b' };
const owner = { userId: 'u-owner', chatId: 'chat-a', organizationId: 'org-a', locationId: 'loc-a', role: 'owner', deviceId: 'dev-a' };
const staff = { userId: 'u-staff', chatId: 'chat-a', organizationId: 'org-a', locationId: 'loc-a', role: 'staff', deviceId: 'dev-a' };

await ok('Missing actor is denied by canonical authorization', () => assert.equal(authorize(null, tenantA.organizationId, null, 'orders', 'orders:create'), AUTHZ.DENY));
await ok('Forged role string does not escalate', () => assert.equal(authorize({ ...staff, role: 'owner;manager' }, tenantA.organizationId, null, 'orders', 'orders:delete'), AUTHZ.DENY));
await ok('Forged wildcard permission does not escalate non-owner', () => assert.equal(authorize(staff, tenantA.organizationId, null, 'agriculture', '*'), AUTHZ.DENY));
await ok('Cross-organization tenant substitution is denied', () => denied(() => assertTenantScope(owner, tenantB)));
await ok('Foreign-organization location is denied', () => denied(() => assertLocationScope(owner, tenantA, locationB)));
await ok('Same-organization location remains allowed', () => assert.doesNotThrow(() => assertLocationScope(owner, tenantA, locationA)));
await ok('Unknown vertical capability fails closed', () => assert.equal(authorizeVerticalCapability(owner, tenantA, 'agriculture', 'not_real', 'manage'), AUTHZ.DENY));
await ok('Policy-neutral vertical capability fails closed even for owner', () => assert.equal(authorizeVerticalCapability(owner, tenantA, 'logistics', 'shipment', 'manage'), AUTHZ.DENY));
await ok('Foreign tenant cannot reach vertical capability', () => denied(() => authorizeVerticalCapability(owner, tenantB, 'agriculture', 'farm', 'manage')));
await ok('Foreign location cannot reach vertical capability', () => denied(() => authorizeVerticalCapability(owner, tenantA, 'agriculture', 'farm', 'manage', { location: locationB })));
await ok('Forged approval evidence does not bypass canonical authorization', () => {
  assert.throws(() => assertVerticalApprovalBoundary(AUTHZ.DENY, { packId: 'agriculture', resource: 'farm', action: 'manage', approval: { status: 'APPROVED', approvedBy: 'attacker', approvedAt: new Date().toISOString() } }));
});
await ok('Incomplete approval evidence is rejected', () => denied(() => assertVerticalApprovalBoundary(AUTHZ.REQUIRES_APPROVAL, { packId: 'agriculture', resource: 'farm', action: 'manage', approval: { status: 'APPROVED', approvedBy: 'u-owner' } })));
await ok('Mutation callback is never executed after DENY', async () => {
  let called = false;
  await assert.rejects(() => executeAuthorizedVerticalMutation(staff, tenantA, 'agriculture', 'farm', 'manage', { mutation: () => { called = true; } }));
  assert.equal(called, false);
});
await ok('Mutation callback is never executed across tenant boundary', async () => {
  let called = false;
  await assert.rejects(() => executeAuthorizedVerticalMutation(owner, tenantB, 'agriculture', 'farm', 'manage', { mutation: () => { called = true; } }));
  assert.equal(called, false);
});
await ok('Sensitive audit record preserves authorization decision and tenant context', () => {
  const record = buildSensitiveActionAuditRecord({ session: owner, tenant: tenantA, location: locationA, packId: 'agriculture', resource: 'farm', action: 'manage', decision: AUTHZ.ALLOW, result: 'success' });
  assert.equal(record.organization_id, 'org-a');
  assert.equal(record.actor_id, 'u-owner');
  assert.equal(record.metadata.authorizationDecision, AUTHZ.ALLOW);
});
await ok('Sensitive audit persistence is dependency-injected, not locally owned', async () => {
  let calls = 0;
  const record = buildSensitiveActionAuditRecord({ session: owner, tenant: tenantA, location: locationA, packId: 'agriculture', resource: 'farm', action: 'manage', decision: AUTHZ.ALLOW, result: 'success' });
  await recordSensitiveActionAudit(record, async payload => { calls += 1; assert.equal(payload.organizationId, 'org-a'); });
  assert.equal(calls, 1);
});

await ok('Mutating API routes retain authenticated tenant authorization hooks', () => {
  const mutatingRoutes = [...serverSource.matchAll(/\{ method: '(POST|PATCH)'[^\n]*handler: ([^}]+)\}/g)];
  assert.ok(mutatingRoutes.length > 0);
  const handlers = [...new Set(mutatingRoutes.map(m => m[2]))];
  assert.ok(serverSource.includes('requireAuthorization('));
  assert.ok(serverSource.includes('requireTenantAuth('));
  assert.ok(handlers.length >= 10);
});
await ok('Server does not define a second authorization evaluator/store', () => {
  const suspicious = /ROLE_PERMISSIONS|function\s+authorize\s*\(|authorizationStore|permissionStore|roleStore/i.test(serverSource);
  assert.equal(suspicious, false);
});
await ok('Server does not define a second audit persistence authority', () => {
  const localAuditStore = /CREATE TABLE[^\n]*audit|auditStore|new\s+AuditStore|class\s+AuditStore/i.test(serverSource);
  assert.equal(localAuditStore, false);
});

console.log(`Phase 13.12.11 API Boundary Attack Tests: PASS`);
console.log(`Attack assertions: ${passed} PASS / 0 FAIL`);
console.log('Cross-tenant isolation: PASS');
console.log('Location isolation: PASS');
console.log('Role/permission forgery resistance: PASS');
console.log('Vertical capability fail-closed behavior: PASS');
console.log('Mutation bypass resistance: PASS');
console.log('Approval forgery resistance: PASS');
console.log('Audit authority boundary: PASS');
console.log('Duplicate authorization/audit authority: BLOCKED');
