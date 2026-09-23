import assert from 'node:assert/strict';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import { authorizeVerticalCapability } from '../backend/lib/vertical-capability-authorization.js';
import { getResourceAction, RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';
import { assertTenantScope } from '../backend/lib/tenant-isolation.js';

const tenantA = Object.freeze({ chatId: 'chat-a', organizationId: 'org-a' });
const locationA = Object.freeze({ id: 'loc-a', organizationId: 'org-a' });

function session(role, overrides = {}) {
  return {
    userId: `${role}-user`,
    sessionId: `${role}-session`,
    chatId: 'chat-a',
    deviceId: `${role}-device`,
    role,
    organizationId: 'org-a',
    locationId: 'loc-a',
    ...overrides,
  };
}

const checks = [];
function check(name, fn) {
  try { fn(); checks.push([name, 'PASS']); }
  catch (error) { checks.push([name, 'FAIL', error]); }
}

const capabilities = [
  ['agriculture', 'farm', 'manage', 'agriculture:manage'],
  ['restaurant', 'table', 'manage', 'tables:manage'],
  ['warehouse', 'stock_adjustment', 'manage', 'inventory:edit'],
  ['logistics', 'shipment', 'manage', null],
];

check('Registry contains all four pack boundaries', () => {
  for (const [packId, resource, action] of capabilities) {
    assert.ok(getResourceAction(packId, resource, action));
  }
  assert.equal(new Set(RESOURCE_ACTION_REGISTRY.map((e) => e.packId)).size, 4);
});

check('Same-pack manager permissions remain intact', () => {
  assert.equal(authorizeVerticalCapability(session('manager'), tenantA, 'agriculture', 'farm', 'manage', { location: locationA }), AUTHZ.DENY);
  assert.equal(authorizeVerticalCapability(session('manager'), tenantA, 'restaurant', 'table', 'manage', { location: locationA }), AUTHZ.ALLOW);
  assert.equal(authorizeVerticalCapability(session('manager'), tenantA, 'warehouse', 'stock_adjustment', 'manage', { location: locationA }), AUTHZ.ALLOW);
});

check('Cashier Restaurant table authority does not become Warehouse stock authority', () => {
  const actor = session('cashier');
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'table', 'view', { location: locationA }), AUTHZ.ALLOW);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'warehouse', 'stock_adjustment', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Staff Warehouse view authority does not become Warehouse mutation authority', () => {
  const actor = session('staff');
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'warehouse', 'storage', 'view', { location: locationA }), AUTHZ.ALLOW);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'warehouse', 'stock_adjustment', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Buyer B2B authority does not become Agriculture authority', () => {
  const actor = session('buyer');
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'agriculture', 'buyer', 'manage', { location: locationA }), AUTHZ.DENY);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'table', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Viewer has no cross-pack escalation', () => {
  const actor = session('viewer');
  for (const [packId, resource, action] of capabilities) {
    assert.equal(authorizeVerticalCapability(actor, tenantA, packId, resource, action, { location: locationA }), AUTHZ.DENY);
  }
});

check('Pack-id substitution cannot reuse another pack capability', () => {
  const actor = session('cashier');
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'table', 'view', { location: locationA }), AUTHZ.ALLOW);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'warehouse', 'table', 'view', { location: locationA }), AUTHZ.DENY);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'agriculture', 'table', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Resource substitution cannot borrow another pack permission', () => {
  const actor = session('cashier');
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'table', 'view', { location: locationA }), AUTHZ.ALLOW);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'stock_adjustment', 'manage', { location: locationA }), AUTHZ.DENY);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'farm', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Action substitution cannot turn view into manage', () => {
  const actor = session('staff');
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'warehouse', 'storage', 'view', { location: locationA }), AUTHZ.ALLOW);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'warehouse', 'storage', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Agriculture permission does not grant Restaurant or Warehouse capability', () => {
  const actor = session('manager');
  assert.equal(authorize(actor, 'org-a', locationA, 'farm', 'agriculture:manage'), AUTHZ.DENY);
  // These are evaluated independently by their own registered central keys.
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'restaurant', 'recipe', 'manage', { location: locationA }), AUTHZ.DENY);
  assert.equal(authorizeVerticalCapability(actor, tenantA, 'logistics', 'shipment', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Logistics policy-neutral capabilities fail closed for owner', () => {
  const actor = session('owner');
  for (const [resource, action] of [['shipment', 'manage'], ['route', 'manage'], ['delivery', 'manage'], ['proof', 'manage'], ['return', 'manage'], ['courier', 'manage']]) {
    assert.equal(authorizeVerticalCapability(actor, tenantA, 'logistics', resource, action, { location: locationA }), AUTHZ.DENY);
  }
});

check('Foreign organization blocks cross-pack authorization before policy', () => {
  const actor = session('manager');
  const foreignTenant = { chatId: 'chat-b', organizationId: 'org-b' };
  assert.throws(() => authorizeVerticalCapability(actor, foreignTenant, 'restaurant', 'table', 'manage', { location: { id: 'loc-b', organizationId: 'org-b' } }), (error) => error?.code === 'TENANT_SCOPE_DENIED');
});

check('Foreign location blocks cross-pack authorization before policy', () => {
  const actor = session('manager');
  assert.throws(() => authorizeVerticalCapability(actor, tenantA, 'warehouse', 'stock_adjustment', 'manage', { location: { id: 'loc-b', organizationId: 'org-b' } }), (error) => error?.code === 'LOCATION_SCOPE_DENIED');
});

check('Tenant isolation remains canonical and not pack-specific', () => {
  assert.doesNotThrow(() => assertTenantScope(session('manager'), tenantA));
  assert.throws(() => assertTenantScope(session('manager'), { chatId: 'chat-a', organizationId: 'org-b' }), (error) => error?.code === 'TENANT_SCOPE_DENIED');
});

check('Unknown pack cannot resolve a known resource/action', () => {
  assert.equal(authorizeVerticalCapability(session('owner'), tenantA, 'unknown-pack', 'table', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Unknown resource cannot resolve a known pack permission', () => {
  assert.equal(authorizeVerticalCapability(session('owner'), tenantA, 'restaurant', 'inventory', 'manage', { location: locationA }), AUTHZ.DENY);
});

check('Cross-pack registry entries retain their own permission metadata', () => {
  assert.equal(getResourceAction('agriculture', 'farm', 'manage').permission, 'agriculture:manage');
  assert.equal(getResourceAction('restaurant', 'table', 'manage').permission, 'tables:manage');
  assert.equal(getResourceAction('warehouse', 'stock_adjustment', 'manage').permission, 'inventory:edit');
  assert.equal(getResourceAction('logistics', 'shipment', 'manage').permission, null);
});

const failed = checks.filter(([, status]) => status === 'FAIL');
console.log(`Phase 13.12.12 Cross-Pack Escalation Regression: ${failed.length ? 'FAIL' : 'PASS'}`);
console.log(`Assertions: ${checks.length} PASS=${checks.length - failed.length} FAIL=${failed.length}`);
for (const [name, status, error] of checks) {
  console.log(`${status === 'PASS' ? 'PASS' : 'FAIL'} ${name}`);
  if (error) console.error(error.stack || error);
}
if (failed.length) process.exitCode = 1;
