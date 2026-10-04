// L11.5 — central scheduling authorization regression.
// Runtime requirement: Node >=24.

import assert from 'node:assert/strict';
import { AUTHZ, authorize, logisticsSchedulingAuthorizationContract } from '../backend/lib/authorization.js';
import { getResourceAction, resourceActionRegistryContract } from '../backend/lib/resource-action-registry.js';
import { VERTICAL_PACK_MANIFESTS } from '../shared/vertical-pack-manifests.js';

const organization = { id: 'org-l11-5' };
const location = { id: 'loc-l11-5', organizationId: 'org-l11-5' };

const manager = {
  userId: 'u-manager',
  organizationId: organization.id,
  role: 'logistics_manager',
  roles: ['logistics_manager'],
};

const dispatcher = {
  userId: 'u-dispatcher',
  organizationId: organization.id,
  role: 'logistics_dispatcher',
  roles: ['logistics_dispatcher'],
};

const courier = {
  userId: 'u-courier',
  organizationId: organization.id,
  role: 'logistics_courier',
  roles: ['logistics_courier'],
};

const viewer = {
  userId: 'u-viewer',
  organizationId: organization.id,
  role: 'logistics_viewer',
  roles: ['logistics_viewer'],
};

const outsider = {
  userId: 'u-outsider',
  organizationId: 'other-org',
  role: 'logistics_manager',
  roles: ['logistics_manager'],
};

for (const actor of [manager, dispatcher]) {
  for (const action of [
    'logistics:scheduling:view',
    'logistics:scheduling:request',
    'logistics:scheduling:manage',
    'logistics:scheduling:confirm',
    'logistics:scheduling:cancel',
  ]) {
    assert.equal(authorize(actor, organization, location, 'scheduling', action), AUTHZ.ALLOW);
  }
}

assert.equal(authorize(courier, organization, location, 'scheduling', 'logistics:scheduling:view'), AUTHZ.ALLOW);
assert.equal(authorize(courier, organization, location, 'scheduling', 'logistics:scheduling:confirm'), AUTHZ.DENY);
assert.equal(authorize(viewer, organization, location, 'scheduling', 'logistics:scheduling:view'), AUTHZ.ALLOW);
assert.equal(authorize(viewer, organization, location, 'scheduling', 'logistics:scheduling:request'), AUTHZ.DENY);
assert.equal(authorize(outsider, organization, location, 'scheduling', 'logistics:scheduling:view'), AUTHZ.DENY);

const contract = logisticsSchedulingAuthorizationContract();
assert.equal(contract.authority, 'backend/lib/authorization.js');
assert.deepEqual(contract.permissions, [
  'logistics:scheduling:view',
  'logistics:scheduling:request',
  'logistics:scheduling:manage',
  'logistics:scheduling:confirm',
  'logistics:scheduling:cancel',
]);

for (const action of ['view', 'request', 'manage', 'confirm', 'cancel']) {
  const entry = getResourceAction('logistics', 'scheduling', action);
  assert.ok(entry);
  assert.equal(entry.permission, `logistics:scheduling:${action}`);
  assert.equal(entry.policyDefined, true);
}

assert.ok(VERTICAL_PACK_MANIFESTS.logistics.capabilities.includes('logistics-scheduling'));
assert.ok(VERTICAL_PACK_MANIFESTS.logistics.permissions.includes('logistics:scheduling:manage'));
assert.equal(resourceActionRegistryContract().vocabulary_only_entries > 0, true);

console.log('L11.5 Logistics Scheduling Authorization Regression: PASS');
