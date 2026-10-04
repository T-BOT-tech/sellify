// L11.6 — scheduling feasibility / conflict regression.
// Pure contract test; no database or runtime authority is introduced.

import assert from 'node:assert/strict';

const {
  evaluateLogisticsSchedulingFeasibility,
  logisticsSchedulingFeasibilityContract,
} = await import('../app/src/verticals/logistics/scheduling-feasibility-contract.js');

const base = {
  organization_id: 'l11.6-org',
  location_id: 'l11.6-location',
  activity_type: 'PICKUP',
  mode: 'SCHEDULED',
  scheduled_start: '2026-10-10T09:00:00Z',
  scheduled_end: '2026-10-10T10:00:00Z',
  related_movement: { id: 'movement-1', authority: 'logistics' },
};

const noAuthoritativeCapacity = evaluateLogisticsSchedulingFeasibility({
  request: base,
});
assert.equal(noAuthoritativeCapacity.evaluation, 'UNKNOWN');
assert.equal(noAuthoritativeCapacity.reason, 'NO_AUTHORITATIVE_CAPACITY_DECISION');
assert.equal(noAuthoritativeCapacity.feasible, false);
assert.equal(noAuthoritativeCapacity.authorized, false);
assert.equal(noAuthoritativeCapacity.execution, false);

const overlapping = evaluateLogisticsSchedulingFeasibility({
  request: base,
  existingActivities: [{
    id: 'existing-1',
    organization_id: 'l11.6-org',
    location_id: 'l11.6-location',
    activity_type: 'PICKUP',
    status: 'CONFIRMED',
    scheduled_start: '2026-10-10T09:30:00Z',
    scheduled_end: '2026-10-10T10:30:00Z',
    related_movement_id: 'movement-1',
  }],
});
assert.equal(overlapping.evaluation, 'CONFLICT');
assert.equal(overlapping.reason, 'EXISTING_ACTIVITY_OVERLAP');
assert.deepEqual(overlapping.conflictingActivityIds, ['existing-1']);

const unrelated = evaluateLogisticsSchedulingFeasibility({
  request: base,
  existingActivities: [{
    id: 'existing-2',
    organization_id: 'l11.6-org',
    location_id: 'l11.6-location',
    activity_type: 'PICKUP',
    status: 'CONFIRMED',
    scheduled_start: '2026-10-10T09:30:00Z',
    scheduled_end: '2026-10-10T10:30:00Z',
    related_movement_id: 'movement-2',
  }],
});
assert.equal(unrelated.evaluation, 'UNKNOWN');
assert.equal(unrelated.conflictingActivityIds.length, 0);

const externallyFeasible = evaluateLogisticsSchedulingFeasibility({
  request: base,
  externalEvaluation: {
    outcome: 'FEASIBLE',
    authority: 'existing-capacity-authority',
    reference_id: 'capacity-check-1',
  },
});
assert.equal(externallyFeasible.evaluation, 'FEASIBLE');
assert.equal(externallyFeasible.reason, 'NO_CONFLICT');
assert.equal(externallyFeasible.feasible, true);
assert.equal(externallyFeasible.authorized, false);

const externallyConflicted = evaluateLogisticsSchedulingFeasibility({
  request: base,
  externalEvaluation: {
    outcome: 'CONFLICT',
    authority: 'existing-capacity-authority',
  },
});
assert.equal(externallyConflicted.evaluation, 'CONFLICT');
assert.equal(externallyConflicted.reason, 'EXTERNAL_CAPACITY_CONFLICT');
assert.equal(externallyConflicted.feasible, false);

const externallyUnknown = evaluateLogisticsSchedulingFeasibility({
  request: base,
  externalEvaluation: {
    outcome: 'UNKNOWN',
    authority: 'existing-capacity-authority',
  },
});
assert.equal(externallyUnknown.evaluation, 'UNKNOWN');
assert.equal(externallyUnknown.feasible, false);

const noWindow = evaluateLogisticsSchedulingFeasibility({
  request: {
    organization_id: 'l11.6-org',
    activity_type: 'PICKUP',
    mode: 'ON_DEMAND',
    related_movement: { id: 'movement-2', authority: 'logistics' },
  },
});
assert.equal(noWindow.evaluation, 'UNKNOWN');
assert.equal(noWindow.reason, 'NO_TIME_WINDOW');

const contract = logisticsSchedulingFeasibilityContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.createsCapacityAuthority, false);
assert.equal(contract.createsMatchingAuthority, false);
assert.equal(contract.createsCalendarAuthority, false);
assert.equal(contract.reservesCapacity, false);
assert.equal(contract.authorizesExecution, false);
assert.equal(contract.mutatesSchedulingState, false);

console.log('L11.6 Logistics Scheduling Feasibility Regression: PASS');
