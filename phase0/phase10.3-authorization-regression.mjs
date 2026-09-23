// Phase 10.3 — Central Authorization regression checks.
// Policy-only tests intentionally avoid starting the full backend.
import assert from 'node:assert/strict';
import { AUTHZ, authorize, getRolePermissions } from '../backend/lib/authorization.js';

const org = { id: 'org-1' };
const loc = { id: 'loc-1', organizationId: 'org-1' };
const otherLoc = { id: 'loc-2', organizationId: 'org-2' };
const actor = role => ({ userId: `user-${role}`, role, organizationId: 'org-1', locationId: 'loc-1' });

assert.equal(authorize(actor('owner'), org, loc, 'catalog', 'inventory:edit'), AUTHZ.ALLOW);
assert.equal(authorize(actor('manager'), org, loc, 'catalog', 'inventory:edit'), AUTHZ.ALLOW);
assert.equal(authorize(actor('cashier'), org, loc, 'catalog', 'inventory:edit'), AUTHZ.DENY);
assert.equal(authorize(actor('staff'), org, loc, 'locations', 'locations:view'), AUTHZ.ALLOW);
assert.equal(authorize(actor('staff'), org, loc, 'locations', 'locations:manage'), AUTHZ.DENY);
assert.equal(authorize(actor('buyer'), org, loc, 'orders', 'orders:create'), AUTHZ.ALLOW);
assert.equal(authorize(actor('viewer'), org, loc, 'orders', 'orders:create'), AUTHZ.DENY);
assert.equal(authorize(actor('manager'), org, otherLoc, 'locations', 'locations:view'), AUTHZ.DENY);
assert.equal(authorize(actor('manager'), { id: 'org-2' }, loc, 'locations', 'locations:view'), AUTHZ.DENY);
assert.equal(authorize(null, org, loc, 'orders', 'orders:view'), AUTHZ.DENY);
assert.ok(getRolePermissions('staff').includes('locations:view'));
assert.ok(getRolePermissions('manager').includes('inventory:view'));
assert.ok(getRolePermissions('staff').includes('inventory:view'));
assert.ok(getRolePermissions('manager').includes('compliance:manage'));
assert.equal(authorize(actor('cashier'), org, loc, 'compliance', 'compliance:manage'), AUTHZ.DENY);
assert.equal(authorize(actor('staff'), org, loc, 'inventory', 'inventory:edit'), AUTHZ.DENY);
console.log('Phase 10.3 Authorization Regression: PASS');
