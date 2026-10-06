// L19.1 — Dynamic Capacity Utilization Regression.
//
// Verifies that L19 is an optional optimization layer:
// - base capacity remains 24/7-capable;
// - B2B, B2C, and P2P remain independently eligible;
// - optional time windows influence preference only;
// - duplicate allocations are rejected;
// - organization scope and unauthorized duplicate authorities are rejected;
// - L19 does not reserve capacity or replace L11 scheduling.

import assert from 'node:assert/strict';
import {
  normalizeDynamicCapacityUtilizationRequest,
  evaluateDynamicCapacityUtilization,
  composeDynamicCapacityPool,
  buildDynamicCapacitySchedulingInput,
  applyDynamicCapacitySchedulingDecision,
  assertDynamicCapacityUtilizationBoundary,
  dynamicCapacityUtilizationClosureGate,
} from '../app/src/verticals/logistics/dynamic-capacity-utilization-contract.js';

const base = {
  organization_id: 'org-1',
  capacity_ref: 'COURIER-42',
  eligible_service_profiles: [
    'B2B_DISTRIBUTION',
    'B2C_DELIVERY',
    'P2P_DELIVERY',
  ],
};

const normalized = normalizeDynamicCapacityUtilizationRequest(base);

assert.equal(normalized.base_availability.mode, '24_7');
assert.deepEqual(normalized.allocations, []);
assert.equal(normalized.reservation_authority, 'none');

for (const profile of ['B2B_DISTRIBUTION', 'B2C_DELIVERY', 'P2P_DELIVERY']) {
  const result = evaluateDynamicCapacityUtilization({
    request: base,
    requestedProfile: profile,
    requestedStart: '2026-10-04T22:00:00Z',
    requestedEnd: '2026-10-04T23:00:00Z',
  });
  assert.equal(result.evaluation, 'AVAILABLE_BASELINE');
}

const pooled = {
  ...base,
  allocations: [
    {
      service_profile: 'B2B_DISTRIBUTION',
      start: '2026-10-04T06:00:00Z',
      end: '2026-10-04T11:00:00Z',
    },
    {
      service_profile: 'B2C_DELIVERY',
      start: '2026-10-04T11:00:00Z',
      end: '2026-10-04T17:00:00Z',
    },
    {
      service_profile: 'P2P_DELIVERY',
      start: '2026-10-04T17:00:00Z',
      end: '2026-10-04T21:00:00Z',
    },
  ],
};

const pooledNormalized = normalizeDynamicCapacityUtilizationRequest(pooled);
assert.equal(pooledNormalized.allocations.length, 3);

const overlappingPreferences = {
  ...base,
  allocations: [
    {
      service_profile: 'B2B_DISTRIBUTION',
      start: '2026-10-04T06:00:00Z',
      end: '2026-10-04T12:00:00Z',
    },
    {
      service_profile: 'B2C_DELIVERY',
      start: '2026-10-04T10:00:00Z',
      end: '2026-10-04T14:00:00Z',
    },
  ],
};
assert.equal(
  normalizeDynamicCapacityUtilizationRequest(overlappingPreferences).allocations.length,
  2,
);

// Overlapping PREFERRED windows are allowed because they are preferences,
// not exclusive reservations or a capacity ledger.

for (const [profile, start, end] of [
  ['B2B_DISTRIBUTION', '2026-10-04T06:00:00Z', '2026-10-04T07:00:00Z'],
  ['B2C_DELIVERY', '2026-10-04T12:00:00Z', '2026-10-04T13:00:00Z'],
  ['P2P_DELIVERY', '2026-10-04T18:00:00Z', '2026-10-04T19:00:00Z'],
]) {
  const result = evaluateDynamicCapacityUtilization({
    request: pooled,
    requestedProfile: profile,
    requestedStart: start,
    requestedEnd: end,
  });
  assert.equal(result.evaluation, 'PREFERRED_WINDOW');
  assert.equal(result.reservation, false);
}

const pool = composeDynamicCapacityPool({
  requests: [
    {
      ...base,
      capacity_ref: 'COURIER-42',
      allocations: [{
        service_profile: 'B2C_DELIVERY',
        start: '2026-10-04T11:00:00Z',
        end: '2026-10-04T17:00:00Z',
      }],
    },
    {
      ...base,
      capacity_ref: 'COURIER-43',
    },
  ],
  requestedProfile: 'B2C_DELIVERY',
  requestedStart: '2026-10-04T12:00:00Z',
  requestedEnd: '2026-10-04T13:00:00Z',
});

assert.equal(pool.evaluation, 'POOL_ELIGIBLE');
assert.equal(pool.candidates.length, 2);
assert.equal(pool.candidates[0].capacity_ref, 'COURIER-42');
assert.equal(pool.candidates[0].preference, 'PREFERRED');
assert.equal(pool.candidates[1].preference, 'BASELINE');
assert.equal(pool.reservation, false);
assert.equal(pool.persistence, 'none');

const schedulingInput = buildDynamicCapacitySchedulingInput({
  pool,
  capacityRef: 'COURIER-42',
  requestedProfile: 'B2C_DELIVERY',
  requestedStart: '2026-10-04T12:00:00Z',
  requestedEnd: '2026-10-04T13:00:00Z',
  schedulingContext: { related_order_ref: 'ORDER-42' },
});

assert.equal(schedulingInput.utilization_preference, 'PREFERRED');
assert.equal(schedulingInput.decision_authority, 'existing_l11_scheduling');
assert.equal(schedulingInput.reservation, false);
assert.equal(schedulingInput.authorization, false);
assert.equal(schedulingInput.assignment, false);

const feasibleDecision = applyDynamicCapacitySchedulingDecision({
  schedulingInput,
  evaluation: { evaluation: 'FEASIBLE', feasible: true },
});

assert.equal(feasibleDecision.scheduling_decision, 'SCHEDULE');
assert.equal(feasibleDecision.decision_authority, 'existing_l11_scheduling');
assert.equal(feasibleDecision.authorized, false);
assert.equal(feasibleDecision.execution, false);
assert.equal(feasibleDecision.assignment, false);

const conflictDecision = applyDynamicCapacitySchedulingDecision({
  schedulingInput,
  evaluation: { evaluation: 'CONFLICT' },
});

assert.equal(conflictDecision.scheduling_decision, 'BLOCK');
assert.equal(conflictDecision.reservation, false);

const unknownDecision = applyDynamicCapacitySchedulingDecision({
  schedulingInput,
  evaluation: { evaluation: 'UNKNOWN' },
});

assert.equal(unknownDecision.scheduling_decision, 'BLOCK');



const mixedTenantPool = composeDynamicCapacityPool({
  requests: [
    { ...base, organization_id: 'org-1', capacity_ref: 'COURIER-42' },
    { ...base, organization_id: 'org-2', capacity_ref: 'COURIER-99' },
  ],
  requestedProfile: 'B2C_DELIVERY',
  requestedStart: '2026-10-04T12:00:00Z',
  requestedEnd: '2026-10-04T13:00:00Z',
});

assert.equal(mixedTenantPool.evaluation, 'INELIGIBLE');
assert.equal(mixedTenantPool.reason, 'POOL_ORGANIZATION_SCOPE_CONFLICT');
assert.equal(mixedTenantPool.candidates.length, 0);
assert.equal(
  evaluateDynamicCapacityUtilization({
    request: pooled,
    requestedProfile: 'REGIONAL_FREIGHT',
    requestedStart: '2026-10-04T07:00:00Z',
    requestedEnd: '2026-10-04T08:00:00Z',
  }).evaluation,
  'INELIGIBLE',
);

assert.throws(
  () => normalizeDynamicCapacityUtilizationRequest({
    ...pooled,
    allocations: [
      pooled.allocations[0],
      pooled.allocations[0],
    ],
  }),
  /duplicate utilization allocation/i,
);

assert.throws(
  () => normalizeDynamicCapacityUtilizationRequest({
    ...base,
    allocations: [
      {
        service_profile: 'B2C_DELIVERY',
        start: '2026-10-04T12:00:00Z',
        end: '2026-10-04T13:00:00Z',
        mode: 'PREFERRED',
      },
      {
        service_profile: 'B2C_DELIVERY',
        start: '2026-10-04T12:00:00Z',
        end: '2026-10-04T13:00:00Z',
        mode: 'PREFERRED',
      },
    ],
  }),
  /duplicate utilization allocation is not allowed/i,
);

assert.throws(
  () => applyDynamicCapacitySchedulingDecision({
    schedulingInput: {
      ...schedulingInput,
      decision_authority: 'l19_dynamic_utilization',
    },
    evaluation: { evaluation: 'FEASIBLE', feasible: true },
  }),
  /existing L11 scheduling/i,
);

assert.throws(
  () => applyDynamicCapacitySchedulingDecision({
    schedulingInput,
    evaluation: { evaluation: 'FEASIBLE', feasible: false },
  }),
  /feasibility flag conflicts with evaluation outcome/i,
);

assert.throws(
  () => normalizeDynamicCapacityUtilizationRequest({
    ...base,
    eligible_service_profiles: ['B2C_DELIVERY'],
    allocations: [{
      service_profile: 'P2P_DELIVERY',
      start: '2026-10-04T17:00:00Z',
      end: '2026-10-04T21:00:00Z',
    }],
  }),
  /not eligible/i,
);

assert.equal(
  assertDynamicCapacityUtilizationBoundary({}).valid,
  true,
);

for (const field of [
  'createsCapacityAuthority',
  'createsCapacityLedger',
  'createsReservationAuthority',
  'createsCourierRegistry',
  'createsProviderRegistry',
  'createsDispatchAuthority',
  'createsRoutingAuthority',
  'createsGpsAuthority',
  'createsSchedulingAuthority',
  'mutatesAssignment',
]) {
  assert.equal(
    assertDynamicCapacityUtilizationBoundary({ [field]: true }).valid,
    false,
    field,
  );
}

assert.equal(
  assertDynamicCapacityUtilizationBoundary({ organizationScoped: false }).reason,
  'DYNAMIC_CAPACITY_ORGANIZATION_SCOPE_REQUIRED',
);

// L19.5 — Cross-profile adversarial coverage.
// Each profile remains independently available outside its optional preference
// window; overlapping preferences never become reservations or exclusivity.
const allProfilesRequest = {
  organization_id: 'org-cross-profile',
  capacity_ref: 'CAP-24-7',
  eligible_service_profiles: [
    'REGIONAL_FREIGHT',
    'B2B_DISTRIBUTION',
    'B2C_DELIVERY',
    'P2P_DELIVERY',
  ],
  allocations: [
    {
      service_profile: 'REGIONAL_FREIGHT',
      start: '2026-10-04T06:00:00Z',
      end: '2026-10-04T12:00:00Z',
    },
    {
      service_profile: 'B2B_DISTRIBUTION',
      start: '2026-10-04T10:00:00Z',
      end: '2026-10-04T16:00:00Z',
    },
    {
      service_profile: 'B2C_DELIVERY',
      start: '2026-10-04T12:00:00Z',
      end: '2026-10-04T20:00:00Z',
    },
    {
      service_profile: 'P2P_DELIVERY',
      start: '2026-10-04T18:00:00Z',
      end: '2026-10-05T00:00:00Z',
    },
  ],
};

for (const profile of [
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]) {
  const preferred = evaluateDynamicCapacityUtilization({
    request: allProfilesRequest,
    requestedProfile: profile,
    requestedStart: '2026-10-04T12:30:00Z',
    requestedEnd: '2026-10-04T13:30:00Z',
  });

  assert.equal(preferred.evaluation, 'PREFERRED_WINDOW');
  assert.equal(preferred.reservation, false);

  const outsideWindow = evaluateDynamicCapacityUtilization({
    request: allProfilesRequest,
    requestedProfile: profile,
    requestedStart: '2026-10-05T02:00:00Z',
    requestedEnd: '2026-10-05T03:00:00Z',
  });

  assert.equal(outsideWindow.evaluation, 'AVAILABLE_BASELINE');
  assert.equal(outsideWindow.reservation, false);
}

const crossProfilePool = composeDynamicCapacityPool({
  requests: [
    {
      ...allProfilesRequest,
      capacity_ref: 'CAP-24-7',
    },
    {
      organization_id: 'org-cross-profile',
      capacity_ref: 'CAP-B2C',
      eligible_service_profiles: ['B2C_DELIVERY'],
      allocations: [{
        service_profile: 'B2C_DELIVERY',
        start: '2026-10-04T12:00:00Z',
        end: '2026-10-04T14:00:00Z',
      }],
    },
    {
      organization_id: 'org-cross-profile',
      capacity_ref: 'CAP-P2P',
      eligible_service_profiles: ['P2P_DELIVERY'],
    },
  ],
  requestedProfile: 'B2C_DELIVERY',
  requestedStart: '2026-10-04T12:30:00Z',
  requestedEnd: '2026-10-04T13:30:00Z',
});

assert.equal(crossProfilePool.evaluation, 'POOL_ELIGIBLE');
assert.equal(crossProfilePool.candidates.length, 2);
assert.equal(crossProfilePool.candidates[0].preference, 'PREFERRED');
assert.equal(crossProfilePool.candidates[0].capacity_ref, 'CAP-24-7');
assert.equal(crossProfilePool.candidates[1].preference, 'PREFERRED');
assert.equal(crossProfilePool.candidates[1].capacity_ref, 'CAP-B2C');
assert.equal(crossProfilePool.reservation, false);
assert.equal(crossProfilePool.persistence, 'none');

assert.throws(
  () => buildDynamicCapacitySchedulingInput({
    pool: crossProfilePool,
    capacityRef: 'CAP-P2P',
    requestedProfile: 'B2C_DELIVERY',
    requestedStart: '2026-10-04T12:30:00Z',
    requestedEnd: '2026-10-04T13:30:00Z',
  }),
  /not an eligible member/i,
);

const noProfilePool = composeDynamicCapacityPool({
  requests: [{
    organization_id: 'org-cross-profile',
    capacity_ref: 'CAP-EMPTY',
    eligible_service_profiles: ['B2C_DELIVERY'],
  }],
  requestedProfile: 'P2P_DELIVERY',
  requestedStart: '2026-10-04T12:30:00Z',
  requestedEnd: '2026-10-04T13:30:00Z',
});

assert.equal(noProfilePool.evaluation, 'INELIGIBLE');
assert.equal(noProfilePool.candidates.length, 0);

for (const field of [
  'createsCapacityAuthority',
  'createsCapacityLedger',
  'createsReservationAuthority',
  'createsCourierRegistry',
  'createsProviderRegistry',
  'createsDispatchAuthority',
  'createsRoutingAuthority',
  'createsGpsAuthority',
  'createsSchedulingAuthority',
  'mutatesAssignment',
]) {
  const boundary = assertDynamicCapacityUtilizationBoundary({ [field]: true });
  assert.equal(boundary.valid, false, field);
}

const closure = dynamicCapacityUtilizationClosureGate();

assert.equal(closure.valid, true);
assert.equal(closure.reason, 'DYNAMIC_CAPACITY_UTILIZATION_CLOSURE_VALIDATED');
assert.equal(closure.base_availability, '24/7 capable when supported by existing capacity authority');
assert.equal(closure.allocation_mode, 'PREFERRED');
assert.equal(closure.scheduling_authority, 'existing_l11_scheduling');
assert.equal(closure.assignment_authority, 'existing_logistics_assignment');
assert.equal(closure.persistence, 'none');
assert.equal(closure.reservation_authority, 'none');
assert.deepEqual(closure.profiles, [
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

console.log(
  'L19.6 Dynamic Capacity Utilization Closure Gate: PASS',
);

console.log(
  'L19.1 Dynamic Capacity Utilization optional 24/7 baseline + cross-service preference boundary regression: PASS',
);
