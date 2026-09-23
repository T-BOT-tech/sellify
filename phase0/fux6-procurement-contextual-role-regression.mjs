import assert from 'node:assert/strict';
import { AUTHZ, authorize, requiredPackForRole, getRolePermissions } from '../backend/lib/authorization.js';
import * as store from '../backend/lib/store-sqlite.js';

const x = Date.now().toString(36);
const owner = await store.getOrCreateUserByTelegram(`fux6proc_owner_${x}`, 'Procurement Owner');
const buyer = await store.getOrCreateUserByTelegram(`fux6proc_buyer_${x}`, 'Buyer Requester');
const approver = await store.getOrCreateUserByTelegram(`fux6proc_approver_${x}`, 'Procurement Approver');
const tenant = await store.createTenantForUser({ userId: owner.id, sellerName: `FUX6 Procurement ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa' });
await store.ensureMembership(buyer.id, tenant.chatId, 'staff');
await store.ensureMembership(approver.id, tenant.chatId, 'staff');
const memberships = await store.listTenantMemberships(tenant.chatId);
const buyerMembership = memberships.find(m => m.userId === buyer.id);
const approverMembership = memberships.find(m => m.userId === approver.id);
assert.ok(buyerMembership && approverMembership);

// Procurement is not currently represented as a Pack-lifecycle manifest in the
// shared source, so contextual-role assignment must not invent lifecycle state.
assert.equal(requiredPackForRole('procurement_buyer_requester'), null);
assert.equal(requiredPackForRole('procurement_approver'), null);

const buyerRole = await store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: buyerMembership.id,
  role: 'procurement_buyer_requester', scopeType: 'RESOURCE', scopeId: 'demand:demand-1',
});
const approverRole = await store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: approverMembership.id,
  role: 'procurement_approver', scopeType: 'RESOURCE', scopeId: 'award:award-1',
});
assert.equal(buyerRole.role, 'procurement_buyer_requester');
assert.equal(buyerRole.scopeId, 'demand:demand-1');
assert.equal(approverRole.role, 'procurement_approver');
assert.equal(approverRole.scopeId, 'award:award-1');

const buyerSession = await store.createSession({ userId: buyer.id, chatId: tenant.chatId });
const approverSession = await store.createSession({ userId: approver.id, chatId: tenant.chatId });
const org = { id: buyerSession.organizationId };
const buyerActor = { userId: buyer.id, role: 'procurement_buyer_requester', roles: ['staff', 'procurement_buyer_requester'], organizationId: org.id };
const approverActor = { userId: approver.id, role: 'procurement_approver', roles: ['staff', 'procurement_approver'], organizationId: org.id };

assert.equal(authorize(buyerActor, org, null, 'procurement', 'procurement:demand:create'), AUTHZ.ALLOW);
assert.equal(authorize(buyerActor, org, null, 'procurement', 'procurement:rfq:create'), AUTHZ.ALLOW);
assert.equal(authorize(buyerActor, org, null, 'procurement', 'procurement:comparison:create'), AUTHZ.ALLOW);
assert.equal(authorize(buyerActor, org, null, 'procurement', 'procurement:award:view'), AUTHZ.ALLOW);
assert.equal(authorize(buyerActor, org, null, 'b2b', 'b2b:po:create'), AUTHZ.ALLOW);
assert.equal(authorize(buyerActor, org, null, 'procurement', 'procurement:award:confirm'), AUTHZ.DENY);
assert.equal(authorize(buyerActor, org, null, 'procurement', 'procurement:award:execute'), AUTHZ.DENY);

assert.equal(authorize(approverActor, org, null, 'procurement', 'procurement:comparison:view'), AUTHZ.ALLOW);
assert.equal(authorize(approverActor, org, null, 'procurement', 'procurement:award:view'), AUTHZ.ALLOW);
assert.equal(authorize(approverActor, org, null, 'procurement', 'procurement:award:confirm'), AUTHZ.ALLOW);
assert.equal(authorize(approverActor, org, null, 'procurement', 'procurement:award:cancel'), AUTHZ.ALLOW);
assert.equal(authorize(approverActor, org, null, 'b2b', 'b2b:po:view'), AUTHZ.ALLOW);
assert.equal(authorize(approverActor, org, null, 'procurement', 'procurement:award:execute'), AUTHZ.DENY);
assert.equal(authorize(approverActor, org, null, 'procurement', 'procurement:demand:create'), AUTHZ.DENY);
assert.equal(authorize(approverActor, org, null, 'payments', 'payments:manage'), AUTHZ.DENY);

assert.ok(getRolePermissions('procurement_buyer_requester').includes('procurement:rfq:create'));
assert.ok(getRolePermissions('procurement_approver').includes('procurement:award:confirm'));
assert.ok(!getRolePermissions('procurement_approver').includes('procurement:award:execute'));

console.log('FUX-6 Procurement contextual role regression: PASS');
