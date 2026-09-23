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
const user = await getOrCreateUserByTelegram(`p6mp_${x}`, 'Marketplace Role Test');
const tenant = await createTenantForUser({
  userId: user.id,
  sellerName: `P6 Marketplace ${x}`,
  businessType: 'retail',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const row = db.prepare('SELECT chat_id, organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId);
const membership = db.prepare('SELECT id FROM memberships WHERE user_id = ? AND chat_id = ?').get(user.id, row.chat_id);

await assignMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'marketplace_seller_admin', scopeType: 'ORGANIZATION' });
await assignMembershipContextualRole({ actorUserId: user.id, chatId: row.chat_id, membershipId: membership.id, role: 'marketplace_seller_staff', scopeType: 'RESOURCE', scopeId: `marketplace:${row.organization_id}` });

const roles = db.prepare("SELECT role_id AS role FROM membership_roles WHERE membership_id = ? AND status = 'active'").all(membership.id);
assert.ok(roles.some(r => r.role === 'marketplace_seller_admin'));
assert.ok(roles.some(r => r.role === 'marketplace_seller_staff'));

const admin = { userId: user.id, role: 'marketplace_seller_admin', roles: ['marketplace_seller_admin'], organizationId: row.organization_id, chatId: row.chat_id };
const staff = { userId: user.id, role: 'marketplace_seller_staff', roles: ['marketplace_seller_staff'], organizationId: row.organization_id, chatId: row.chat_id };
const buyer = { userId: user.id, role: 'buyer', roles: ['buyer'], organizationId: row.organization_id, chatId: row.chat_id };

assert.equal(authorize(admin, row.organization_id, null, 'marketplace_orders', 'marketplace_orders:view'), 'ALLOW');
assert.equal(authorize(admin, row.organization_id, null, 'marketplace_orders', 'marketplace_orders:update'), 'ALLOW');
assert.equal(authorize(staff, row.organization_id, null, 'marketplace_orders', 'marketplace_orders:view'), 'ALLOW');
assert.equal(authorize(staff, row.organization_id, null, 'marketplace_orders', 'marketplace_orders:update'), 'ALLOW');

// Seller contextual roles do not inherit unrelated payment/inventory/fulfillment authority.
assert.equal(authorize(staff, row.organization_id, null, 'payments', 'payments:manage'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'inventory', 'inventory:edit'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'fulfillment', 'fulfillment:manage'), 'DENY');
assert.equal(authorize(staff, row.organization_id, null, 'logistics', 'logistics:dispatch'), 'DENY');

// Marketplace Buyer remains reconciled to the existing canonical buyer role.
assert.equal(authorize(buyer, row.organization_id, null, 'procurement', 'procurement:demand:create'), 'ALLOW');
assert.equal(authorize(buyer, row.organization_id, null, 'payments', 'payments:manage'), 'DENY');

console.log('FUX-6 Marketplace contextual role regression: PASS');
