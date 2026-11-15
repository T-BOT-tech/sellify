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
  assert.deepEqual(empty.json.activities, []);

  const start = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const end = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const requestKey = `l11-scheduling-create-${suffix}`;
  const created = await request(base, {
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
      related_movement: { id: `movement:${orderId}` },
    }),
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.json));
  assert.equal(created.json.activity.status, 'REQUESTED');
  assert.notEqual(created.json.activity.organizationId, 'forged-organization');

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
      related_movement: { id: `movement:${orderId}` },
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
      related_movement: { id: `movement:${orderId}` },
    }),
  });
  assert.equal(movementOnly.response.status, 201, JSON.stringify(movementOnly.json));
  assert.equal(movementOnly.json.activity.relatedMovementId, `movement:${orderId}`);

  const invalidMovement = await request(base, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', 'Idempotency-Key': `l11-invalid-movement-${suffix}` },
    body: JSON.stringify({
      activity_type: 'PICKUP',
      mode: 'ON_DEMAND',
      related_movement: { id: 'movement-without-projection-prefix' },
    }),
  });
  assert.equal(invalidMovement.response.status, 409);
  assert.equal(invalidMovement.json.error?.code, 'MOVEMENT_REFERENCE_INVALID');

  const activityId = created.json.activity.id;
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
