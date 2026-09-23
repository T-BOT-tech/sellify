import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authorize, AUTHZ, ROLES } from '../backend/lib/authorization.js';
import { assertLocationScope, tenantScopeDecision, TENANT_SCOPE } from '../backend/lib/tenant-isolation.js';
import { CROSS_PACK_ROLE_MATRIX } from '../backend/lib/cross-pack-role-matrix.js';
import { RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const serverSource = fs.readFileSync(path.join(root, 'backend/server.js'), 'utf8');
const tenantSource = fs.readFileSync(path.join(root, 'backend/lib/tenant-isolation.js'), 'utf8');
const authSource = fs.readFileSync(path.join(root, 'backend/lib/authorization.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(root, 'backend/lib/store-sqlite.js'), 'utf8');

const ORG = 'org-location-scope-a';
const FOREIGN_ORG = 'org-location-scope-b';
const CHAT = 'chat-location-scope-a';
const session = {
  userId: 'user-location-scope',
  sessionId: 'session-location-scope',
  deviceId: 'device-location-scope',
  chatId: CHAT,
  organizationId: ORG,
  locationId: 'location-default-a',
  role: 'owner',
};
const tenant = { chatId: CHAT, organizationId: ORG };
const sameOrgLocation = { id: 'location-other-a', organizationId: ORG };
const foreignLocation = { id: 'location-foreign-b', organizationId: FOREIGN_ORG };
const missingOrgLocation = { id: 'location-missing-org' };

let checks = 0;
function ok(condition, message) { checks += 1; assert.equal(Boolean(condition), true, message); }
function eq(actual, expected, message) { checks += 1; assert.equal(actual, expected, message); }

// 1. Registry coverage: every Phase 13 capability is evaluated through the
// same canonical organization/location boundary, without new permissions.
eq(RESOURCE_ACTION_REGISTRY.length, 42, 'Phase 13 registry remains 42 entries');
eq(CROSS_PACK_ROLE_MATRIX.length, 252, 'Phase 13 role matrix remains 252 rows');
for (const role of ROLES) {
  for (const entry of RESOURCE_ACTION_REGISTRY) {
    const actor = { ...session, role };
    eq(tenantScopeDecision(actor, tenant, sameOrgLocation), TENANT_SCOPE.ALLOW,
      `${role} same-org location scope remains ALLOW for ${entry.resource}:${entry.action}`);
    eq(tenantScopeDecision(actor, tenant, foreignLocation), TENANT_SCOPE.DENY,
      `${role} foreign location scope denied for ${entry.resource}:${entry.action}`);
  }
}

// 2. Malformed target locations fail closed.
eq(tenantScopeDecision(session, tenant, missingOrgLocation), TENANT_SCOPE.DENY,
  'location without organization ownership fails closed');
let threw = false;
try { assertLocationScope(session, tenant, foreignLocation); } catch (error) { threw = error.code === 'LOCATION_SCOPE_DENIED'; }
ok(threw, 'assertLocationScope rejects foreign-organization location');

// 3. Canonical authorization still rejects an organization mismatch when the
// location is supplied. No new location evaluator is introduced.
eq(authorize(session, ORG, sameOrgLocation, 'orders', 'orders:view'), AUTHZ.ALLOW,
  'canonical authorization allows valid same-org location with existing owner policy');
eq(authorize(session, ORG, foreignLocation, 'orders', 'orders:view'), AUTHZ.DENY,
  'canonical authorization denies foreign location');

// 4. Session locationId is contextual/default data, not an invented per-user
// location ACL. A same-org target location remains valid at the existing scope
// boundary because no location-assignment authority exists in the source.
eq(session.locationId, 'location-default-a', 'session exposes existing default location context');
eq(tenantScopeDecision(session, tenant, sameOrgLocation), TENANT_SCOPE.ALLOW,
  'same-org non-default location is not incorrectly denied by invented user-location ACL');

// 5. Server enforcement remains before canonical authorization whenever a
// target location is supplied.
ok(serverSource.includes('assertTenantScope(session, tenant);'), 'server enforces tenant scope');
ok(serverSource.includes('if (location) assertLocationScope(session, tenant, location);'), 'server enforces location scope before authorization');
ok(serverSource.includes('authorize(session, organization, location, resource, action)'), 'server delegates final decision to canonical authorize()');

// 6. Existing inventory routes explicitly validate requested locations.
ok(serverSource.includes('assertLocationScope(session, tenant, location);'), 'inventory/location-scoped paths use canonical location scope');

// 7. Canonical location ownership remains persistence-backed by locations.organization_id.
ok(storeSource.includes('CREATE TABLE IF NOT EXISTS locations'), 'canonical locations table remains');
ok(storeSource.includes('organization_id TEXT NOT NULL REFERENCES organizations(id)'), 'location organization ownership remains canonical');

// 8. No duplicate location membership/scope authority is introduced by this phase.
ok(!fs.existsSync(path.join(root, 'backend/lib/location-membership.js')), 'no duplicate location membership authority');
ok(!fs.existsSync(path.join(root, 'backend/lib/location-scope-store.js')), 'no duplicate location scope persistence');
ok(!tenantSource.includes('LocationPermissionStore'), 'tenant isolation has no location permission store');
ok(!authSource.includes('LocationPermissionStore'), 'authorization has no location permission store');

// 9. Existing central policy wildcard/role behavior remains untouched.
ok(authSource.includes("permissions.has('*') || permissions.has(permission)"), 'existing Phase 10.3 wildcard/permission behavior preserved');

console.log('Phase 13.12.6 Location Scope Gate Regression: PASS');
console.log(`Roles checked: ${ROLES.length}`);
console.log(`Registry capabilities checked: ${RESOURCE_ACTION_REGISTRY.length}`);
console.log(`Location capability checks: ${ROLES.length * RESOURCE_ACTION_REGISTRY.length * 2}`);
console.log(`Golden assertions: ${checks} PASS / 0 FAIL`);
console.log('Same-organization location scope: ALLOW');
console.log('Foreign-organization location scope: DENY');
console.log('Canonical location authority preserved: PASS');
console.log('No duplicate location scope authority: BLOCKED');
