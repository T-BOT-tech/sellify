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
  assertDynamicCapacityUtilizationBoundary,
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

console.log(
  'L19.1 Dynamic Capacity Utilization optional 24/7 baseline + cross-service preference boundary regression: PASS',
);
