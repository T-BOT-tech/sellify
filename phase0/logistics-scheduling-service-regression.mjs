// L11.4 — transactional scheduling service regression.
// Runtime requirement: Node >=24 because backend/lib/store-sqlite.js uses node:sqlite.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-l11-4-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const {
  getDatabaseForTests,
  createLogisticsSchedulingActivity,
  getLogisticsSchedulingActivity,
  transitionLogisticsSchedulingActivity,
  listLogisticsSchedulingActivities,
} = await import('../backend/lib/store-sqlite.js');

const db = getDatabaseForTests();
const chatId = 'l11.4-regression-chat';
const organizationId = 'l11.4-regression-org';
const locationId = 'l11.4-regression-location';
const userId = 'l11.4-regression-user';

db.prepare(
  'INSERT INTO organizations (id,name,country,currency,timezone,created_at) VALUES (?,?,?,?,?,?)'
).run(organizationId, 'L11.4 Regression Org', 'ET', 'ETB', 'Africa/Addis_Ababa', new Date().toISOString());

db.prepare(
  'INSERT INTO tenants (chat_id,tenant_id,api_key,created_at,seller_name,organization_id) VALUES (?,?,?,?,?,?)'
).run(chatId, 'l11.4-tenant', 'l11.4-api-key', new Date().toISOString(), 'Regression', organizationId);

db.prepare(
  'INSERT INTO locations (id,organization_id,code,name,type,status,created_at) VALUES (?,?,?,?,?,?,?)'
).run(locationId, organizationId, 'L11.4', 'L11.4 Location', 'STORE', 'active', new Date().toISOString());

db.prepare(
  'INSERT INTO users (id,display_name,created_at,last_seen_at) VALUES (?,?,?,?)'
).run(userId, 'L11.4 Actor', new Date().toISOString(), new Date().toISOString());

const movementNow = new Date().toISOString();
db.prepare(`
  INSERT INTO inventory_movements
    (id,event_id,organization_id,location_id,product_id,quantity,movement_type,
     reference_type,reference_id,actor_id,device_id,occurred_at,reason,metadata_json,created_at)
  VALUES (?,?,?,?,?,1,'ADJUSTMENT',NULL,NULL,?,NULL,?,'L11.4 fixture','{}',?)
`).run('movement-l11-4-1', 'event-l11-4-1', organizationId, locationId,
  'fixture-product-l11-4', userId, movementNow, movementNow);

const actor = { userId, deviceId: null, role: 'logistics_manager', roles: ['logistics_manager'], organizationId };
const base = {
  location_id: locationId,
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  timezone: 'Africa/Addis_Ababa',
  scheduled_start: '2026-10-10T09:00:00Z',
  scheduled_end: '2026-10-10T10:00:00Z',
  related_movement: { id: 'movement-l11-4-1', authority: 'logistics' },
  idempotency_key: 'l11.4-create-1',
};

const deniedActor = { userId: 'l11.4-viewer', deviceId: null, role: 'viewer', roles: ['viewer'], organizationId };
await assert.rejects(
  () => createLogisticsSchedulingActivity(chatId, { ...base, idempotency_key: 'l11.5-denied' }, deniedActor),
  error => error?.code === 'SCHEDULING_AUTHORIZATION_DENIED'
);

const created = await createLogisticsSchedulingActivity(chatId, base, actor);
assert.equal(created.status, 'REQUESTED');
assert.equal(created.version, 1);
assert.equal(created.idempotent, false);

const replay = await createLogisticsSchedulingActivity(chatId, base, actor);
assert.equal(replay.id, created.id);
assert.equal(replay.idempotent, true);

await assert.rejects(
  () => createLogisticsSchedulingActivity(chatId, {
    ...base,
    scheduled_start: '2026-10-10T11:00:00Z',
    scheduled_end: '2026-10-10T12:00:00Z',
  }, actor),
  error => error?.code === 'IDEMPOTENCY_CONFLICT'
);

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId, created.id, 'SCHEDULED', actor,
    { idempotency_key: 'l11.4-command-1', expectedVersion: 1 }
  ),
  error => error?.code === 'SCHEDULING_FEASIBILITY_UNKNOWN'
);
const stillRequested = await getLogisticsSchedulingActivity(chatId, created.id);
assert.equal(stillRequested.status, 'REQUESTED');
assert.equal(stillRequested.version, 1);

// A row already scheduled by a trusted upstream scheduling decision is used
// to test downstream lifecycle transitions. This fixture does not bypass or
// simulate the guarded REQUESTED -> SCHEDULED command above.
db.prepare(`
  UPDATE logistics_scheduling_activities
     SET status = 'SCHEDULED', version = 2
   WHERE id = ? AND organization_id = ?
`).run(created.id, organizationId);
const scheduled = await getLogisticsSchedulingActivity(chatId, created.id);
assert.equal(scheduled.status, 'SCHEDULED');
assert.equal(scheduled.version, 2);

const confirmed = await transitionLogisticsSchedulingActivity(
  chatId, created.id, 'CONFIRMED', actor,
  { idempotency_key: 'l11.4-command-2', expectedVersion: 2 }
);
assert.equal(confirmed.status, 'CONFIRMED');
assert.equal(confirmed.confirmedByUserId, userId);

const confirmedReplay = await transitionLogisticsSchedulingActivity(
  chatId, created.id, 'CONFIRMED', actor,
  { idempotency_key: 'l11.4-command-2', expectedVersion: 2 }
);
assert.equal(confirmedReplay.idempotent, true);

// A command key is bound to its original transition and cannot be reused.
await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId, created.id, 'CANCELLED', actor,
    { idempotency_key: 'l11.4-command-2', expectedVersion: 3 }
  ),
  error => error?.code === 'IDEMPOTENCY_KEY_REUSE_CONFLICT'
);

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId, created.id, 'IN_PROGRESS', actor,
    { idempotency_key: 'l11.4-command-3', expectedVersion: 2 }
  ),
  error => error?.code === 'SCHEDULING_VERSION_CONFLICT'
);

const inProgress = await transitionLogisticsSchedulingActivity(
  chatId, created.id, 'IN_PROGRESS', actor,
  { idempotency_key: 'l11.4-command-3', expectedVersion: 3 }
);
assert.equal(inProgress.status, 'IN_PROGRESS');

const completed = await transitionLogisticsSchedulingActivity(
  chatId, created.id, 'COMPLETED', actor,
  { idempotency_key: 'l11.4-command-4', expectedVersion: 4 }
);
assert.equal(completed.status, 'COMPLETED');

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId, created.id, 'CANCELLED', actor,
    { idempotency_key: 'l11.4-command-5', expectedVersion: 5 }
  ),
  error => error?.code === 'INVALID_SCHEDULING_TRANSITION'
);

const fetched = await getLogisticsSchedulingActivity(chatId, created.id);
assert.equal(fetched.status, 'COMPLETED');

const listed = await listLogisticsSchedulingActivities(chatId, { location_id: locationId });
assert.equal(listed.length, 1);
assert.equal(listed[0].id, created.id);

const columns = db.prepare('PRAGMA table_info(logistics_scheduling_activities)').all().map(row => row.name);
for (const forbidden of ['payment_id', 'inventory_reservation_id', 'route_id', 'gps_state', 'provider_id']) {
  assert.equal(columns.includes(forbidden), false, `forbidden authority column present: ${forbidden}`);
}

console.log('L11.4 Logistics Scheduling Service Regression: PASS');
