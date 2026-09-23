import assert from 'node:assert/strict';
import { authorize } from '../backend/lib/authorization.js';
import {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  assignMembershipContextualRole,
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
await assignMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'supplier_network_staff', scopeType: 'RESOURCE', scopeId: `supplier:${row.organization_id}` });
const roles = db.prepare("SELECT role_id AS role FROM membership_roles WHERE membership_id = ? AND status = 'active'").all(membership.id);
assert.ok(roles.some(r => r.role === 'supplier_network_admin'));
assert.ok(roles.some(r => r.role === 'supplier_network_staff'));

const admin = { userId: user.id, role: 'supplier_network_admin', roles: ['supplier_network_admin'], organizationId: row.organization_id, chatId: row.chat_id };
const staff = { userId: user.id, role: 'supplier_network_staff', roles: ['supplier_network_staff'], organizationId: row.organization_id, chatId: row.chat_id };

assert.equal(authorize(admin, row.organization_id, null, 'supplier_network_profile', 'supplier-network:view'), 'ALLOW');
assert.equal(authorize(admin, row.organization_id, null, 'supplier_network_profile', 'supplier-network:publish'), 'ALLOW');
assert.equal(authorize(admin, row.organization_id, null, 'supplier_network_capacity', 'supplier-network:capacity:manage'), 'ALLOW');
assert.equal(authorize(admin, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:document'), 'ALLOW');
assert.equal(authorize(admin, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:verify'), 'DENY');

assert.equal(authorize(staff, row.organization_id, null, 'supplier_network_profile', 'supplier-network:manage'), 'ALLOW');
assert.equal(authorize(staff, row.organization_id, null, 'supplier_network_capacity', 'supplier-network:capacity:manage'), 'ALLOW');
assert.equal(authorize(staff, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:document'), 'ALLOW');
assert.equal(authorize(staff, row.organization_id, null, 'supplier_network_profile', 'supplier-network:publish'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'supplier_network_profile', 'supplier-network:suspend'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'supplier_network_qualification', 'supplier-network:qualification:verify'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'payments:manage'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'inventory:edit'), 'DENY');

console.log('FUX-6 Supplier Network contextual role regression: PASS');
