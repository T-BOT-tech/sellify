import assert from 'node:assert/strict';
import {
  normalizeLogisticsSchedulingRequest,
  evaluateLogisticsScheduling,
  isLogisticsSchedulingContract,
  logisticsSchedulingContract,
} from '../app/src/verticals/logistics/scheduling-contract.js';

const base = {
  organization_id: 'ORG-L11-1',
  location_id: 'LOC-L11-1',
  activity_type: 'pickup',
  mode: 'scheduled',
  requested_start: '2026-10-04T08:00:00Z',
  requested_end: '2026-10-04T09:00:00Z',
  timezone: 'Africa/Addis_Ababa',
  related_order: { id: 'ORDER-L11-1', authority: 'commerce' },
};

const request = normalizeLogisticsSchedulingRequest(base);
assert.equal(request.contract_version, '1.0');
assert.equal(request.activity_type, 'PICKUP');
assert.equal(request.mode, 'SCHEDULED');
assert.equal(request.status, 'REQUESTED');
assert.equal(request.persistence, 'none');
assert.equal(request.mutation_authority, 'none');
assert.equal(request.authorization_authority, 'backend/lib/authorization.js');
assert.equal(isLogisticsSchedulingContract(request), true);

// Scheduling is temporal coordination; an order/fulfillment/movement reference
// is required instead of a second Logistics order authority.
assert.throws(() => normalizeLogisticsSchedulingRequest({
  ...base,
  related_order: null,
  related_fulfillment: null,
  related_movement: null,
}), /existing canonical reference is required/);

// WINDOWED requires an actual window.
assert.throws(() => normalizeLogisticsSchedulingRequest({
  ...base,
  mode: 'WINDOWED',
  requested_start: null,
  requested_end: null,
}), /WINDOWED scheduling requires/);

// RECURRING requires recurrence and rejects recurrence for other modes.
assert.throws(() => normalizeLogisticsSchedulingRequest({
  ...base,
  mode: 'RECURRING',
}), /RECURRING scheduling requires/);

assert.throws(() => normalizeLogisticsSchedulingRequest({
  ...base,
  recurrence: { frequency: 'WEEKLY', interval: 1 },
}), /only valid for RECURRING/);

assert.throws(() => normalizeLogisticsSchedulingRequest({
  ...base,
  requested_start: '2026-10-04T10:00:00Z',
  requested_end: '2026-10-04T09:00:00Z',
}), /requested_end must not precede/);

// Forbidden parallel authorities must be rejected at the contract boundary.
for (const field of [
  'calendar',
  'capacity_ledger',
  'route_engine',
  'dispatch_engine',
  'gps',
  'payment_ledger',
  'inventory_reservation',
  'provider_registry',
]) {
  assert.throws(() => normalizeLogisticsSchedulingRequest({
    ...base,
    [field]: {},
  }), new RegExp(field));
}

// Feasibility is separate from authorization and does not imply execution.
const scheduled = evaluateLogisticsScheduling({
  ...base,
  scheduled_start: '2026-10-04T08:00:00Z',
  scheduled_end: '2026-10-04T09:00:00Z',
  status: 'scheduled',
});
assert.equal(scheduled.evaluation, 'FEASIBLE');
assert.equal(scheduled.status, 'SCHEDULED');
assert.equal(scheduled.confirmed, false);
assert.equal(scheduled.executed, false);
assert.equal(scheduled.completed, false);
assert.equal(scheduled.persistence, 'none');
assert.equal(scheduled.mutation_authority, 'none');

const unknown = evaluateLogisticsScheduling(base);
assert.equal(unknown.evaluation, 'UNKNOWN');
assert.equal(unknown.confirmed, false);
assert.equal(unknown.executed, false);
assert.equal(unknown.completed, false);
assert.equal(unknown.unknown_state_policy, 'do_not_infer_success');

// Lifecycle semantics are explicit.
for (const status of [
  'REQUESTED', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED',
  'CANCELLED', 'FAILED', 'MISSED', 'EXPIRED',
]) {
  const result = evaluateLogisticsScheduling({ ...base, status });
  assert.equal(result.status, status);
}

// Contract metadata must preserve canonical authorities and non-goals.
const contract = logisticsSchedulingContract();
assert.deepEqual(contract.scheduling_modes, [
  'ON_DEMAND', 'SCHEDULED', 'WINDOWED', 'RECURRING',
]);
assert.equal(contract.scheduling_authority, 'logistics-pack-temporal-coordination');
assert.equal(contract.order_authority, 'commerce');
assert.equal(contract.authorization_authority, 'backend/lib/authorization.js');
assert.equal(contract.feasibility_is_authorization, false);
assert.equal(contract.scheduled_is_confirmed, false);
assert.equal(contract.confirmed_is_executed, false);
assert.equal(contract.unknown_is_success, false);
assert.equal(contract.persistence, 'deferred to L11 mutation implementation');
assert.equal(contract.mutation_authority, 'deferred to L11 mutation service');
assert.equal(contract.generic_calendar, false);
assert.equal(contract.capacity_ledger, false);
assert.equal(contract.route_engine, false);
assert.equal(contract.dispatch_engine, false);
assert.equal(contract.gps_authority, false);
assert.equal(contract.provider_registry, false);

console.log('L11.1 Logistics Scheduling Contract Regression: 32 PASS / 0 FAIL');
