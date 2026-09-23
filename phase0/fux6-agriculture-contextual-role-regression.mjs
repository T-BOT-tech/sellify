import assert from 'node:assert/strict';
import { AUTHZ, authorize, requiredPackForRole, getRolePermissions } from '../backend/lib/authorization.js';
import * as store from '../backend/lib/store-sqlite.js';

const x = Date.now().toString(36);
const owner = await store.getOrCreateUserByTelegram(`fux6ag_owner_${x}`, 'Agriculture Owner');
const manager = await store.getOrCreateUserByTelegram(`fux6ag_manager_${x}`, 'Farm Manager');
const field = await store.getOrCreateUserByTelegram(`fux6ag_field_${x}`, 'Field Staff');
const tenant = await store.createTenantForUser({ userId: owner.id, sellerName: `FUX6 Agriculture ${x}`, businessType: 'agriculture', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
await store.ensureMembership(manager.id, tenant.chatId, 'staff');
await store.ensureMembership(field.id, tenant.chatId, 'staff');
const memberships = await store.listTenantMemberships(tenant.chatId);
const managerMembership = memberships.find(m => m.userId === manager.id);
const fieldMembership = memberships.find(m => m.userId === field.id);
assert.ok(managerMembership && fieldMembership);

// Agriculture is declarative-only in the current Pack configuration, so no
// lifecycle authority is invented merely to assign the contextual role.
assert.equal(requiredPackForRole('agriculture_farm_manager'), null);
assert.equal(requiredPackForRole('agriculture_field_staff'), null);

const farmRole = await store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: managerMembership.id,
  role: 'agriculture_farm_manager', scopeType: 'RESOURCE', scopeId: 'farm:farm-1',
});
const fieldRole = await store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: fieldMembership.id,
  role: 'agriculture_field_staff', scopeType: 'RESOURCE', scopeId: 'plot:plot-1',
});
assert.equal(farmRole.role, 'agriculture_farm_manager');
assert.equal(farmRole.scopeType, 'RESOURCE');
assert.equal(fieldRole.role, 'agriculture_field_staff');
assert.equal(fieldRole.scopeId, 'plot:plot-1');

const session = await store.createSession({ userId: manager.id, chatId: tenant.chatId });
const org = { id: session.organizationId };
const managerActor = { userId: manager.id, role: 'agriculture_farm_manager', roles: ['staff', 'agriculture_farm_manager'], organizationId: org.id };
const fieldActor = { userId: field.id, role: 'agriculture_field_staff', roles: ['staff', 'agriculture_field_staff'], organizationId: org.id };
assert.equal(authorize(managerActor, org, null, 'agriculture', 'agriculture:manage'), AUTHZ.ALLOW);
assert.equal(authorize(fieldActor, org, null, 'agriculture', 'agriculture:view'), AUTHZ.ALLOW);
assert.equal(authorize(fieldActor, org, null, 'payments', 'payments:manage'), AUTHZ.DENY);
assert.equal(authorize(fieldActor, org, null, 'inventory', 'inventory:edit'), AUTHZ.DENY);
assert.ok(getRolePermissions('agriculture_farm_manager').includes('agriculture:manage'));
assert.ok(getRolePermissions('agriculture_field_staff').includes('agriculture:view'));

console.log('FUX-6 Agriculture contextual role regression: PASS');

