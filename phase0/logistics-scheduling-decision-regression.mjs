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
const {
  decideLogisticsSchedulingStart,
  logisticsSchedulingStartContract,
} = await import('../app/src/verticals/logistics/scheduling-start-contract.js');

const {
  decideLogisticsSchedulingCompletion,
  logisticsSchedulingCompletionContract,
} = await import('../app/src/verticals/logistics/scheduling-completion-contract.js');

const {
  decideLogisticsSchedulingFailure,
  logisticsSchedulingFailureContract,
} = await import('../app/src/verticals/logistics/scheduling-failure-contract.js');

const {
  decideLogisticsSchedulingTerminal,
  logisticsSchedulingTerminalContract,
} = await import('../app/src/verticals/logistics/scheduling-terminal-contract.js');

const {
  logisticsSchedulingLifecycleInvariantContract,
  assertLogisticsSchedulingLifecycleInvariant,
} = await import('../app/src/verticals/logistics/scheduling-lifecycle-invariant-contract.js');

const {
  logisticsSchedulingAdversarialContract,
  assertLogisticsSchedulingAdversarialInvariant,
} = await import('../app/src/verticals/logistics/scheduling-adversarial-contract.js');


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

const startContract = logisticsSchedulingStartContract();
assert.equal(startContract.confirmed_allows_start, true);
assert.equal(startContract.unconfirmed_allows_start, false);
assert.equal(startContract.start_is_authorization, false);
assert.equal(startContract.start_is_execution, false);
assert.equal(startContract.reserves_capacity, false);
assert.equal(startContract.selects_provider, false);
assert.equal(startContract.dispatches, false);
assert.equal(startContract.mutates_fulfillment, false);
assert.equal(startContract.mutates_payment, false);
assert.equal(startContract.mutates_inventory, false);

assert.equal(
  decideLogisticsSchedulingStart({
    status: 'SCHEDULED',
    scheduledStart: '2026-10-10T09:00:00Z',
    scheduledEnd: '2026-10-10T10:00:00Z',
    confirmedAt: null,
  }).decision,
  'BLOCK',
);
assert.equal(
  decideLogisticsSchedulingStart({
    status: 'CONFIRMED',
    scheduledStart: '2026-10-10T09:00:00Z',
    scheduledEnd: '2026-10-10T10:00:00Z',
    confirmedAt: '2026-10-10T08:00:00Z',
  }).decision,
  'START',
);

const completionContract = logisticsSchedulingCompletionContract();
assert.equal(completionContract.in_progress_allows_completion, true);
assert.equal(completionContract.not_in_progress_allows_completion, false);
assert.equal(completionContract.completion_is_execution, false);
assert.equal(completionContract.completion_is_fulfillment_completion, false);
assert.equal(completionContract.completion_is_delivery_completion, false);
assert.equal(completionContract.mutates_fulfillment, false);
assert.equal(completionContract.mutates_payment, false);
assert.equal(completionContract.mutates_inventory, false);
assert.equal(completionContract.records_delivery_proof, false);
assert.equal(
  decideLogisticsSchedulingCompletion({ status: 'CONFIRMED' }).decision,
  'BLOCK',
);
assert.equal(
  decideLogisticsSchedulingCompletion({ status: 'IN_PROGRESS' }).decision,
  'COMPLETE',
);

const failureContract = logisticsSchedulingFailureContract();
assert.equal(failureContract.confirmed_allows_failure, true);
assert.equal(failureContract.in_progress_allows_failure, true);
assert.equal(failureContract.inactive_allows_failure, false);
assert.equal(failureContract.failure_reason_required, true);
assert.equal(failureContract.failure_is_execution, false);
assert.equal(failureContract.failure_is_fulfillment_failure, false);
assert.equal(failureContract.failure_is_delivery_failure, false);
assert.equal(failureContract.mutates_fulfillment, false);
assert.equal(failureContract.mutates_payment, false);
assert.equal(failureContract.mutates_inventory, false);
assert.equal(failureContract.selects_provider, false);
assert.equal(failureContract.dispatches, false);
assert.equal(
  decideLogisticsSchedulingFailure({ status: 'SCHEDULED', reason: 'weather' }).decision,
  'BLOCK',
);
assert.equal(
  decideLogisticsSchedulingFailure({ status: 'CONFIRMED' }).decision,
  'BLOCK',
);
assert.equal(
  decideLogisticsSchedulingFailure({
    status: 'CONFIRMED',
    reason: 'provider unavailable',
  }).decision,
  'FAIL',
);
assert.equal(
  decideLogisticsSchedulingFailure({
    status: 'IN_PROGRESS',
    reason: 'route exception',
  }).decision,
  'FAIL',
);

const terminalContract = logisticsSchedulingTerminalContract();
assert.deepEqual(terminalContract.cancelled_from, ['REQUESTED', 'SCHEDULED', 'CONFIRMED']);
assert.deepEqual(terminalContract.missed_from, ['SCHEDULED', 'CONFIRMED']);
assert.deepEqual(terminalContract.expired_from, ['REQUESTED', 'SCHEDULED']);
assert.equal(terminalContract.terminal_states_are_final, true);
assert.equal(terminalContract.mutates_fulfillment, false);
assert.equal(terminalContract.mutates_delivery, false);
assert.equal(terminalContract.mutates_payment, false);
assert.equal(terminalContract.mutates_inventory, false);
assert.equal(terminalContract.selects_provider, false);
assert.equal(terminalContract.dispatches, false);
assert.equal(terminalContract.asserts_operational_failure, false);
assert.equal(
  decideLogisticsSchedulingTerminal({
    status: 'REQUESTED',
    target: 'CANCELLED',
  }).decision,
  'TERMINATE',
);
assert.equal(
  decideLogisticsSchedulingTerminal({
    status: 'SCHEDULED',
    target: 'MISSED',
  }).decision,
  'TERMINATE',
);
assert.equal(
  decideLogisticsSchedulingTerminal({
    status: 'REQUESTED',
    target: 'EXPIRED',
  }).decision,
  'TERMINATE',
);
assert.equal(
  decideLogisticsSchedulingTerminal({
    status: 'IN_PROGRESS',
    target: 'MISSED',
  }).decision,
  'BLOCK',
);
assert.equal(
  decideLogisticsSchedulingTerminal({
    status: 'COMPLETED',
    target: 'CANCELLED',
  }).decision,
  'BLOCK',
);

const lifecycleContract = logisticsSchedulingLifecycleInvariantContract();
assert.equal(lifecycleContract.organization_scoped, true);
assert.equal(lifecycleContract.authorization_required, true);
assert.equal(lifecycleContract.idempotency_key_required, true);
assert.equal(lifecycleContract.optimistic_version_supported, true);
assert.equal(lifecycleContract.state_transition_must_be_validated, true);
assert.equal(lifecycleContract.audit_event_required_for_committed_transition, true);
assert.equal(lifecycleContract.audit_event_is_transactional, true);
assert.equal(lifecycleContract.downstream_fulfillment_mutation, false);
assert.equal(lifecycleContract.downstream_delivery_mutation, false);
assert.equal(lifecycleContract.inventory_mutation, false);
assert.equal(lifecycleContract.payment_mutation, false);
assert.equal(lifecycleContract.settlement_mutation, false);
assert.equal(lifecycleContract.provider_selection, false);
assert.equal(lifecycleContract.dispatch_execution, false);
assert.equal(lifecycleContract.scheduling_is_operational_authority, false);

assert.deepEqual(
  assertLogisticsSchedulingLifecycleInvariant({
    organizationId,
    rowOrganizationId: organizationId,
    stateChanged: true,
    auditWritten: true,
  }),
  { valid: true, reason: 'VALID' },
);
assert.deepEqual(
  assertLogisticsSchedulingLifecycleInvariant({
    organizationId,
    rowOrganizationId: organizationId,
    stateChanged: true,
    auditWritten: false,
  }),
  { valid: false, reason: 'AUDIT_REQUIRED_FOR_STATE_CHANGE' },
);
assert.deepEqual(
  assertLogisticsSchedulingLifecycleInvariant({
    organizationId,
    rowOrganizationId: 'different-org',
    stateChanged: true,
    auditWritten: true,
  }),
  { valid: false, reason: 'ORGANIZATION_SCOPE_VIOLATION' },
);
assert.deepEqual(
  assertLogisticsSchedulingLifecycleInvariant({
    organizationId,
    rowOrganizationId: organizationId,
    stateChanged: false,
    auditWritten: false,
    idempotent: true,
  }),
  { valid: true, reason: 'IDEMPOTENT_REPLAY' },
);
assert.deepEqual(
  assertLogisticsSchedulingLifecycleInvariant({
    organizationId,
    rowOrganizationId: organizationId,
    stateChanged: true,
    auditWritten: true,
    downstreamMutations: { payment: true },
  }),
  { valid: false, reason: 'DOWNSTREAM_MUTATION_FORBIDDEN:payment' },
);

const adversarialContract = logisticsSchedulingAdversarialContract();
assert.equal(adversarialContract.invalid_transitions_block, true);
assert.equal(adversarialContract.cross_organization_access_block, true);
assert.equal(adversarialContract.stale_version_block, true);
assert.equal(adversarialContract.idempotency_key_reuse_conflict, true);
assert.equal(adversarialContract.authorization_boundary_enforced, true);
assert.equal(adversarialContract.failed_mutations_roll_back, true);
assert.equal(adversarialContract.terminal_states_are_final, true);
assert.equal(adversarialContract.scheduling_does_not_execute_operations, true);
for (const scenario of ['INVALID_TRANSITION','CROSS_ORGANIZATION','STALE_VERSION','IDEMPOTENCY_REUSE','UNAUTHORIZED','REFERENCE_SCOPE']) {
  assert.deepEqual(
    assertLogisticsSchedulingAdversarialInvariant({ scenario, blocked: true, mutationRolledBack: true }),
    { valid: true, reason: 'BLOCKED_AND_ROLLED_BACK' },
  );
}

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

const started = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'IN_PROGRESS',
  actor,
  {
    idempotency_key: 'l11.10-start-1',
    expectedVersion: 3,
  },
);
assert.equal(started.status, 'IN_PROGRESS');
assert.equal(started.version, 4);
assert.equal(started.confirmedByUserId, userId);
assert.ok(started.confirmedAt);

const startedReplay = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'IN_PROGRESS',
  actor,
  {
    idempotency_key: 'l11.10-start-1',
    expectedVersion: 3,
  },
);
assert.equal(startedReplay.idempotent, true);
assert.equal(startedReplay.status, 'IN_PROGRESS');
assert.equal(startedReplay.version, 4);

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

const completed = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'COMPLETED',
  actor,
  {
    idempotency_key: 'l11.11-complete-1',
    expectedVersion: 4,
  },
);
assert.equal(completed.status, 'COMPLETED');
assert.equal(completed.version, 5);

const completedReplay = await transitionLogisticsSchedulingActivity(
  chatId,
  first.id,
  'COMPLETED',
  actor,
  {
    idempotency_key: 'l11.11-complete-1',
    expectedVersion: 4,
  },
);
assert.equal(completedReplay.idempotent, true);
assert.equal(completedReplay.status, 'COMPLETED');
assert.equal(completedReplay.version, 5);

const failed = await create(
  'l11.12-create-failure',
  '2026-10-12T09:00:00Z',
  '2026-10-12T10:00:00Z',
  'movement-l11-12-failure',
);
const failedScheduled = await transitionLogisticsSchedulingActivity(
  chatId,
  failed.id,
  'SCHEDULED',
  actor,
  {
    idempotency_key: 'l11.12-schedule-failure',
    expectedVersion: 1,
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'existing-capacity-authority',
      reference_id: 'l11.12-capacity-1',
    },
  },
);
assert.equal(failedScheduled.status, 'SCHEDULED');
const failedConfirmed = await transitionLogisticsSchedulingActivity(
  chatId,
  failed.id,
  'CONFIRMED',
  actor,
  {
    idempotency_key: 'l11.12-confirm-failure',
    expectedVersion: 2,
  },
);
assert.equal(failedConfirmed.status, 'CONFIRMED');

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId,
    failed.id,
    'FAILED',
    actor,
    {
      idempotency_key: 'l11.12-failure-no-reason',
      expectedVersion: 3,
    },
  ),
  error => error?.code === 'SCHEDULING_FAILURE_REASON_REQUIRED',
);

const failedResult = await transitionLogisticsSchedulingActivity(
  chatId,
  failed.id,
  'FAILED',
  actor,
  {
    idempotency_key: 'l11.12-failure-1',
    expectedVersion: 3,
    failure_reason: 'provider unavailable',
  },
);
assert.equal(failedResult.status, 'FAILED');
assert.equal(failedResult.version, 4);

const failedReplay = await transitionLogisticsSchedulingActivity(
  chatId,
  failed.id,
  'FAILED',
  actor,
  {
    idempotency_key: 'l11.12-failure-1',
    expectedVersion: 3,
    failure_reason: 'provider unavailable',
  },
);
assert.equal(failedReplay.idempotent, true);
assert.equal(failedReplay.status, 'FAILED');
assert.equal(failedReplay.version, 4);

const cancelled = await create(
  'l11.13-create-cancelled',
  '2026-10-13T09:00:00Z',
  '2026-10-13T10:00:00Z',
  'movement-l11-13-cancelled',
);
const cancelledResult = await transitionLogisticsSchedulingActivity(
  chatId,
  cancelled.id,
  'CANCELLED',
  actor,
  {
    idempotency_key: 'l11.13-cancel-1',
    expectedVersion: 1,
    reason: 'request withdrawn',
  },
);
assert.equal(cancelledResult.status, 'CANCELLED');
assert.equal(cancelledResult.version, 2);

const cancelledReplay = await transitionLogisticsSchedulingActivity(
  chatId,
  cancelled.id,
  'CANCELLED',
  actor,
  {
    idempotency_key: 'l11.13-cancel-1',
    expectedVersion: 2,
    reason: 'request withdrawn',
  },
);
assert.equal(cancelledReplay.idempotent, true);
assert.equal(cancelledReplay.version, 2);

const missed = await create(
  'l11.13-create-missed',
  '2026-10-14T09:00:00Z',
  '2026-10-14T10:00:00Z',
  'movement-l11-13-missed',
);
const missedScheduled = await transitionLogisticsSchedulingActivity(
  chatId,
  missed.id,
  'SCHEDULED',
  actor,
  {
    idempotency_key: 'l11.13-missed-schedule',
    expectedVersion: 1,
    externalEvaluation: {
      outcome: 'FEASIBLE',
      authority: 'existing-capacity-authority',
      reference_id: 'l11.13-capacity-1',
    },
  },
);
assert.equal(missedScheduled.status, 'SCHEDULED');
const missedResult = await transitionLogisticsSchedulingActivity(
  chatId,
  missed.id,
  'MISSED',
  actor,
  {
    idempotency_key: 'l11.13-missed-1',
    expectedVersion: 2,
    reason: 'scheduled window missed',
  },
);
assert.equal(missedResult.status, 'MISSED');
assert.equal(missedResult.version, 3);

const expired = await create(
  'l11.13-create-expired',
  '2026-10-15T09:00:00Z',
  '2026-10-15T10:00:00Z',
  'movement-l11-13-expired',
);
const expiredResult = await transitionLogisticsSchedulingActivity(
  chatId,
  expired.id,
  'EXPIRED',
  actor,
  {
    idempotency_key: 'l11.13-expired-1',
    expectedVersion: 1,
    reason: 'request window expired',
  },
);
assert.equal(expiredResult.status, 'EXPIRED');
assert.equal(expiredResult.version, 2);

await assert.rejects(
  () => transitionLogisticsSchedulingActivity(
    chatId,
    cancelled.id,
    'EXPIRED',
    actor,
    {
      idempotency_key: 'l11.13-cancel-after-terminal',
      expectedVersion: 2,
    },
  ),
  error => error?.code === 'INVALID_SCHEDULING_TRANSITION',
);

// L11.15 adversarial cases.
const adversarialActivity = await create('l11.15-create-adversarial','2026-10-16T09:00:00Z','2026-10-16T10:00:00Z','movement-l11-15-adversarial');

await assert.rejects(() => transitionLogisticsSchedulingActivity(chatId, adversarialActivity.id, 'COMPLETED', actor, { idempotency_key: 'l11.15-invalid-transition', expectedVersion: 1 }), error => error?.code === 'INVALID_SCHEDULING_TRANSITION');
let adversarialRow = db.prepare('SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?').get(adversarialActivity.id);
assert.equal(adversarialRow.status, 'REQUESTED');
assert.equal(Number(adversarialRow.version), 1);
assert.equal(adversarialRow.last_command_key, null);

await assert.rejects(() => transitionLogisticsSchedulingActivity(chatId, adversarialActivity.id, 'CANCELLED', actor, { idempotency_key: 'l11.15-stale', expectedVersion: 99 }), error => error?.code === 'SCHEDULING_VERSION_CONFLICT');
adversarialRow = db.prepare('SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?').get(adversarialActivity.id);
assert.equal(adversarialRow.status, 'REQUESTED');
assert.equal(Number(adversarialRow.version), 1);
assert.equal(adversarialRow.last_command_key, null);

const idempotencyActivity = await create('l11.15-create-idempotency','2026-10-17T09:00:00Z','2026-10-17T10:00:00Z','movement-l11-15-idempotency');
const idempotencyCancelled = await transitionLogisticsSchedulingActivity(chatId, idempotencyActivity.id, 'CANCELLED', actor, { idempotency_key: 'l11.15-reused-key', expectedVersion: 1 });
assert.equal(idempotencyCancelled.status, 'CANCELLED');
await assert.rejects(() => transitionLogisticsSchedulingActivity(chatId, idempotencyActivity.id, 'EXPIRED', actor, { idempotency_key: 'l11.15-reused-key', expectedVersion: 2 }), error => error?.code === 'IDEMPOTENCY_KEY_REUSE_CONFLICT');
const idempotencyRow = db.prepare('SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?').get(idempotencyActivity.id);
assert.equal(idempotencyRow.status, 'CANCELLED');
assert.equal(Number(idempotencyRow.version), 2);
assert.equal(idempotencyRow.last_command_key, 'l11.15-reused-key');

const unauthorizedActor = { userId: 'l11.15-unauthorized-user', deviceId: null, role: 'viewer', roles: ['viewer'], organizationId };
db.prepare('INSERT INTO users (id,display_name,created_at,last_seen_at) VALUES (?,?,?,?)').run(unauthorizedActor.userId,'L11.15 Unauthorized Actor',new Date().toISOString(),new Date().toISOString());
await assert.rejects(() => transitionLogisticsSchedulingActivity(chatId, adversarialActivity.id, 'CANCELLED', unauthorizedActor, { idempotency_key: 'l11.15-unauthorized', expectedVersion: 1 }), error => error?.code === 'SCHEDULING_AUTHORIZATION_DENIED');
adversarialRow = db.prepare('SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?').get(adversarialActivity.id);
assert.equal(adversarialRow.status, 'REQUESTED');
assert.equal(Number(adversarialRow.version), 1);
assert.equal(adversarialRow.last_command_key, null);

const foreignOrgId='l11.15-foreign-org', foreignChatId='l11.15-foreign-chat';
db.prepare('INSERT INTO organizations (id,name,country,currency,timezone,created_at) VALUES (?,?,?,?,?,?)').run(foreignOrgId,'L11.15 Foreign Org','ET','ETB','Africa/Addis_Ababa',new Date().toISOString());
db.prepare('INSERT INTO tenants (chat_id,tenant_id,api_key,created_at,seller_name,organization_id) VALUES (?,?,?,?,?,?)').run(foreignChatId,'l11.15-foreign-tenant','l11.15-foreign-key',new Date().toISOString(),'Foreign',foreignOrgId);
db.prepare('UPDATE tenants SET organization_id = ? WHERE chat_id = ?').run(foreignOrgId, foreignChatId);
await assert.rejects(() => transitionLogisticsSchedulingActivity(foreignChatId, adversarialActivity.id, 'CANCELLED', actor, { idempotency_key: 'l11.15-cross-org', expectedVersion: 1 }), error => error?.code === 'SCHEDULING_ACTIVITY_NOT_FOUND');
adversarialRow = db.prepare('SELECT status, version, last_command_key FROM logistics_scheduling_activities WHERE id = ?').get(adversarialActivity.id);
assert.equal(adversarialRow.status, 'REQUESTED');
assert.equal(Number(adversarialRow.version), 1);
assert.equal(adversarialRow.last_command_key, null);

const foreignFulfillmentId='l11.15-foreign-fulfillment';
db.prepare('INSERT INTO fulfillments (id,organization_id,server_order_id,fulfillment_type,status,created_at) VALUES (?,?,?,?,?,?)').run(foreignFulfillmentId,foreignOrgId,'l11.15-foreign-order','DELIVERY','PENDING',new Date().toISOString());
await assert.rejects(() => createLogisticsSchedulingActivity(chatId, { id:'l11.15-cross-org-reference', location_id:locationId, activity_type:'DELIVERY', mode:'SCHEDULED', requested_start:'2026-10-18T09:00:00Z', requested_end:'2026-10-18T10:00:00Z', related_fulfillment:{id:foreignFulfillmentId}, idempotency_key:'l11.15-cross-org-reference' }, actor), error => error?.code === 'FULFILLMENT_REFERENCE_INVALID');

console.log('L11.8/L11.9/L11.10/L11.11/L11.12/L11.13/L11.14/L11.15 Logistics Scheduling Decision + Confirmation + Start + Completion + Failure + Terminal + Adversarial Boundary Regression: PASS');
