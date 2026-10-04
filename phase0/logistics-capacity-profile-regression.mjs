import assert from 'node:assert/strict';
import {
  normalizeLogisticsCapacityProfile,
  capacityProfileSupportsService,
  capacityProfileCanSatisfyPayload,
  assertLogisticsCapacityBoundary,
  logisticsCapacityProfileContract,
} from '../app/src/verticals/logistics/logistics-capacity-profile-contract.js';

const contract = logisticsCapacityProfileContract();
assert.equal(contract.version, '1.0');
assert.equal(contract.matching_authority, 'existing_discovery_matching');
assert.equal(contract.provider_selection, false);
assert.equal(contract.assignment, false);
assert.equal(contract.reservation, false);
assert.equal(contract.dispatch_execution, false);
assert.equal(contract.routing, false);
assert.equal(contract.scheduling, false);
assert.equal(contract.duplicate_capacity_ledger, false);
assert.equal(contract.duplicate_matching_authority, false);

const capacity = normalizeLogisticsCapacityProfile({
  capacityRef: 'capacity-1',
  organizationId: 'org-1',
  vehicleType: 'heavy_truck',
  payloadCapacityKg: 20000,
  volumeCapacityM3: 45,
  dimensions: { lengthM: 8, widthM: 2.5, heightM: 2.8 },
  operatingArea: { corridor: 'ADDIS-DIRE_DAWA' },
  serviceProfiles: ['REGIONAL_FREIGHT', 'B2B_DISTRIBUTION'],
  availability: { status: 'available' },
  schedule: { mode: 'scheduled' },
  ownerRef: 'fleet-1',
  providerRef: 'provider-1',
  eligibility: { licensed: true },
});

assert.equal(capacity.vehicle_type, 'heavy_truck');
assert.equal(capacity.payload_capacity_kg, 20000);
assert.deepEqual(capacity.service_profiles, ['REGIONAL_FREIGHT', 'B2B_DISTRIBUTION']);
assert.equal(capacityProfileSupportsService(capacity, 'regional_freight'), true);
assert.equal(capacityProfileSupportsService(capacity, 'B2C_DELIVERY'), false);
assert.equal(capacityProfileCanSatisfyPayload(capacity, { weightKg: 18000, volumeM3: 40 }), true);
assert.equal(capacityProfileCanSatisfyPayload(capacity, { weightKg: 22000 }), false);
assert.equal(capacityProfileCanSatisfyPayload(capacity, { weightKg: 18000, volumeM3: 50 }), false);

assert.throws(() => normalizeLogisticsCapacityProfile({
  capacityRef: 'capacity-1', organizationId: 'org-1', vehicleType: 'truck',
  payloadCapacityKg: 0,
}), /positive number/);

assert.deepEqual(assertLogisticsCapacityBoundary(), {
  valid: true, reason: 'CAPACITY_BOUNDARY_VALID',
});
for (const [field, reason] of [
  ['createsCapacityLedger', 'CAPACITY_LEDGER_FORBIDDEN'],
  ['createsReservationAuthority', 'CAPACITY_RESERVATION_AUTHORITY_FORBIDDEN'],
  ['selectsProvider', 'PROVIDER_SELECTION_FORBIDDEN'],
  ['assignsProvider', 'PROVIDER_ASSIGNMENT_FORBIDDEN'],
  ['dispatches', 'DISPATCH_EXECUTION_FORBIDDEN'],
  ['routes', 'ROUTING_AUTHORITY_FORBIDDEN'],
  ['schedules', 'SCHEDULING_AUTHORITY_FORBIDDEN'],
  ['executes', 'EXTERNAL_EXECUTION_FORBIDDEN'],
  ['mutatesCanonicalDomain', 'CANONICAL_DOMAIN_MUTATION_FORBIDDEN'],
]) {
  assert.deepEqual(assertLogisticsCapacityBoundary({ [field]: true }), {
    valid: false, reason,
  });
}

console.log('L9 Logistics Capacity Profile Regression: PASS');
