import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-gap2-delivery-read-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  createOrganizationLocation,
  listOrganizationLocations,
  getDeliveryAssignment,
} = store;
const db = getDatabaseForTests();
const suffix = Date.now().toString(36);
const owner = await getOrCreateUserByTelegram(`gap2-read-owner-${suffix}`, 'GAP-2 read owner');
const tenant = await createTenantForUser({
  userId: owner.id,
  sellerName: `GAP-2 read scope ${suffix}`,
  businessType: 'retail', country: 'ET', currency: 'ETB', timezone: 'Africa/Addis_Ababa',
});
const locationA = (await listOrganizationLocations(tenant.chatId))[0];
const locationB = await createOrganizationLocation(tenant.chatId, {
  code: `RB${suffix.slice(-6)}`, name: 'Read Branch B',
});
const courier = await getOrCreateUserByTelegram(`gap2-read-courier-${suffix}`, 'GAP-2 read courier');
const now = new Date().toISOString();
const membershipId = `membership-${courier.id}-${tenant.chatId}`;
db.prepare("INSERT INTO memberships (id,user_id,chat_id,role,status,created_at) VALUES (?,?,?,'logistics_courier','active',?)")
  .run(membershipId, String(courier.id), tenant.chatId, now);
db.prepare(`
  INSERT INTO membership_roles (id,membership_id,role_id,status,scope_type,scope_id,source,created_at)
  VALUES (?,?,?,'active','LOCATION',?,'GAP_2_READ_SCOPE_REGRESSION',?)
`).run(`role-${suffix}`, membershipId, 'logistics_courier', locationA.id, now);

const orderId = `read-order-${suffix}`;
const fulfillmentId = `read-fulfillment-${suffix}`;
const assignmentId = `read-assignment-${suffix}`;
const organizationId = String(locationA.organizationId);
db.prepare(`
  INSERT INTO orders (chat_id,local_id,server_order_id,order_json,total_minor,created_at,status,delivered_to_device)
  VALUES (?,?,?,?,?,?,?,1)
`).run(tenant.chatId, `local-${orderId}`, orderId, '{}', 0, Date.now(), 'pending');
db.prepare(`
  INSERT INTO fulfillments
    (id,server_order_id,organization_id,location_id,fulfillment_type,status,destination_json,
     created_by_user_id,updated_by_user_id,created_at,updated_at,version)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
`).run(fulfillmentId, orderId, organizationId, locationB.id, 'delivery', 'pending', '{}', owner.id, owner.id, now, now);
db.prepare(`
  INSERT INTO delivery_assignments
    (id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,
     assigned_by_user_id,assigned_at,updated_at,version,last_command_key)
  VALUES (?,?,?,?,?,'ASSIGNED',?,?,?,?,1,?)
`).run(assignmentId, fulfillmentId, organizationId, locationB.id, owner.id,
  `assignment-${suffix}`, owner.id, now, now, `assignment-${suffix}`);

const courierActor = {
  userId: String(courier.id), role: 'logistics_courier', roles: ['logistics_courier'],
  organizationId, chatId: tenant.chatId,
};
await assert.rejects(
  () => getDeliveryAssignment(tenant.chatId, orderId, courierActor),
  error => error?.code === 'COURIER_ASSIGNMENT_REQUIRED' && error?.statusCode === 403,
  'single-assignment read must not expose another courier or location',
);
console.log('GAP-2 delivery single-read ownership and location scope regression: PASS');
