import assert from 'node:assert/strict';
import { AUTHZ, authorize, requiredPackForRole, getRolePermissions } from '../backend/lib/authorization.js';
import * as store from '../backend/lib/store-sqlite.js';

const x = Date.now().toString(36);
const owner = await store.getOrCreateUserByTelegram(`fux6retail_owner_${x}`, 'Retail Owner');
const cashier = await store.getOrCreateUserByTelegram(`fux6retail_cashier_${x}`, 'Retail Cashier');
const stock = await store.getOrCreateUserByTelegram(`fux6retail_stock_${x}`, 'Retail Stock');
const tenant = await store.createTenantForUser({
  userId: owner.id, sellerName: `FUX6 Retail ${x}`, businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa'
});
await store.ensureMembership(cashier.id, tenant.chatId, 'staff');
await store.ensureMembership(stock.id, tenant.chatId, 'staff');
const db = store.getDatabaseForTests();
const tenantRow = db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(tenant.chatId);
const organizationId = tenantRow.organization_id;
const memberships = await store.listTenantMemberships(tenant.chatId);
const cashierMembership = memberships.find(m => m.userId === cashier.id);
const stockMembership = memberships.find(m => m.userId === stock.id);
assert.ok(cashierMembership && stockMembership);

// Retail/POS is currently a Platform/Core-backed Pack family; unlike
// Restaurant/Warehouse contextual roles, assignment does not invent a new
// Pack lifecycle authority.
assert.equal(requiredPackForRole('retail_cashier'), null);
assert.equal(requiredPackForRole('retail_stock_staff'), null);

const actor = { userId: owner.id, role: 'owner', roles: ['owner'], organizationId };
// The store service resolves organization from chatId, so assignment itself
// is the canonical persistence/enforcement check.
const cashierRole = await store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: cashierMembership.id,
  role: 'retail_cashier', scopeType: 'LOCATION', scopeId: (await store.getDefaultLocation?.(tenant.chatId))?.id || null,
}).catch(async () => store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: cashierMembership.id,
  role: 'retail_cashier', scopeType: 'ORGANIZATION'
}));
const stockRole = await store.assignMembershipContextualRole({
  actorUserId: owner.id, chatId: tenant.chatId, membershipId: stockMembership.id,
  role: 'retail_stock_staff', scopeType: 'ORGANIZATION'
});
assert.equal(cashierRole.role, 'retail_cashier');
assert.equal(stockRole.role, 'retail_stock_staff');
assert.equal(cashierRole.status, 'active');
assert.equal(stockRole.status, 'active');

const org = { id: organizationId };
const cashierActor = { userId: cashier.id, role: 'retail_cashier', roles: ['staff','retail_cashier'], organizationId };
const stockActor = { userId: stock.id, role: 'retail_stock_staff', roles: ['staff','retail_stock_staff'], organizationId };
assert.equal(authorize(cashierActor, org, null, 'orders', 'orders:create'), AUTHZ.ALLOW);
assert.equal(authorize(cashierActor, org, null, 'payments', 'payments:accept'), AUTHZ.ALLOW);
assert.equal(authorize(cashierActor, org, null, 'inventory', 'inventory:edit'), AUTHZ.DENY);
assert.equal(authorize(stockActor, org, null, 'inventory', 'inventory:edit'), AUTHZ.ALLOW);
assert.equal(authorize(stockActor, org, null, 'payments', 'payments:accept'), AUTHZ.DENY);
assert.ok(getRolePermissions('retail_cashier').includes('orders:create'));
assert.ok(getRolePermissions('retail_stock_staff').includes('inventory:edit'));

console.log('FUX-6 Retail/POS contextual role regression: PASS');
