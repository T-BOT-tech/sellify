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

const {
  evaluateLogisticsSchedulingFeasibility,
} = await import('../app/src/verticals/logistics/scheduling-feasibility-contract.js');

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

// Seed the existing scheduled activity as canonical fixture state. This
// regression tests overlap evaluation; it must not manufacture FEASIBLE
// capacity by issuing an untrusted scheduling transition.
db.prepare(
  "UPDATE logistics_scheduling_activities SET status = 'SCHEDULED', version = 2 WHERE id = ? AND organization_id = ?"
).run(first.id, organizationId);

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

const third = await createLogisticsSchedulingActivity(chatId, {
  location_id: locationId,
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  scheduled_start: '2026-10-10T12:00:00Z',
  scheduled_end: '2026-10-10T13:00:00Z',
  related_movement: { id: 'movement-l11-7-3', authority: 'logistics' },
  idempotency_key: 'l11.7-create-3',
}, actor);

const callerSpoofedEvaluation = await evaluateLogisticsSchedulingActivity(
  chatId,
  third.id,
  actor,
  {
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'existing-capacity-authority',
      reference_id: 'l11.7-capacity-check-1',
    },
  },
);
assert.equal(callerSpoofedEvaluation.evaluation, 'UNKNOWN');
assert.equal(callerSpoofedEvaluation.reason, 'NO_AUTHORITATIVE_CAPACITY_DECISION');
assert.equal(callerSpoofedEvaluation.feasible, false);
assert.equal(callerSpoofedEvaluation.authorized, false);
assert.equal(callerSpoofedEvaluation.execution, false);
assert.equal(callerSpoofedEvaluation.externalEvaluation, null);

// The snake_case alias is also request-controlled and must not bypass the boundary.
const callerSnakeCaseEvaluation = await evaluateLogisticsSchedulingActivity(
  chatId,
  third.id,
  actor,
  {
    external_evaluation: {
      outcome: 'FEASIBLE',
      authority: 'supplier_network',
      reference_id: 'declared-only-supplier-network-capacity-signal',
    },
  },
);
assert.equal(callerSnakeCaseEvaluation.evaluation, 'UNKNOWN');
assert.equal(callerSnakeCaseEvaluation.reason, 'NO_AUTHORITATIVE_CAPACITY_DECISION');
assert.equal(callerSnakeCaseEvaluation.feasible, false);
assert.equal(callerSnakeCaseEvaluation.externalEvaluation, null);

for (const externalEvaluation of [
  {
    outcome: 'FEASIBLE',
    authority: 'caller-invented-capacity-authority',
    reference_id: 'caller-invented-capacity-check',
  },
  {
    outcome: 'FEASIBLE',
    authority: 'supplier_network',
    reference_id: 'declared-only-supplier-network-capacity-signal',
  },
]) {
  await assert.rejects(
    () => transitionLogisticsSchedulingActivity(
      chatId,
      second.id,
      'SCHEDULED',
      actor,
      {
        idempotency_key: `l11.7-untrusted-capacity-evidence-${externalEvaluation.authority}`,
        expectedVersion: 1,
        scheduled_start: '2026-10-10T09:30:00Z',
        scheduled_end: '2026-10-10T10:30:00Z',
        externalEvaluation,
      },
    ),
    error => error?.code === 'SCHEDULING_FEASIBILITY_CONFLICT',
  );
}

// A non-overlapping candidate still cannot be scheduled from a caller-supplied
// FEASIBLE label; without an authenticated capacity authority the result is UNKNOWN.
await assert.rejects(
  () => transitionLogisticsSchedulingActivity(chatId, third.id, 'SCHEDULED', actor, {
    idempotency_key: 'l11.7-untrusted-feasible-nonoverlap',
    expectedVersion: 1,
    scheduled_start: '2026-10-10T12:00:00Z',
    scheduled_end: '2026-10-10T13:00:00Z',
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'caller-invented-capacity-authority',
      reference_id: 'caller-invented-capacity-check',
    },
  }),
  error => error?.code === 'SCHEDULING_FEASIBILITY_UNKNOWN',
);

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

// Contract-level provenance validation protects future trusted adapters:
// a FEASIBLE outcome without both source and durable evidence must fail closed.
const contractRequest = {
  organization_id: organizationId,
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  requested_start: '2026-10-10T14:00:00Z',
  requested_end: '2026-10-10T15:00:00Z',
  scheduled_start: '2026-10-10T14:00:00Z',
  scheduled_end: '2026-10-10T15:00:00Z',
  related_movement: { id: 'movement-l11-7-provenance', authority: 'logistics' },
};
for (const externalEvaluation of [
  { outcome: 'FEASIBLE' },
  { outcome: 'FEASIBLE', authority: 'existing-capacity-service' },
  { outcome: 'FEASIBLE', referenceId: 'capacity-check-without-authority' },
]) {
  const result = evaluateLogisticsSchedulingFeasibility({ request: contractRequest, externalEvaluation });
  assert.equal(result.evaluation, 'UNKNOWN', 'FEASIBLE without complete provenance must fail closed');
  assert.equal(result.reason, 'EXTERNAL_CAPACITY_UNKNOWN');
  assert.equal(result.feasible, false);
  assert.equal(result.authorized, false);
  assert.equal(result.execution, false);
  assert.equal(result.persistence, 'none');
  assert.equal(result.mutation, false);
}
const evidenced = evaluateLogisticsSchedulingFeasibility({
  request: contractRequest,
  externalEvaluation: {
    outcome: 'FEASIBLE',
    authority: 'existing-capacity-service',
    referenceId: 'capacity-check-with-provenance',
  },
});
assert.equal(evidenced.evaluation, 'FEASIBLE');
assert.equal(evidenced.feasible, true);
assert.equal(evidenced.authorized, false);
assert.equal(evidenced.execution, false);
assert.equal(evidenced.persistence, 'none');
assert.equal(evidenced.mutation, false);

console.log('L11.7 Logistics Scheduling Feasibility Integration Regression: PASS');
