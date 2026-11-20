// L11 — real HTTP coverage for the existing canonical Logistics Scheduling service.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dataDir = await mkdtemp(path.join(tmpdir(), 'sellify-l11-scheduling-http-'));
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(value));
  });
});
const env = {
  ...process.env,
  PORT: String(port),
  NODE_ENV: 'test',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
  SELLIFY_DATA_DIR: dataDir,
  SELLIFY_BACKUP_DIR: path.join(dataDir, 'backups'),
};
process.env.SELLIFY_DATA_DIR = dataDir;
process.env.SELLIFY_BACKUP_DIR = path.join(dataDir, 'backups');

async function request(url, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${url}`, options);
  const json = await response.json().catch(() => ({}));
  return { response, json };
}

const child = spawn(process.execPath, [path.join(root, 'backend/server.js')], {
  cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.setEncoding('utf8');
child.stderr.on('data', chunk => { stderr += chunk; });

try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) { ready = true; break; }
    } catch {}
    if (child.exitCode !== null) throw new Error(`backend exited: ${child.exitCode}`);
    await sleep(50);
  }
  assert.equal(ready, true, stderr);

  const store = await import('../backend/lib/store-sqlite.js');
  const suffix = String(Date.now());
  const owner = await store.getOrCreateUserByTelegram(`l11-scheduling-owner-${suffix}`, 'L11 Scheduling Owner');
  const tenant = await store.createTenantForUser({
    userId: owner.id,
    sellerName: 'L11 Scheduling Tenant',
    businessType: 'logistics',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const db = store.getDatabaseForTests();
  const orderId = `canonical-order-${suffix}`;
  db.prepare(`
    INSERT INTO orders (
      chat_id, local_id, server_order_id, order_json, total_minor,
      created_at, status, delivered_to_device, marketplace_order_id, is_marketplace
    ) VALUES (?, ?, ?, ?, 0, ?, 'pending', 1, NULL, 0)
  `).run(
    tenant.chatId, `local-${suffix}`, orderId,
    JSON.stringify({ id: orderId, fulfillment_type: 'delivery', fulfillment_status: 'pending' }),
    Date.now(),
  );
  // Tenant creation returns the tenant identity, not the canonical
  // organization ID. Resolve that ID from the authoritative tenant row.
  const organizationId = String(db.prepare(
    'SELECT organization_id FROM tenants WHERE chat_id = ?'
  ).get(tenant.chatId)?.organization_id || '');
  assert.ok(organizationId, 'tenant must be linked to a canonical organization');
  const defaultLocationId = db.prepare(
    "SELECT id FROM locations WHERE organization_id = ? AND code = 'DEFAULT' LIMIT 1"
  ).get(organizationId)?.id;
  assert.ok(defaultLocationId, 'tenant default location must exist');
  const movementId = `inventory-movement-${suffix}`;
  const movementNow = new Date().toISOString();
  db.prepare(`
    INSERT INTO inventory_movements
      (id,event_id,organization_id,location_id,product_id,quantity,movement_type,
       reference_type,reference_id,actor_id,device_id,occurred_at,reason,metadata_json,created_at)
    VALUES (?,?,?,?,?,1,'ADJUSTMENT','order',?,?,NULL,?,'L11 HTTP canonical movement',?,?)
  `).run(
    movementId, `inventory-event-${suffix}`, organizationId, defaultLocationId,
    `fixture-product-${suffix}`, orderId, owner.id, movementNow,
    JSON.stringify({ orderId }), movementNow,
  );
  const otherOrderId = `canonical-order-other-${suffix}`;
  db.prepare(`
    INSERT INTO orders (
      chat_id, local_id, server_order_id, order_json, total_minor,
      created_at, status, delivered_to_device, marketplace_order_id, is_marketplace
    ) VALUES (?, ?, ?, ?, 0, ?, 'pending', 1, NULL, 0)
  `).run(
    tenant.chatId, `local-other-${suffix}`, otherOrderId,
    JSON.stringify({ id: otherOrderId }), Date.now(),
  );
  const session = await store.createSession({
    userId: owner.id,
    chatId: tenant.chatId,
    deviceName: 'L11 scheduling HTTP regression',
  });
  const base = `/tenants/${encodeURIComponent(tenant.chatId)}/logistics/scheduling`;
  const headers = { Authorization: `Bearer ${session.token}`, Accept: 'application/json' };

  const staff = await store.getOrCreateUserByTelegram(`l11-scheduling-staff-${suffix}`, 'L11 Scheduling Staff');
  await store.ensureMembership(staff.id, tenant.chatId, 'staff');
  const staffSession = await store.createSession({
    userId: staff.id, chatId: tenant.chatId, deviceName: 'L11 scheduling unauthorized staff',
  });
  const staffRead = await request(base, {
    headers: { Authorization: `Bearer ${staffSession.token}` },
  });
  assert.equal(staffRead.response.status, 403,
    'ordinary staff without logistics scheduling permission cannot read the scheduling workspace');

  const unauthenticated = await request(base);
  assert.equal(unauthenticated.response.status, 401);

  const empty = await request(base, { headers });
  assert.equal(empty.response.status, 200);
  assert.equal(empty.json.state, 'EMPTY');
  assert.equal(empty.json.timezone, 'Africa/Addis_Ababa', 'workspace timezone comes from canonical tenant configuration');
  assert.deepEqual(empty.json.activities, []);

  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const requestKey = `l11-scheduling-create-${suffix}`;
  const forgedTimezone = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
    body: JSON.stringify({
      activity_type: 'DELIVERY',
      mode: 'WINDOWED',
      requested_start: start,
      requested_end: end,
      timezone: 'Asia/Tokyo',
      related_order: { id: orderId },
      related_movement: { id: movementId },
    }),
  });
  assert.equal(forgedTimezone.response.status, 409);
  assert.equal(forgedTimezone.json.error?.code, 'SCHEDULING_TIMEZONE_CHANGED');

  const created = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
    body: JSON.stringify({
      organization_id: 'forged-organization',
      activity_type: 'DELIVERY',
      mode: 'WINDOWED',
      requested_start: start,
      requested_end: end,
      timezone: 'Africa/Addis_Ababa', // matches canonical tenant timezone
      related_order: { id: orderId },
      related_movement: { id: movementId },
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  assert.equal(created.json.activity.status, 'REQUESTED');
  assert.notEqual(created.json.activity.organizationId, 'forged-organization');
  assert.equal(created.json.activity.timezone, 'Africa/Addis_Ababa', 'server persists canonical tenant timezone');

  const replayCreate = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
    body: JSON.stringify({
      organization_id: 'forged-organization',
      activity_type: 'DELIVERY',
      mode: 'WINDOWED',
      requested_start: start,
      requested_end: end,
      timezone: 'Africa/Addis_Ababa',
      related_order: { id: orderId },
      related_movement: { id: movementId },
    }),
  });
  assert.equal(replayCreate.response.status, 200);
  assert.equal(replayCreate.json.activity.id, created.json.activity.id);
  assert.equal(replayCreate.json.activity.idempotent, true);

  const movementOnly = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-movement-only-${suffix}` },
    body: JSON.stringify({
      activity_type: 'PICKUP',
      mode: 'ON_DEMAND',
      related_movement: { id: movementId },
    }),
  });
  assert.equal(movementOnly.response.status, 201, JSON.stringify(movementOnly.json));
  assert.equal(movementOnly.json.activity.relatedMovementId, movementId);

  const invalidMovement = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-invalid-movement-${suffix}` },
    body: JSON.stringify({
      activity_type: 'PICKUP',
      mode: 'ON_DEMAND',
      related_movement: { id: 'movement-does-not-exist' },
    }),
  });
  assert.equal(invalidMovement.response.status, 409);
  assert.equal(invalidMovement.json.error?.code, 'MOVEMENT_REFERENCE_INVALID');

  const mismatchedReferences = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-mismatched-reference-${suffix}` },
    body: JSON.stringify({
      activity_type: 'DELIVERY',
      mode: 'ON_DEMAND',
      related_order: { id: otherOrderId },
      related_movement: { id: movementId },
    }),
  });
  assert.equal(mismatchedReferences.response.status, 409);
  assert.equal(mismatchedReferences.json.error?.code, 'SCHEDULING_REFERENCE_MISMATCH');

  const invalidFulfillment = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-invalid-fulfillment-${suffix}` },
    body: JSON.stringify({
      activity_type: 'DELIVERY',
      mode: 'ON_DEMAND',
      related_fulfillment: { id: 'fulfillment-does-not-exist' },
    }),
  });
  assert.equal(invalidFulfillment.response.status, 409);
  assert.equal(invalidFulfillment.json.error?.code, 'FULFILLMENT_REFERENCE_INVALID');

  const activityId = created.json.activity.id;

  // Exercise the real HTTP authorization boundary with persisted Logistics
  // contextual roles, not only the standalone policy matrix.
  // organizationId was resolved from the canonical tenant before fixture insertion.
  const packNow = new Date().toISOString();
  db.prepare(`INSERT INTO pack_lifecycle (
    id, organization_id, pack_id, pack_version, state, installed_at, activated_at,
    created_by_user_id, updated_by_user_id, created_at, updated_at, version
  ) VALUES (?, ?, 'logistics', '1.0.0', 'ACTIVE', ?, ?, ?, ?, ?, ?, 1)`).run(
    `l11-http-logistics-pack-${suffix}`, organizationId, packNow, packNow,
    owner.id, owner.id, packNow, packNow,
  );

  const logisticsRoleSessions = new Map();
  for (const role of ['logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer']) {
    const roleUser = await store.getOrCreateUserByTelegram(`l11-${role}-${suffix}`, `L11 ${role}`);
    const membership = await store.ensureMembership(roleUser.id, tenant.chatId, 'staff');
    await store.assignMembershipContextualRole({
      actorUserId: owner.id,
      chatId: tenant.chatId,
      membershipId: membership.id,
      role,
      scopeType: 'ORGANIZATION',
    });
    const roleSession = await store.createSession({
      userId: roleUser.id,
      chatId: tenant.chatId,
      deviceName: `L11 ${role} HTTP regression`,
    });
    logisticsRoleSessions.set(role, {
      headers: { Authorization: `Bearer ${roleSession.token}`, Accept: 'application/json' },
    });
  }

  for (const role of ['logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer']) {
    const roleContext = logisticsRoleSessions.get(role);
    const roleRead = await request(base, { headers: roleContext.headers });
    assert.equal(roleRead.response.status, 200, `${role} must read the scheduling workspace`);
  }

  for (const role of ['logistics_manager', 'logistics_dispatcher']) {
    const roleContext = logisticsRoleSessions.get(role);
    const roleRequest = await request(base, {
      method: 'POST',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-${role}-request-${suffix}` },
      body: JSON.stringify({ activity_type: 'PICKUP', mode: 'ON_DEMAND', related_order: { id: orderId } }),
    });
    assert.equal(roleRequest.response.status, 201, `${role} may request scheduling activity`);
    const roleCancel = await request(`${base}/${encodeURIComponent(roleRequest.json.activity.id)}/transition`, {
      method: 'PATCH',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-${role}-cancel-${suffix}` },
      body: JSON.stringify({ status: 'CANCELLED', expectedVersion: 1 }),
    });
    assert.equal(roleCancel.response.status, 200, `${role} may cancel scheduling activity`);
    assert.equal(roleCancel.json.activity.status, 'CANCELLED');
  }

  for (const role of ['logistics_courier', 'logistics_viewer']) {
    const roleContext = logisticsRoleSessions.get(role);
    const roleRequest = await request(base, {
      method: 'POST',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-${role}-denied-request-${suffix}` },
      body: JSON.stringify({ activity_type: 'PICKUP', mode: 'ON_DEMAND' }),
    });
    assert.equal(roleRequest.response.status, 403, `${role} is read-only and cannot request scheduling activity`);
    const roleTransition = await request(`${base}/${encodeURIComponent(activityId)}/transition`, {
      method: 'PATCH',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-${role}-denied-cancel-${suffix}` },
      body: JSON.stringify({ status: 'CANCELLED', expectedVersion: 1 }),
    });
    assert.equal(roleTransition.response.status, 403, `${role} is read-only and cannot cancel scheduling activity`);
  }

  // Location-scoped contextual roles must be constrained at the real HTTP
  // boundary: a valid role at one location must not grant tenant-wide access.
  const scopedLocation = await store.createOrganizationLocation(tenant.chatId, {
    code: `L11A${suffix.slice(-8)}`, name: 'L11 Scoped Location A', type: 'WAREHOUSE', timeZone: 'Asia/Dubai',
  });
  const otherLocation = await store.createOrganizationLocation(tenant.chatId, {
    code: `L11B${suffix.slice(-8)}`, name: 'L11 Scoped Location B', type: 'WAREHOUSE', timeZone: 'Europe/Paris',
  });
  const locationRoleSessions = new Map();
  for (const role of ['logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer']) {
    const roleUser = await store.getOrCreateUserByTelegram(`l11-location-${role}-${suffix}`, `L11 Location ${role}`);
    const membership = await store.ensureMembership(roleUser.id, tenant.chatId, 'staff');
    await store.assignMembershipContextualRole({
      actorUserId: owner.id,
      chatId: tenant.chatId,
      membershipId: membership.id,
      role,
      scopeType: 'LOCATION',
      scopeId: scopedLocation.id,
    });
    const roleSession = await store.createSession({
      userId: roleUser.id,
      chatId: tenant.chatId,
      deviceName: `L11 location-scoped ${role} HTTP regression`,
    });
    locationRoleSessions.set(role, {
      headers: { Authorization: `Bearer ${roleSession.token}`, Accept: 'application/json' },
    });
  }

  for (const role of ['logistics_manager', 'logistics_dispatcher', 'logistics_courier', 'logistics_viewer']) {
    const roleContext = locationRoleSessions.get(role);
    const inScopeRead = await request(`${base}?locationId=${encodeURIComponent(scopedLocation.id)}`, {
      headers: roleContext.headers,
    });
    assert.equal(inScopeRead.response.status, 200, `${role} may read its assigned location`);
    assert.equal(inScopeRead.json.timezone, 'Asia/Dubai',
      'location timezone overrides the organization timezone for scheduling');
    const outOfScopeRead = await request(`${base}?locationId=${encodeURIComponent(otherLocation.id)}`, {
      headers: roleContext.headers,
    });
    assert.equal(outOfScopeRead.response.status, 403, `${role} cannot read another location`);
    const unscopedRead = await request(base, { headers: roleContext.headers });
    assert.equal(unscopedRead.response.status, 403, `${role} cannot broaden a location assignment into tenant-wide access`);
  }

  for (const role of ['logistics_manager', 'logistics_dispatcher']) {
    const roleContext = locationRoleSessions.get(role);
    const inScopeCreate = await request(base, {
      method: 'POST',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-location-${role}-request-${suffix}` },
      body: JSON.stringify({
        activity_type: 'PICKUP',
        mode: 'ON_DEMAND',
        location_id: scopedLocation.id,
        related_order: { id: orderId },
      }),
    });
    assert.equal(inScopeCreate.response.status, 201, `${role} may create activity at its assigned location`);
    assert.equal(inScopeCreate.json.activity.locationId, scopedLocation.id);
    assert.equal(inScopeCreate.json.activity.timezone, 'Asia/Dubai');
    const inScopeCancel = await request(`${base}/${encodeURIComponent(inScopeCreate.json.activity.id)}/transition`, {
      method: 'PATCH',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-location-${role}-cancel-${suffix}` },
      body: JSON.stringify({ status: 'CANCELLED', expectedVersion: 1 }),
    });
    assert.equal(inScopeCancel.response.status, 200, `${role} may transition activity at its assigned location; response=${JSON.stringify(inScopeCancel.json)}`);

    const outOfScopeCreate = await request(base, {
      method: 'POST',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-location-${role}-outside-${suffix}` },
      body: JSON.stringify({
        activity_type: 'PICKUP',
        mode: 'ON_DEMAND',
        location_id: otherLocation.id,
        related_order: { id: orderId },
      }),
    });
    assert.equal(outOfScopeCreate.response.status, 403, `${role} cannot create activity at another location`);
  }

  for (const role of ['logistics_courier', 'logistics_viewer']) {
    const roleContext = locationRoleSessions.get(role);
    const deniedCreate = await request(base, {
      method: 'POST',
      headers: { ...roleContext.headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-location-${role}-denied-${suffix}` },
      body: JSON.stringify({
        activity_type: 'PICKUP',
        mode: 'ON_DEMAND',
        location_id: scopedLocation.id,
        related_order: { id: orderId },
      }),
    });
    assert.equal(deniedCreate.response.status, 403, `${role} remains read-only inside its assigned location`);
  }

  const evaluation = await request(`${base}/${encodeURIComponent(activityId)}/evaluate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scheduledStart: start,
      scheduledEnd: end,
      externalEvaluation: { outcome: 'FEASIBLE', authority: 'caller-claim', referenceId: 'fake-evidence' },
    }),
  });
  assert.equal(evaluation.response.status, 200);
  assert.equal(evaluation.json.evaluation.evaluation, 'UNKNOWN',
    'caller-provided capacity evidence must not convert UNKNOWN into FEASIBLE');
  assert.equal(evaluation.json.evaluation.reason, 'NO_AUTHORITATIVE_CAPACITY_DECISION',
    'the candidate window is evaluated, but no trusted capacity authority is connected');

  const blockedSchedule = await request(`${base}/${encodeURIComponent(activityId)}/transition`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-schedule-${suffix}` },
    body: JSON.stringify({
      status: 'SCHEDULED',
      expectedVersion: 1,
      scheduledStart: start,
      scheduledEnd: end,
      externalEvaluation: { outcome: 'FEASIBLE', authority: 'caller-claim', referenceId: 'fake-evidence' },
    }),
  });
  assert.equal(blockedSchedule.response.status, 409);
  assert.equal(blockedSchedule.json.error?.code, 'SCHEDULING_FEASIBILITY_UNKNOWN');

  const stillRequested = await request(`${base}/${encodeURIComponent(activityId)}`, { headers });
  assert.equal(stillRequested.response.status, 200);
  assert.equal(stillRequested.json.activity.status, 'REQUESTED',
    'UNKNOWN feasibility must not mutate REQUESTED into SCHEDULED');
  assert.equal(stillRequested.json.activity.scheduledStart, null,
    'read-only feasibility must not persist the proposed start');
  assert.equal(stillRequested.json.activity.scheduledEnd, null,
    'read-only feasibility must not persist the proposed end');

  const cancelKey = `l11-cancel-${suffix}`;
  const cancelled = await request(`${base}/${encodeURIComponent(activityId)}/transition`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': cancelKey },
    body: JSON.stringify({ status: 'CANCELLED', expectedVersion: 1 }),
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.json.activity.status, 'CANCELLED');

  const cancelReplay = await request(`${base}/${encodeURIComponent(activityId)}/transition`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': cancelKey },
    body: JSON.stringify({ status: 'CANCELLED', expectedVersion: 1 }),
  });
  assert.equal(cancelReplay.response.status, 200);
  assert.equal(cancelReplay.json.activity.idempotent, true);

  const otherUser = await store.getOrCreateUserByTelegram(`l11-scheduling-outsider-${suffix}`, 'L11 Scheduling Outsider');
  const otherTenant = await store.createTenantForUser({
    userId: otherUser.id,
    sellerName: 'L11 Other Tenant',
    businessType: 'logistics',
    country: 'ET',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  });
  const otherSession = await store.createSession({
    userId: otherUser.id, chatId: otherTenant.chatId, deviceName: 'L11 other tenant',
  });
  const foreignOrderId = `foreign-order-${suffix}`;
  db.prepare(`
    INSERT INTO orders (
      chat_id, local_id, server_order_id, order_json, total_minor,
      created_at, status, delivered_to_device, marketplace_order_id, is_marketplace
    ) VALUES (?, ?, ?, ?, 0, ?, 'pending', 1, NULL, 0)
  `).run(
    otherTenant.chatId, `foreign-local-${suffix}`, foreignOrderId,
    JSON.stringify({ id: foreignOrderId, fulfillment_type: 'delivery', fulfillment_status: 'pending' }),
    Date.now(),
  );
  const foreignReference = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-foreign-reference-${suffix}` },
    body: JSON.stringify({
      activity_type: 'DELIVERY',
      mode: 'ON_DEMAND',
      related_order: { id: foreignOrderId },
    }),
  });
  assert.equal(foreignReference.response.status, 409);
  assert.equal(foreignReference.json.error?.code, 'ORDER_REFERENCE_INVALID');

  const crossTenant = await request(`${base}/${encodeURIComponent(activityId)}`, {
    headers: { Authorization: `Bearer ${otherSession.token}` },
  });
  assert.equal(crossTenant.response.status, 403);

  console.log('L11 Logistics Scheduling authenticated HTTP regression: PASS');
} catch (error) {
  if (stderr) process.stderr.write(stderr);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 2000)),
  ]);
  await rm(dataDir, { recursive: true, force: true });
}
