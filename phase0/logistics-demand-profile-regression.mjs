import assert from 'node:assert/strict';
import {
  getLogisticsDemandProfile,
  normalizeLogisticsDemand,
  validateLogisticsDemandProfile,
  assertLogisticsDemandBoundary,
  logisticsDemandProfileContract,
} from '../app/src/verticals/logistics/logistics-demand-profile-contract.js';

const contract = logisticsDemandProfileContract();
assert.equal(contract.version, '1.0');
assert.deepEqual(contract.service_profiles, [
  'REGIONAL_FREIGHT', 'B2B_DISTRIBUTION', 'B2C_DELIVERY', 'P2P_DELIVERY',
]);
assert.equal(contract.matching_authority, 'existing_discovery_matching');
assert.equal(contract.selection, false);
assert.equal(contract.assignment, false);
assert.equal(contract.execution, false);
assert.equal(contract.duplicate_matching_authority, false);
assert.equal(contract.order_authority, false);
assert.equal(contract.shipment_authority, false);
assert.equal(contract.inventory_mutation, false);
assert.equal(contract.payment_mutation, false);

const input = {
  serviceProfile: 'regional_freight',
  origin: { type: 'farm', ref: 'farm-1' },
  destination: { type: 'depot', ref: 'depot-1' },
  timing: { mode: 'scheduled', start: '2026-10-05T08:00:00Z' },
  payload: { weightKg: 18000 },
  capacityRequirements: { vehicleType: 'heavy_truck', payloadKg: 20000 },
  handlingRequirements: { fragile: false },
  evidenceRequirements: { required: ['waybill', 'checkpoint', 'delivery'] },
  actorContext: { organizationId: 'org-1' },
  sourceContext: { source: 'merchant_request' },
};

const normalized = normalizeLogisticsDemand(input);
assert.equal(normalized.service_profile, 'REGIONAL_FREIGHT');
assert.equal(normalized.relationship_profile, 'b2b');
assert.equal(normalized.physical_scale, 'regional');
assert.deepEqual(normalized.origin, input.origin);
assert.deepEqual(normalized.capacity_requirements, input.capacityRequirements);
assert.deepEqual(normalized.payload, input.payload);

for (const serviceProfile of contract.service_profiles) {
  const profile = getLogisticsDemandProfile(serviceProfile);
  const result = validateLogisticsDemandProfile({
    serviceProfile,
    origin: { ref: 'origin-1' },
    destination: { ref: 'destination-1' },
    timing: { mode: 'on_demand' },
    payload: { weightKg: 5 },
    capacityRequirements: { vehicleType: 'motorbike' },
  });
  assert.equal(result.valid, true);
  assert.equal(result.demand.service_profile, serviceProfile);
  assert.ok(profile.required_fields.length > 0);
}

assert.equal(
  validateLogisticsDemandProfile({ serviceProfile: 'B2C_DELIVERY' }).valid,
  false,
);
assert.equal(
  validateLogisticsDemandProfile({
    serviceProfile: 'B2C_DELIVERY',
    origin: { ref: 'origin-1' },
    destination: { ref: 'destination-1' },
    timing: { mode: 'immediate' },
    payload: { weightKg: 2 },
    capacityRequirements: { vehicleType: 'motorbike' },
    providerId: 'spoof-provider',
  }).valid,
  false,
);

for (const field of [
  'order_id', 'shipment_id', 'payment_id', 'inventory_id',
  'provider_id', 'provider_selection', 'assignment_id', 'execution_id', 'match_id',
]) {
  assert.throws(() => normalizeLogisticsDemand({
    serviceProfile: 'B2C_DELIVERY',
    origin: { ref: 'origin-1' },
    destination: { ref: 'destination-1' },
    timing: { mode: 'immediate' },
    payload: { weightKg: 2 },
    capacityRequirements: { vehicleType: 'motorbike' },
    [field]: 'spoof',
  }), /must not accept authority field/);
}

assert.deepEqual(assertLogisticsDemandBoundary(), {
  valid: true, reason: 'DEMAND_BOUNDARY_VALID',
});
assert.deepEqual(assertLogisticsDemandBoundary({ organizationScoped: false }), {
  valid: false, reason: 'DEMAND_ORGANIZATION_SCOPE_REQUIRED',
});
assert.deepEqual(assertLogisticsDemandBoundary({ authorized: false }), {
  valid: false, reason: 'DEMAND_AUTHORIZATION_REQUIRED',
});
assert.deepEqual(assertLogisticsDemandBoundary({ discoveryAuthority: false }), {
  valid: false, reason: 'EXISTING_DISCOVERY_MATCHING_REQUIRED',
});
assert.deepEqual(assertLogisticsDemandBoundary({ downstreamMutation: true }), {
  valid: false, reason: 'DEMAND_MUST_NOT_MUTATE_DOWNSTREAM_AUTHORITY',
});
assert.deepEqual(assertLogisticsDemandBoundary({ providerSelection: true }), {
  valid: false, reason: 'DEMAND_MUST_NOT_SELECT_PROVIDER',
});
assert.deepEqual(assertLogisticsDemandBoundary({ execution: true }), {
  valid: false, reason: 'DEMAND_MUST_NOT_EXECUTE',
});

console.log('L8 Logistics Demand / Service Profile Regression: PASS');
