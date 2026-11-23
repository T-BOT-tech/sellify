import assert from 'node:assert/strict';
import { authorize } from '../backend/lib/authorization.js';
import {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  assignMembershipContextualRole,
  revokeMembershipContextualRole,
  createSession,
  authenticateSessionToken,
} from '../backend/lib/store-sqlite.js';

const db = getDatabaseForTests();
const x = Date.now().toString(36);
const user = await getOrCreateUserByTelegram(`p6sn_${x}`, 'Supplier Network Role Test');
const tenant = await createTenantForUser({
  userId: user.id,
  sellerName: `P6 Supplier Network ${x}`,
  businessType: 'retail',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const row = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId);
const membership = db.prepare('SELECT id FROM memberships WHERE user_id = ? AND chat_id = ?').get(user.id, row.chat_id);
const actor = { userId: user.id, role: 'owner', organizationId: row.organization_id, chatId: row.chat_id };

await assignMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'supplier_network_admin', scopeType: 'ORGANIZATION' });
await assignMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'supplier_network_staff', scopeType: 'ORGANIZATION' });
const roles = db.prepare("SELECT role_id AS role, scope_type FROM membership_roles WHERE membership_id = ? AND status = 'active'").all(membership.id);
assert.ok(roles.some(r => r.role === 'supplier_network_admin' && r.scope_type === 'ORGANIZATION'));
assert.ok(roles.some(r => r.role === 'supplier_network_staff' && r.scope_type === 'ORGANIZATION'));

// Test each role through its own authenticated session. A single session with
// both roles would combine their permissions and invalidate the staff-denial
// assertions below.
await revokeMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'supplier_network_staff', scopeType: 'ORGANIZATION' });
db.prepare("UPDATE memberships SET role = 'staff' WHERE id = ?").run(membership.id);
const adminIssued = await createSession({ userId: user.id, chatId: row.chat_id, deviceName: 'FUX6 admin role regression' });
const adminSession = await authenticateSessionToken(adminIssued.token);
assert.ok(adminSession, 'the admin-role session must authenticate');
assert.equal(adminSession.role, 'staff');
assert.ok(adminSession.contextualRoles.some(r => r.role === 'supplier_network_admin' && r.scopeType === 'ORGANIZATION'));
assert.ok(!adminSession.contextualRoles.some(r => r.role === 'supplier_network_staff'));


assert.equal(authorize(adminSession, row.organization_id, null, 'supplier_network_profile', 'supplier-network:view'), 'ALLOW');
assert.equal(authorize(adminSession, row.organization_id, null, 'supplier_network_profile', 'supplier-network:publish'), 'ALLOW');
assert.equal(authorize(adminSession, row.organization_id, null, 'supplier_network_capacity', 'supplier-network:capacity:manage'), 'ALLOW');
assert.equal(authorize(adminSession, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:document'), 'ALLOW');
assert.equal(authorize(adminSession, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:verify'), 'DENY');

// Restore owner authority only for the test fixture's role-management API,
// then assign the staff role and authenticate a fresh staff-only session.
db.prepare("UPDATE memberships SET role = 'owner' WHERE id = ?").run(membership.id);
await revokeMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'supplier_network_admin', scopeType: 'ORGANIZATION' });
await assignMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'supplier_network_staff', scopeType: 'ORGANIZATION' });
db.prepare("UPDATE memberships SET role = 'staff' WHERE id = ?").run(membership.id);
const staffIssued = await createSession({ userId: user.id, chatId: row.chat_id, deviceName: 'FUX6 staff role regression' });
const staffSession = await authenticateSessionToken(staffIssued.token);
assert.ok(staffSession, 'the staff-role session must authenticate');
assert.equal(staffSession.role, 'staff');
assert.ok(staffSession.contextualRoles.some(r => r.role === 'supplier_network_staff' && r.scopeType === 'ORGANIZATION'));
assert.ok(!staffSession.contextualRoles.some(r => r.role === 'supplier_network_admin'));

assert.equal(authorize(staffSession, row.organization_id, null, 'supplier_network_profile', 'supplier-network:manage'), 'ALLOW');
assert.equal(authorize(staffSession, row.organization_id, null, 'supplier_network_capacity', 'supplier-network:capacity:manage'), 'ALLOW');
assert.equal(authorize(staffSession, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:document'), 'ALLOW');
assert.equal(authorize(staffSession, row.organization_id, null, 'supplier_network_profile', 'supplier-network:publish'), 'DENY');
assert.equal(authorize(staffSession, row.organization_id, null, 'supplier_network_profile', 'supplier-network:suspend'), 'DENY');
assert.equal(authorize(staffSession, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:verify'), 'DENY');
assert.equal(authorize(staffSession, row.organization_id, null, 'payments:manage'), 'DENY');
assert.equal(authorize(staffSession, row.organization_id, null, 'inventory:edit'), 'DENY');

console.log('FUX-6 Supplier Network contextual role regression: PASS');
