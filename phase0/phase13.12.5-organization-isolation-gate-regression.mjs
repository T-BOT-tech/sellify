// Phase 13.12.5 — Organization Isolation Gate regression.
// Uses only the existing tenant-isolation and Phase 10.3 authorization
// authorities. No alternate tenant or authorization implementation is allowed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHZ, ROLES, authorize } from '../backend/lib/authorization.js';
import { tenantScopeDecision, TENANT_SCOPE } from '../backend/lib/tenant-isolation.js';
import { RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';
import { CROSS_PACK_ROLE_MATRIX } from '../backend/lib/cross-pack-role-matrix.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const serverSource = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');

const orgA = { id: 'org-a', chatId: 'chat-a' };
const orgB = { id: 'org-b', chatId: 'chat-b' };
const baseTenantA = { chatId: 'chat-a', organizationId: 'org-a' };
const sessionByRole = (role) => ({
  userId: `user-${role}`,
  chatId: 'chat-a',
  organizationId: 'org-a',
  role,
});

let checks = 0;
const check = (condition, message) => {
  checks += 1;
  assert.equal(Boolean(condition), true, message);
};

check(RESOURCE_ACTION_REGISTRY.length === 42, 'all 42 registered capabilities are covered');
check(CROSS_PACK_ROLE_MATRIX.length === 252, 'all six roles × 42 capabilities remain represented');
check(serverSource.includes('assertTenantScope(session, tenant);'), 'server request boundary asserts tenant scope');
check(serverSource.includes("requireAuthorization(session, tenant, resource, action"), 'server authorization boundary remains centralized');
check(serverSource.includes("from './lib/tenant-isolation.js'"), 'server uses canonical tenant isolation module');

for (const role of ROLES) {
  const actor = sessionByRole(role);
  for (const entry of RESOURCE_ACTION_REGISTRY) {
    const sameOrg = authorize(actor, orgA, null, entry.resource, entry.permission ?? entry.action);
    const matrix = CROSS_PACK_ROLE_MATRIX.find((row) =>
      row.role === role && row.packId === entry.packId && row.resource === entry.resource && row.action === entry.action
    );
    check(sameOrg === matrix.decision, `same-org decision preserves role matrix for ${role}/${entry.key}`);

    const crossOrg = authorize(actor, orgB, null, entry.resource, entry.permission ?? entry.action);
    check(crossOrg === AUTHZ.DENY, `cross-org authorization denied for ${role}/${entry.key}`);
  }
}

check(tenantScopeDecision(sessionByRole('owner'), baseTenantA) === TENANT_SCOPE.ALLOW, 'matching chat + organization tenant scope allowed');
check(tenantScopeDecision(sessionByRole('owner'), { ...baseTenantA, organizationId: 'org-b' }) === TENANT_SCOPE.DENY, 'organization mismatch denied');
check(tenantScopeDecision(sessionByRole('owner'), { ...baseTenantA, chatId: 'chat-b' }) === TENANT_SCOPE.DENY, 'tenant chat mismatch denied');
check(tenantScopeDecision({ ...sessionByRole('owner'), organizationId: null }, baseTenantA) === TENANT_SCOPE.DENY, 'session without organization denied');
check(tenantScopeDecision(sessionByRole('owner'), { chatId: 'chat-a' }) === TENANT_SCOPE.DENY, 'tenant without organization denied');
check(tenantScopeDecision(sessionByRole('owner'), baseTenantA, { id: 'loc-b', organizationId: 'org-b' }) === TENANT_SCOPE.DENY, 'cross-organization location denied');
check(tenantScopeDecision(sessionByRole('owner'), baseTenantA, { id: 'loc-a', organizationId: 'org-a' }) === TENANT_SCOPE.ALLOW, 'same-organization location remains allowed by existing boundary');

check(serverSource.includes('assertLocationScope(session, tenant, location);'), 'existing location boundary remains downstream of tenant boundary');
check(!serverSource.includes('new RolePermissionStore'), 'no new role permission store in server');
check(!fs.existsSync(path.join(root, 'backend/lib/organization-authorization.js')), 'no duplicate organization authorization module introduced');

console.log('Phase 13.12.5 Organization Isolation Gate Regression: PASS');
console.log(`Roles checked: ${ROLES.length}`);
console.log(`Registry capabilities checked: ${RESOURCE_ACTION_REGISTRY.length}`);
console.log(`Capability isolation checks: ${ROLES.length * RESOURCE_ACTION_REGISTRY.length * 2}`);
console.log(`Golden assertions: ${checks} PASS / 0 FAIL`);
console.log('Cross-organization authorization: DENY');
console.log('Canonical tenant authority preserved: PASS');
console.log('Canonical Phase 10.3 authorization authority preserved: PASS');
console.log('Duplicate tenant/organization authority: BLOCKED');
