import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-gap2-courier-scope-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const store = await import('../backend/lib/store-sqlite.js');
const {
  getDatabaseForTests,
  getOrCreateUserByTelegram,
  createTenantForUser,
  createOrganizationLocation,
  createSession,
  assignDeliveryCourier,
  listDeliveryAssignments,
  transitionDeliveryAssignment,
} = store;

const db = getDatabaseForTests();
const suffix = Date.now().toString(36);
const owner = await getOrCreateUserByTelegram(`gap2-owner-${suffix}`, 'GAP-2 owner');
const tenant = await createTenantForUser({
  userId: owner.id,
  sellerName: `GAP-2 courier scope ${suffix}`,
  businessType: 'retail',
  country: 'ET',
  currency: 'ETB',
  timezone: 'Africa/Addis_Ababa',
});
const session = await createSession({ userId: owner.id, chatId: tenant.chatId, deviceName: 'GAP-2 courier scope regression' });
const organizationId = String(session.organizationId);
const locations = await store.listOrganizationLocations(tenant.chatId);
assert.ok(locations?.[0]?.id, 'tenant must have a canonical default location');
const locationA = locations[0];
const locationB = await createOrganizationLocation(tenant.chatId, { code: `B${suffix.slice(-6)}`, name: 'Branch B' });
const locationC = await createOrganizationLocation(tenant.chatId, { code: `C${suffix.slice(-6)}`, name: 'Branch C' });

const courier = await getOrCreateUserByTelegram(`gap2-courier-${suffix}`, 'Multi-location courier');
const courierMembershipId = `membership-${courier.id}-${tenant.chatId}`;
const now = new Date().toISOString();
db.prepare('INSERT INTO memberships (id,user_id,chat_id,role,status,created_at) VALUES (?,?,?,\'logistics_courier\',\'active\',?)')
  .run(courierMembershipId, String(courier.id), tenant.chatId, now);
const roleRows = [
  [`role-a-${suffix}`, 'LOCATION', locationA.id],
  [`role-b-${suffix}`, 'LOCATION', locationB.id],
];
for (const [id, scopeType, scopeId] of roleRows) {
  db.prepare(`
    INSERT INTO membership_roles (id,membership_id,role_id,status,scope_type,scope_id,source,created_at)
    VALUES (?,?,?,'active',?,?,'GAP_2_BEHAVIORAL_REGRESSION',?)
  `).run(id, courierMembershipId, 'logistics_courier', scopeType, scopeId, now);
}
const courierActor = {
  userId: String(courier.id),
  role: 'logistics_courier',
  roles: ['logistics_courier'],
  organizationId,
  chatId: tenant.chatId,
};

function seedDelivery(orderId, locationId, assignmentId, assignmentKey) {
  db.prepare(`
    INSERT INTO orders (chat_id,local_id,server_order_id,order_json,total_minor,created_at,status,delivered_to_device)
    VALUES (?,?,?,?,?,?,?,1)
  `).run(
    tenant.chatId, `local-${orderId}`, orderId,
    JSON.stringify({ fulfillment_type: 'delivery', items: [], delivery_address: { locationId } }),
    0, Date.now(), 'pending',
  );
  db.prepare(`
    INSERT INTO fulfillments
      (id,server_order_id,organization_id,location_id,fulfillment_type,status,destination_json,
       scheduled_at,tracking_reference,proof_json,last_command_key,created_by_user_id,updated_by_user_id,created_at,updated_at,version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
  `).run(
    `fulfillment-${orderId}`, orderId, organizationId, locationId, 'delivery', 'pending',
    JSON.stringify({ locationId }), null, null, null, null, String(owner.id), String(owner.id), now, now,
  );
  db.prepare(`
    INSERT INTO delivery_assignments
      (id,fulfillment_id,organization_id,location_id,courier_user_id,status,assignment_key,assigned_by_user_id,assigned_at,updated_at,version,last_command_key)
    VALUES (?,?,?,?,?,'ASSIGNED',?,?,?,?,1,?)
  `).run(
    assignmentId, `fulfillment-${orderId}`, organizationId, locationId, String(courier.id), assignmentKey,
    String(owner.id), now, now, assignmentKey,
  );
}

seedDelivery(`order-a-${suffix}`, locationA.id, `assignment-a-${suffix}`, `assignment-key-a-${suffix}`);
seedDelivery(`order-b-${suffix}`, locationB.id, `assignment-b-${suffix}`, `assignment-key-b-${suffix}`);
seedDelivery(`order-c-${suffix}`, locationC.id, `assignment-c-${suffix}`, `assignment-key-c-${suffix}`);

const workload = await listDeliveryAssignments(tenant.chatId, courierActor);
assert.deepEqual(new Set(workload.map(row => row.location_id)), new Set([locationA.id, locationB.id]),
  'courier workload must include every granted location and exclude an ungranted branch');
const explicitB = await listDeliveryAssignments(tenant.chatId, courierActor, { locationId: locationB.id });
assert.equal(explicitB.length, 1);
assert.equal(explicitB[0].location_id, locationB.id);
await assert.rejects(
  () => listDeliveryAssignments(tenant.chatId, courierActor, { locationId: locationC.id }),
  error => error?.code === 'COURIER_SCOPE_DENIED' && error?.statusCode === 403,
  'an explicit workload filter for an ungranted location must fail closed',
);

const acceptedA = await transitionDeliveryAssignment(
  tenant.chatId, `order-a-${suffix}`, 'ACCEPTED', courierActor,
  { idempotencyKey: `accept-a-${suffix}` },
);
assert.equal(acceptedA.status, 'ACCEPTED');
const acceptedB = await transitionDeliveryAssignment(
  tenant.chatId, `order-b-${suffix}`, 'ACCEPTED', courierActor,
  { idempotencyKey: `accept-b-${suffix}` },
);
assert.equal(acceptedB.status, 'ACCEPTED');
await assert.rejects(
  () => transitionDeliveryAssignment(
    tenant.chatId, `order-c-${suffix}`, 'ACCEPTED', courierActor,
    { idempotencyKey: `accept-c-${suffix}` },
  ),
  error => error?.code === 'COURIER_SCOPE_DENIED' && error?.statusCode === 403,
  'courier lifecycle actions must reject an ungranted location',
);

// Unknown/resource/null grants must not broaden access.
db.prepare('UPDATE membership_roles SET status = \'revoked\' WHERE membership_id = ? AND scope_type = \'LOCATION\'').run(courierMembershipId);
db.prepare(`
  INSERT INTO membership_roles (id,membership_id,role_id,status,scope_type,scope_id,source,created_at)
  VALUES (?,?,?,'active','RESOURCE','resource-1','GAP_2_BEHAVIORAL_REGRESSION',?)
`).run(`role-resource-${suffix}`, courierMembershipId, 'logistics_courier', now);
await assert.rejects(
  () => listDeliveryAssignments(tenant.chatId, courierActor),
  error => error?.code === 'COURIER_SCOPE_DENIED' && error?.statusCode === 403,
  'resource-only courier grants must fail closed instead of becoming organization-wide',
);

// An explicit organization grant authorizes all locations.
db.prepare(`
  INSERT INTO membership_roles (id,membership_id,role_id,status,scope_type,scope_id,source,created_at)
  VALUES (?,?,?,'active','ORGANIZATION',NULL,'GAP_2_BEHAVIORAL_REGRESSION',?)
`).run(`role-org-${suffix}`, courierMembershipId, 'logistics_courier', now);
const organizationWorkload = await listDeliveryAssignments(tenant.chatId, courierActor);
assert.equal(organizationWorkload.length, 3, 'organization grant must authorize all three locations');

console.log('GAP-2 behavioral multi-location courier authorization: PASS');
console.log('Granted-location workload projection and explicit filters: PASS');
console.log('Lifecycle authorization and fail-closed unknown/resource scopes: PASS');
console.log('Organization-wide grant expansion: PASS');
