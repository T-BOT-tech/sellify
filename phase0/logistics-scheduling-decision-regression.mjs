// L11.8 — transactional scheduling decision boundary regression.
// Runtime requirement: Node >=24 because backend/lib/store-sqlite.js uses node:sqlite.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sellify-l11-8-'));
process.env.SELLIFY_DATA_DIR = tempDir;
process.env.SELLIFY_DB_PATH = path.join(tempDir, 'sellify.sqlite');

const {
  getDatabaseForTests,
  createLogisticsSchedulingActivity,
  transitionLogisticsSchedulingActivity,
  getTenant,
} = await import('../backend/lib/store-sqlite.js');

const {
  decideLogisticsScheduling,
  logisticsSchedulingDecisionContract,
} = await import('../app/src/verticals/logistics/scheduling-decision-contract.js');

const {
  decideLogisticsSchedulingConfirmation,
  logisticsSchedulingConfirmationContract,
} = await import('../app/src/verticals/logistics/scheduling-confirmation-contract.js');

const db = getDatabaseForTests();
const chatId = 'l11.8-regression-chat';
const organizationId = 'l11.8-regression-org';
const locationId = 'l11.8-regression-location';
const userId = 'l11.8-regression-user';

db.prepare(
  'INSERT INTO organizations (id,name,country,currency,timezone,created_at) VALUES (?,?,?,?,?,?)'
).run(organizationId, 'L11.8 Regression Org', 'ET', 'ETB', 'Africa/Addis_Ababa', new Date().toISOString());

db.prepare(
  'INSERT INTO tenants (chat_id,tenant_id,api_key,created_at,seller_name,organization_id) VALUES (?,?,?,?,?,?)'
).run(chatId, 'l11.8-tenant', 'l11.8-api-key', new Date().toISOString(), 'Regression', organizationId);

// Keep the fixture explicitly organization-scoped even if legacy tenant normalization
// changes during database bootstrap.
db.prepare('UPDATE tenants SET organization_id = ? WHERE chat_id = ?').run(organizationId, chatId);
assert.equal(
  db.prepare('SELECT organization_id FROM tenants WHERE chat_id = ?').get(chatId).organization_id,
  organizationId,
);

const fixtureTenant = await getTenant(chatId);
assert.ok(fixtureTenant, 'L11.8 fixture tenant must exist');
assert.equal(fixtureTenant.organizationId, organizationId);

db.prepare(
  'INSERT INTO locations (id,organization_id,code,name,type,status,created_at) VALUES (?,?,?,?,?,?,?)'
).run(locationId, organizationId, 'L11.8', 'L11.8 Location', 'STORE', 'active', new Date().toISOString());

db.prepare(
  'INSERT INTO users (id,display_name,created_at,last_seen_at) VALUES (?,?,?,?)'
).run(userId, 'L11.8 Actor', new Date().toISOString(), new Date().toISOString());

const actor = {
  userId,
  deviceId: null,
  role: 'logistics_manager',
  roles: ['logistics_manager'],
  organizationId,
};

const contract = logisticsSchedulingDecisionContract();
assert.equal(contract.feasible_allows_scheduling, true);
assert.equal(contract.conflict_allows_scheduling, false);
assert.equal(contract.unknown_allows_scheduling, false);
assert.equal(contract.feasibility_is_authorization, false);
assert.equal(contract.scheduling_is_execution, false);
assert.equal(contract.reserves_capacity, false);
assert.equal(contract.mutation, false);

const feasibleDecision = decideLogisticsScheduling({
  evaluation: { evaluation: 'FEASIBLE', feasible: true },
});
assert.equal(feasibleDecision.decision, 'SCHEDULE');
assert.equal(feasibleDecision.authorized, false);
assert.equal(feasibleDecision.execution, false);
assert.equal(feasibleDecision.mutation, false);

const confirmationContract = logisticsSchedulingConfirmationContract();
assert.equal(confirmationContract.scheduled_allows_confirmation, true);
assert.equal(confirmationContract.unscheduled_allows_confirmation, false);
assert.equal(confirmationContract.confirmation_is_authorization, false);
assert.equal(confirmationContract.confirmation_is_execution, false);
assert.equal(confirmationContract.reserves_capacity, false);
assert.equal(confirmationContract.selects_provider, false);
assert.equal(confirmationContract.dispatches, false);

assert.equal(
  decideLogisticsSchedulingConfirmation({
    status: 'REQUESTED',
    scheduledStart: '2026-10-10T09:00:00Z',
    scheduledEnd: '2026-10-10T10:00:00Z',
  }).decision,
  'BLOCK',
);
assert.equal(
  decideLogisticsSchedulingConfirmation({
    status: 'SCHEDULED',
    scheduledStart: '2026-10-10T09:00:00Z',
    scheduledEnd: '2026-10-10T10:00:00Z',
  }).decision,
  'CONFIRM',
);
assert.equal(
  decideLogisticsSchedulingConfirmation({
    status: 'SCHEDULED',
    scheduledStart: null,
    scheduledEnd: null,
  }).decision,
  'BLOCK',
);

for (const outcome of ['CONFLICT', 'UNKNOWN']) {
  const decision = decideLogisticsScheduling({
    evaluation: { evaluation: outcome, feasible: false },
  });
  assert.equal(decision.decision, 'BLOCK');
  assert.equal(decision.authorized, false);
  assert.equal(decision.execution, false);
}

const create = async (key, start, end, movementId) => createLogisticsSchedulingActivity(chatId, {
  location_id: locationId,
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  scheduled_start: start,
  scheduled_end: end,
  related_movement: { id: movementId, authority: 'logistics' },
  idempotency_key: key,
}, actor);

const first = await create(
  'l11.8-create-1',
  '2026-10-10T09:00:00Z',
  '2026-10-10T10:00:00Z',
  'movement-l11-8-1',
);

const scheduled = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'SCHEDULED',
  actor,
  {
    idempotency_key: 'l11.8-command-1',
    expectedVersion: 1,
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'existing-capacity-authority',
      reference_id: 'l11.8-capacity-1',
    },
  },
);
assert.equal(scheduled.status, 'SCHEDULED');
assert.equal(scheduled.version, 2);

const confirmed = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'CONFIRMED',
  actor,
  {
    idempotency_key: 'l11.9-confirm-1',
    expectedVersion: 2,
  },
);
assert.equal(confirmed.status, 'CONFIRMED');
assert.equal(confirmed.version, 3);
assert.equal(confirmed.confirmedByUserId, userId);
assert.ok(confirmed.confirmedAt);

const confirmedReplay = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'CONFIRMED',
  actor,
  {
    idempotency_key: 'l11.9-confirm-1',
    expectedVersion: 2,
  },
);
assert.equal(confirmedReplay.idempotent, true);
assert.equal(confirmedReplay.status, 'CONFIRMED');
assert.equal(confirmedReplay.version, 3);

const replayed = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'SCHEDULED',
  actor,
  {
    idempotency_key: 'l11.8-command-1',
    expectedVersion: 1,
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'existing-capacity-authority',
      reference_id: 'l11.8-capacity-1',
    },
  },
);
assert.equal(replayed.idempotent, true);
assert.equal(replayed.status, 'SCHEDULED');
assert.equal(replayed.version, 2);

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId,
    first.id,
    'SCHEDULED',
    actor,
    {
      idempotency_key: 'l11.8-stale-version',
      expectedVersion: 1,
      externalEvaluation: {
        outcome: 'FEASIBLE',
        authority: 'existing-capacity-authority',
        reference_id: 'l11.8-capacity-1',
      },
    },
  ),
  error => error?.code === 'SCHEDULING_VERSION_CONFLICT',
);

const conflict = await create(
  'l11.8-create-2',
  '2026-10-10T09:30:00Z',
  '2026-10-10T10:30:00Z',
  'movement-l11-8-1',
);

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId,
    conflict.id,
    'SCHEDULED',
    actor,
    {
      idempotency_key: 'l11.8-command-2',
      expectedVersion: 1,
      externalEvaluation: {
        outcome: 'FEASIBLE',
        authority: 'existing-capacity-authority',
        reference_id: 'l11.8-capacity-2',
      },
    },
  ),
  error => error?.code === 'SCHEDULING_FEASIBILITY_CONFLICT',
);

const conflictRow = db.prepare(
  'SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?'
).get(conflict.id);
assert.equal(conflictRow.status, 'REQUESTED');
assert.equal(Number(conflictRow.version), 1);
assert.equal(conflictRow.last_command_key, null);

const unknown = await create(
  'l11.8-create-3',
  '2026-10-11T09:00:00Z',
  '2026-10-11T10:00:00Z',
  'movement-l11-8-3',
);

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId,
    unknown.id,
    'SCHEDULED',
    actor,
    {
      idempotency_key: 'l11.8-command-3',
      expectedVersion: 1,
    },
  ),
  error => error?.code === 'SCHEDULING_FEASIBILITY_UNKNOWN',
);

const unknownRow = db.prepare(
  'SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?'
).get(unknown.id);
assert.equal(unknownRow.status, 'REQUESTED');
assert.equal(Number(unknownRow.version), 1);
assert.equal(unknownRow.last_command_key, null);

console.log('L11.8/L11.9 Logistics Scheduling Decision + Confirmation Boundary Regression: PASS');
