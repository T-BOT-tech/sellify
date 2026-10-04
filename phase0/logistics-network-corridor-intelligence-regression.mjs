// L20.1 — Network / Corridor Intelligence Regression.

import assert from 'node:assert/strict';
import {
  normalizeNetworkIntelligenceObservation,
  deriveNetworkCorridorIntelligence,
  assertNetworkCorridorIntelligenceBoundary,
  logisticsNetworkCorridorIntelligenceContract,
} from '../app/src/verticals/logistics/network-corridor-intelligence-contract.js';

const observation = {
  organization_id: 'org-1',
  corridor_ref: 'ADDIS-DEPOT-01',
  service_profile: 'REGIONAL_FREIGHT',
  observation_ref: 'OBS-001',
  demand_count: 20,
  fulfilled_count: 15,
  capacity_count: 8,
  backhaul_count: 3,
  throughput_count: 42,
  shortage_count: 4,
  service_area_gap_count: 2,
  recurring_demand_count: 7,
};

const normalized = normalizeNetworkIntelligenceObservation(observation);

assert.equal(normalized.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(normalized.demand_count, 20);
assert.equal(normalized.fulfilled_count, 15);
assert.equal(normalized.persistence, 'none');
assert.equal(normalized.routing_authority, false);
assert.equal(normalized.provider_selection_authority, false);

const derived = deriveNetworkCorridorIntelligence({ observation });

assert.equal(derived.metrics.CORRIDOR_DEMAND, 20);
assert.equal(derived.metrics.BACKHAUL_OPPORTUNITY, 3);
assert.equal(derived.metrics.DEPOT_THROUGHPUT, 42);
assert.equal(derived.metrics.CAPACITY_SHORTAGE, 4);
assert.equal(derived.metrics.SERVICE_AREA_GAP, 2);
assert.equal(derived.metrics.RECURRING_DEMAND, 7);
assert.equal(derived.metrics.PROVIDER_CAPACITY_VISIBILITY, 8);
assert.equal(derived.unmet_demand, 5);
assert.equal(derived.fulfillment_rate, 0.75);
assert.equal(derived.authority, 'logistics_derived_intelligence');
assert.equal(derived.routing, false);
assert.equal(derived.provider_selection, false);
assert.equal(derived.assignment, false);
assert.equal(derived.transaction, false);

for (const profile of [
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]) {
  const result = deriveNetworkCorridorIntelligence({
    observation: {
      ...observation,
      service_profile: profile,
      observation_ref: `OBS-${profile}`,
    },
  });
  assert.equal(result.service_profile, profile);
}

assert.throws(
  () => normalizeNetworkIntelligenceObservation({
    ...observation,
    fulfilled_count: 21,
  }),
  /fulfilled_count cannot exceed demand_count/i,
);

assert.throws(
  () => normalizeNetworkIntelligenceObservation({
    ...observation,
    demand_count: -1,
  }),
  /non-negative integer/i,
);

assert.equal(
  assertNetworkCorridorIntelligenceBoundary({}).valid,
  true,
);

for (const field of [
  'createsTransactionAuthority',
  'createsRoutingAuthority',
  'createsProviderSelectionAuthority',
  'createsProviderRegistry',
  'createsCapacityAuthority',
  'createsCapacityLedger',
  'createsShipmentAuthority',
  'createsFulfillmentAuthority',
  'createsEventStore',
  'persistsIntelligence',
  'mutatesOperationalState',
]) {
  assert.equal(
    assertNetworkCorridorIntelligenceBoundary({ [field]: true }).valid,
    false,
    field,
  );
}

assert.equal(
  assertNetworkCorridorIntelligenceBoundary({ organizationScoped: false }).reason,
  'NETWORK_INTELLIGENCE_ORGANIZATION_SCOPE_REQUIRED',
);

const contract = logisticsNetworkCorridorIntelligenceContract();
assert.equal(contract.persistence, 'none');
assert.equal(contract.routing_authority, false);
assert.equal(contract.provider_selection_authority, false);
assert.equal(contract.capacity_ledger, false);
assert.equal(contract.event_store, false);
assert.deepEqual(contract.metrics, [
  'CORRIDOR_DEMAND',
  'BACKHAUL_OPPORTUNITY',
  'DEPOT_THROUGHPUT',
  'CAPACITY_SHORTAGE',
  'SERVICE_AREA_GAP',
  'RECURRING_DEMAND',
  'PROVIDER_CAPACITY_VISIBILITY',
]);

console.log('L20.1 Network / Corridor Intelligence Boundary Regression: PASS');
