// L11.7 — transactional scheduling feasibility integration regression.
// Runtime requirement: Node >=24 because backend/lib/store-sqlite.js uses node:sqlite.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-l11-7-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const {
  getDatabaseForTests,
  createLogisticsSchedulingActivity,
  transitionLogisticsSchedulingActivity,
  evaluateLogisticsSchedulingActivity,
} = await import('../backend/lib/store-sqlite.js');

const db = getDatabaseForTests();
const chatId = 'l11.7-regression-chat';
const organizationId = 'l11.7-regression-org';
const locationId = 'l11.7-regression-location';
const userId = 'l11.7-regression-user';

db.prepare(
  'INSERT INTO organizations (id,name,country,currency,timezone,created_at) VALUES (?,?,?,?,?,?)'
).run(organizationId, 'L11.7 Regression Org', 'ET', 'ETB', 'Africa/Addis_Ababa', new Date().toISOString());

db.prepare(
  'INSERT INTO tenants (chat_id,tenant_id,api_key,created_at,seller_name,organization_id) VALUES (?,?,?,?,?,?)'
).run(chatId, 'l11.7-tenant', 'l11.7-api-key', new Date().toISOString(), 'Regression', organizationId);

db.prepare(
  'INSERT INTO locations (id,organization_id,code,name,type,status,created_at) VALUES (?,?,?,?,?,?,?)'
).run(locationId, organizationId, 'L11.7', 'L11.7 Location', 'STORE', 'active', new Date().toISOString());

db.prepare(
  'INSERT INTO users (id,display_name,created_at,last_seen_at) VALUES (?,?,?,?)'
).run(userId, 'L11.7 Actor', new Date().toISOString(), new Date().toISOString());

const actor = {
  userId,
  deviceId: null,
  role: 'logistics_manager',
  roles: ['logistics_manager'],
  organizationId,
};

const first = await createLogisticsSchedulingActivity(chatId, {
  location_id: locationId,
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  scheduled_start: '2026-10-10T09:00:00Z',
  scheduled_end: '2026-10-10T10:00:00Z',
  related_movement: { id: 'movement-l11-7-1', authority: 'logistics' },
  idempotency_key: 'l11.7-create-1',
}, actor);

await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'SCHEDULED',
  actor,
  { idempotency_key: 'l11.7-command-1', expectedVersion: 1 },
);

const second = await createLogisticsSchedulingActivity(chatId, {
  location_id: locationId,
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  scheduled_start: '2026-10-10T09:30:00Z',
  scheduled_end: '2026-10-10T10:30:00Z',
  related_movement: { id: 'movement-l11-7-1', authority: 'logistics' },
  idempotency_key: 'l11.7-create-2',
}, actor);

const conflict = await evaluateLogisticsSchedulingActivity(
  chatId,
  second.id,
  actor,
);
assert.equal(conflict.evaluation, 'CONFLICT');
assert.equal(conflict.reason, 'EXISTING_ACTIVITY_OVERLAP');
assert.deepEqual(conflict.conflictingActivityIds, [first.id]);
assert.equal(conflict.authorized, false);
assert.equal(conflict.execution, false);

const feasible = await evaluateLogisticsSchedulingActivity(
  chatId,
  second.id,
  actor,
  {
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'existing-capacity-authority',
      reference_id: 'l11.7-capacity-check-1',
    },
  },
);
assert.equal(feasible.evaluation, 'FEASIBLE');
assert.equal(feasible.feasible, true);
assert.equal(feasible.authorized, false);
assert.equal(feasible.execution, false);
assert.equal(feasible.externalEvaluation.authority, 'existing-capacity-authority');

const before = db.prepare(
  'SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?'
).get(second.id);
assert.equal(before.status, 'REQUESTED');
assert.equal(Number(before.version), 1);

const deniedActor = {
  userId: 'l11.7-viewer',
  deviceId: null,
  role: 'viewer',
  roles: ['viewer'],
  organizationId,
};
await assert.rejects(
  () => evaluateLogisticsSchedulingActivity(chatId, second.id, deniedActor),
  error => error?.code === 'SCHEDULING_AUTHORIZATION_DENIED'
);

const after = db.prepare(
  'SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?'
).get(second.id);
assert.deepEqual(after, before);


const {
  decideLogisticsScheduling,
  logisticsSchedulingDecisionContract,
} = await import('../app/src/verticals/logistics/scheduling-decision-contract.js');

const schedulingDecision = decideLogisticsScheduling({
  evaluation: { evaluation: 'FEASIBLE', feasible: true },
});
assert.equal(schedulingDecision.decision, 'SCHEDULE');
assert.equal(schedulingDecision.authorized, false);
assert.equal(schedulingDecision.execution, false);

const blockedConflict = decideLogisticsScheduling({
  evaluation: { evaluation: 'CONFLICT', feasible: false },
});
assert.equal(blockedConflict.decision, 'BLOCK');

const blockedUnknown = decideLogisticsScheduling({
  evaluation: { evaluation: 'UNKNOWN', feasible: false },
});
assert.equal(blockedUnknown.decision, 'BLOCK');

assert.throws(
  () => decideLogisticsScheduling({
    evaluation: { evaluation: 'FEASIBLE', feasible: false },
  }),
  error => error?.code === 'LOGISTICS_SCHEDULING_DECISION_INVALID',
);

const decisionContract = logisticsSchedulingDecisionContract();
assert.equal(decisionContract.feasible_allows_scheduling, true);
assert.equal(decisionContract.conflict_allows_scheduling, false);
assert.equal(decisionContract.unknown_allows_scheduling, false);
assert.equal(decisionContract.feasibility_is_authorization, false);
assert.equal(decisionContract.scheduling_is_execution, false);

console.log('L11.7 Logistics Scheduling Feasibility Integration Regression: PASS');
