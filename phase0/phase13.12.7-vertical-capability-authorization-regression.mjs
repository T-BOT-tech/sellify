import assert from 'node:assert/strict';
import { AUTHZ, authorize } from '../backend/lib/authorization.js';
import { authorizeVerticalCapability } from '../backend/lib/vertical-capability-authorization.js';
import { RESOURCE_ACTION_REGISTRY } from '../backend/lib/resource-action-registry.js';
import { AGRICULTURE_PACK } from '../app/src/verticals/agriculture/pack.js';
import { RESTAURANT_PACK } from '../app/src/verticals/restaurant/pack.js';
import { WAREHOUSE_PACK } from '../app/src/verticals/warehouse/pack.js';
import { LOGISTICS_PACK } from '../app/src/verticals/logistics/pack.js';

const session = {
  userId: 'user-1',
  sessionId: 'session-1',
  chatId: 'chat-1',
  organizationId: 'org-1',
  locationId: 'loc-1',
  role: 'owner',
};
const tenant = { chatId: 'chat-1', organizationId: 'org-1' };
const location = { id: 'loc-1', organizationId: 'org-1' };
const foreignTenant = { chatId: 'chat-2', organizationId: 'org-2' };
const foreignLocation = { id: 'loc-2', organizationId: 'org-2' };

let pass = 0;
const check = (name, fn) => {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
};

check('registry contains all four vertical packs', () => {
  assert.deepEqual([...new Set(RESOURCE_ACTION_REGISTRY.map((e) => e.packId))], [
    'agriculture', 'restaurant', 'warehouse', 'logistics',
  ]);
});

check('every registry capability uses the canonical authorization authority', () => {
  for (const entry of RESOURCE_ACTION_REGISTRY) {
    assert.equal(entry.authorizationAuthority, 'backend/lib/authorization.js');
  }
});

const packCapabilityMap = {
  agriculture: AGRICULTURE_PACK.capabilities.map((capability) => capability.replace('-management', '').replaceAll('-', '_')),
  restaurant: ['table', 'kitchen'],
  warehouse: ['storage', 'receiving', 'stock_adjustment'],
  logistics: ['shipment', 'route', 'delivery', 'proof', 'return', 'courier'],
};

check('every implemented vertical capability maps to registry vocabulary', () => {
  for (const [packId, resources] of Object.entries(packCapabilityMap)) {
    for (const resource of resources) {
      assert.ok(RESOURCE_ACTION_REGISTRY.some((entry) => entry.packId === packId && entry.resource === resource), `${packId}:${resource}`);
    }
  }
  assert.equal(AGRICULTURE_PACK.capabilities.length, 8);
  assert.equal(RESTAURANT_PACK.capabilities.length, 3);
  assert.equal(WAREHOUSE_PACK.capabilities.length, 6);
  assert.equal(LOGISTICS_PACK.capabilities.length, 7);
});

for (const entry of RESOURCE_ACTION_REGISTRY) {
  check(`${entry.key} is enforced through canonical policy`, () => {
    const expected = entry.policyDefined
      ? authorize(session, tenant.organizationId, location, entry.resource, entry.permission)
      : AUTHZ.DENY;
    const actual = authorizeVerticalCapability(
      session, tenant, entry.packId, entry.resource, entry.action, { location },
    );
    assert.equal(actual, expected);
  });
}

check('vocabulary-only capabilities fail closed despite owner wildcard', () => {
  const undefinedEntries = RESOURCE_ACTION_REGISTRY.filter((e) => !e.policyDefined);
  assert.ok(undefinedEntries.length > 0);
  for (const entry of undefinedEntries) {
    assert.equal(
      authorizeVerticalCapability(session, tenant, entry.packId, entry.resource, entry.action, { location }),
      AUTHZ.DENY,
    );
  }
});

check('cross-organization tenant is denied before policy', () => {
  const entry = RESOURCE_ACTION_REGISTRY.find((e) => e.policyDefined);
  assert.throws(() => authorizeVerticalCapability(
    session, foreignTenant, entry.packId, entry.resource, entry.action, { location },
  ), (error) => error?.code === 'TENANT_SCOPE_DENIED');
});

check('cross-organization location is denied before policy', () => {
  const entry = RESOURCE_ACTION_REGISTRY.find((e) => e.policyDefined);
  assert.throws(() => authorizeVerticalCapability(
    session, tenant, entry.packId, entry.resource, entry.action, { location: foreignLocation },
  ), (error) => error?.code === 'LOCATION_SCOPE_DENIED');
});

check('unknown vertical capability fails closed', () => {
  assert.equal(
    authorizeVerticalCapability(session, tenant, 'agriculture', 'unknown', 'manage', { location }),
    AUTHZ.DENY,
  );
});

check('canonical Phase 10.3 authority remains independently unchanged', () => {
  assert.equal(authorize(session, tenant.organizationId, location, 'orders', 'orders:view'), AUTHZ.ALLOW);
});

console.log(`Phase 13.12.7 Vertical Capability Authorization Regression: PASS`);
console.log(`Registry capabilities checked: ${RESOURCE_ACTION_REGISTRY.length}`);
console.log(`Golden assertions: ${pass} PASS / 0 FAIL`);
console.log('Canonical Phase 10.3 authorization authority preserved: PASS');
console.log('Undefined vertical policy fails closed: PASS');
console.log('Organization / location isolation preserved: PASS');
console.log('Duplicate authorization authority: BLOCKED');
