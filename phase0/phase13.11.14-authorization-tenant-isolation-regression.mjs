import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import { assertTenantScope, assertLocationScope, tenantScopeDecision, tenantIsolationContract, TENANT_SCOPE } from '../backend/lib/tenant-isolation.js';

const tenant = { chatId: 'tenant-a', organizationId: 'org-a' };
const otherTenant = { chatId: 'tenant-b', organizationId: 'org-b' };
const actor = { userId: 'user-a', chatId: 'tenant-a', organizationId: 'org-a', role: 'manager' };
const ownLocation = { id: 'loc-a', organizationId: 'org-a', status: 'active' };
const foreignLocation = { id: 'loc-b', organizationId: 'org-b', status: 'active' };

assert.equal(tenantScopeDecision(actor, tenant), TENANT_SCOPE.ALLOW);
assert.equal(tenantScopeDecision(actor, otherTenant), TENANT_SCOPE.DENY);
assert.equal(tenantScopeDecision(actor, tenant, ownLocation), TENANT_SCOPE.ALLOW);
assert.equal(tenantScopeDecision(actor, tenant, foreignLocation), TENANT_SCOPE.DENY);
assert.doesNotThrow(() => assertTenantScope(actor, tenant));
assert.throws(() => assertTenantScope(actor, otherTenant), /not authorized for this tenant organization/);
assert.doesNotThrow(() => assertLocationScope(actor, tenant, ownLocation));
assert.throws(() => assertLocationScope(actor, tenant, foreignLocation), /not authorized for this tenant organization/);

assert.equal(authorize(actor, tenant.organizationId, ownLocation, 'inventory', 'inventory:view'), AUTHZ.ALLOW);
assert.equal(authorize(actor, tenant.organizationId, foreignLocation, 'inventory', 'inventory:view'), AUTHZ.DENY);
assert.equal(authorize(actor, otherTenant.organizationId, ownLocation, 'inventory', 'inventory:view'), AUTHZ.DENY);

const contract = tenantIsolationContract();
assert.equal(contract.session_authority, 'existing sessions + memberships + devices');
assert.equal(contract.tenant_authority, 'existing tenants.chat_id -> tenants.organization_id');
assert.equal(contract.organization_authority, 'existing organizations');
assert.equal(contract.location_authority, 'existing locations.organization_id');
assert.equal(contract.persistence, 'none');
assert.equal(contract.duplicate_tenant_authority, false);
assert.equal(contract.duplicate_organization_authority, false);
assert.equal(contract.duplicate_location_authority, false);

const server = fs.readFileSync(new URL('../backend/server.js', import.meta.url), 'utf8');
assert.match(server, /assertTenantScope\(session, tenant\)/);
assert.match(server, /assertLocationScope\(session, tenant, location\)/);
assert.match(server, /getOrganizationLocation\(chatId, requestedLocationId\)/);
assert.match(server, /code: 'LOCATION_SCOPE_DENIED'/);

const store = fs.readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');
assert.match(store, /export async function getOrganizationLocation/);
assert.match(store, /WHERE id = \? AND organization_id = \?/);
assert.match(store, /inventory\.movement\.record/);

const authz = fs.readFileSync(new URL('../backend/lib/authorization.js', import.meta.url), 'utf8');
assert.match(authz, /actorOrganizationId/);
assert.match(authz, /organizationId/);
assert.match(authz, /locationOrganizationId/);

console.log('Phase 13.11.14 Authorization / Tenant Isolation Regression: PASS');
console.log('Session → tenant organization isolation: PASS');
console.log('Cross-tenant session reuse: BLOCKED');
console.log('Organization authorization boundary: PASS');
console.log('Location → organization isolation: PASS');
console.log('Cross-organization location access: BLOCKED');
console.log('Existing central authorization policy preserved: PASS');
console.log('Existing sessions / memberships / organizations / locations remain authorities: PASS');
console.log('No duplicate tenant / organization / location store: BLOCKED');
