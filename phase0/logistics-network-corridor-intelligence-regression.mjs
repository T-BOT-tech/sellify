// L20.1 — Network / Corridor Intelligence Regression.

import assert from 'node:assert/strict';
import {
  normalizeNetworkIntelligenceObservation,
  deriveNetworkCorridorIntelligence,
  assertNetworkCorridorIntelligenceBoundary,
  logisticsNetworkCorridorIntelligenceContract,
  deriveCorridorDemandSignal,
  deriveBackhaulOpportunitySignal,
  deriveDepotThroughputSignal,
  deriveCapacityShortageSignal,
  deriveServiceAreaGapSignal,
  deriveRecurringDemandSignal,
  deriveProviderCapacityVisibilitySignal,
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

const demandSignal = deriveCorridorDemandSignal({
  observations: [
    observation,
    { ...observation, observation_ref: 'OBS-002', demand_count: 10, fulfilled_count: 4, recurring_demand_count: 6 },
  ],
});
assert.equal(demandSignal.organization_id, 'org-1');
assert.equal(demandSignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(demandSignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(demandSignal.observation_count, 2);
assert.equal(demandSignal.total_demand, 30);
assert.equal(demandSignal.total_fulfilled, 19);
assert.equal(demandSignal.unmet_demand, 11);
assert.equal(demandSignal.fulfillment_rate, 19 / 30);
assert.equal(demandSignal.recurring_demand, 13);
assert.equal(demandSignal.authority, 'logistics_derived_intelligence');
assert.equal(demandSignal.persistence, 'none');
assert.equal(demandSignal.routing, false);
assert.equal(demandSignal.provider_selection, false);
assert.equal(demandSignal.assignment, false);

const backhaulSignal = deriveBackhaulOpportunitySignal({
  observations: [
    observation,
    { ...observation, observation_ref: 'OBS-003', backhaul_count: 2, capacity_count: 5, demand_count: 8, fulfilled_count: 6 },
  ],
});
assert.equal(backhaulSignal.organization_id, 'org-1');
assert.equal(backhaulSignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(backhaulSignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(backhaulSignal.observation_count, 2);
assert.equal(backhaulSignal.backhaul_opportunities, 5);
assert.equal(backhaulSignal.available_capacity, 13);
assert.equal(backhaulSignal.demand, 28);
assert.equal(backhaulSignal.fulfilled_demand, 21);
assert.equal(backhaulSignal.utilization_gap, 7);
assert.equal(backhaulSignal.backhaul_signal, 'AVAILABLE');
assert.equal(backhaulSignal.authority, 'logistics_derived_intelligence');
assert.equal(backhaulSignal.persistence, 'none');
assert.equal(backhaulSignal.routing, false);
assert.equal(backhaulSignal.provider_selection, false);
assert.equal(backhaulSignal.assignment, false);
assert.equal(backhaulSignal.transaction, false);

const depotSignal = deriveDepotThroughputSignal({
  observations: [
    observation,
    { ...observation, observation_ref: 'OBS-004', throughput_count: 8, demand_count: 12, capacity_count: 6 },
  ],
});
assert.equal(depotSignal.organization_id, 'org-1');
assert.equal(depotSignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(depotSignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(depotSignal.observation_count, 2);
assert.equal(depotSignal.throughput, 50);
assert.equal(depotSignal.demand, 32);
assert.equal(depotSignal.available_capacity, 14);
assert.equal(depotSignal.throughput_gap, 0);
assert.equal(depotSignal.throughput_signal, 'THROUGHPUT_COVERS_DEMAND');
assert.equal(depotSignal.authority, 'logistics_derived_intelligence');
assert.equal(depotSignal.warehouse_authority, 'existing_warehouse');
assert.equal(depotSignal.inventory_authority, 'existing_inventory');
assert.equal(depotSignal.persistence, 'none');
assert.equal(depotSignal.stock_mutation, false);
assert.equal(depotSignal.fulfillment_mutation, false);
assert.equal(depotSignal.routing, false);
assert.equal(depotSignal.provider_selection, false);
assert.equal(depotSignal.assignment, false);
assert.equal(depotSignal.transaction, false);

const shortageSignal = deriveCapacityShortageSignal({
  observations: [
    observation,
    { ...observation, observation_ref: 'OBS-005', demand_count: 12, fulfilled_count: 5, shortage_count: 3, capacity_count: 2 },
  ],
});
assert.equal(shortageSignal.organization_id, 'org-1');
assert.equal(shortageSignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(shortageSignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(shortageSignal.observation_count, 2);
assert.equal(shortageSignal.demand, 32);
assert.equal(shortageSignal.fulfilled_demand, 20);
assert.equal(shortageSignal.unmet_demand, 12);
assert.equal(shortageSignal.observed_shortage, 7);
assert.equal(shortageSignal.available_capacity, 10);
assert.equal(shortageSignal.shortage_signal, 'SHORTAGE_OBSERVED');
assert.equal(shortageSignal.authority, 'logistics_derived_intelligence');
assert.equal(shortageSignal.capacity_authority, 'existing_capacity_authority');
assert.equal(shortageSignal.reservation_authority, false);
assert.equal(shortageSignal.capacity_ledger, false);
assert.equal(shortageSignal.persistence, 'none');
assert.equal(shortageSignal.routing, false);
assert.equal(shortageSignal.provider_selection, false);
assert.equal(shortageSignal.assignment, false);
assert.equal(shortageSignal.transaction, false);

const serviceAreaSignal = deriveServiceAreaGapSignal({
  observations: [
    observation,
    { ...observation, observation_ref: 'OBS-006', service_area_gap_count: 4, demand_count: 9, fulfilled_count: 5 },
  ],
});
assert.equal(serviceAreaSignal.organization_id, 'org-1');
assert.equal(serviceAreaSignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(serviceAreaSignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(serviceAreaSignal.observation_count, 2);
assert.equal(serviceAreaSignal.demand, 29);
assert.equal(serviceAreaSignal.fulfilled_demand, 20);
assert.equal(serviceAreaSignal.unmet_demand, 9);
assert.equal(serviceAreaSignal.observed_service_area_gap, 6);
assert.equal(serviceAreaSignal.coverage_signal, 'SERVICE_AREA_GAP_OBSERVED');
assert.equal(serviceAreaSignal.authority, 'logistics_derived_intelligence');
assert.equal(serviceAreaSignal.location_authority, 'existing_locations');
assert.equal(serviceAreaSignal.gps_authority, false);
assert.equal(serviceAreaSignal.routing_authority, false);
assert.equal(serviceAreaSignal.provider_selection_authority, false);
assert.equal(serviceAreaSignal.dispatch_authority, false);
assert.equal(serviceAreaSignal.persistence, 'none');
assert.equal(serviceAreaSignal.transaction, false);

const noServiceGap = deriveServiceAreaGapSignal({
  observations: [{ ...observation, service_area_gap_count: 0 }],
});
assert.equal(noServiceGap.coverage_signal, 'NO_SERVICE_AREA_GAP_OBSERVED');

const recurringSignal = deriveRecurringDemandSignal({
  observations: [
    { ...observation, recurring_demand_count: 3, observation_ref: 'OBS-R1' },
    { ...observation, recurring_demand_count: 2, demand_count: 8, fulfilled_count: 6, observation_ref: 'OBS-R2' },
  ],
});
assert.equal(recurringSignal.organization_id, 'org-1');
assert.equal(recurringSignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(recurringSignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(recurringSignal.observation_count, 2);
assert.equal(recurringSignal.demand, 28);
assert.equal(recurringSignal.fulfilled_demand, 21);
assert.equal(recurringSignal.unmet_demand, 7);
assert.equal(recurringSignal.recurring_demand, 5);
assert.equal(recurringSignal.recurring_demand_signal, 'RECURRING_DEMAND_OBSERVED');
assert.equal(recurringSignal.authority, 'logistics_derived_intelligence');
assert.equal(recurringSignal.source_authority, 'existing_operational_domain_data');
assert.equal(recurringSignal.persistence, 'none');
assert.equal(recurringSignal.transaction, false);
assert.equal(recurringSignal.scheduling_authority, 'existing_l11_scheduling');
assert.equal(recurringSignal.reservation_authority, false);
assert.equal(recurringSignal.order_creation_authority, false);
assert.equal(recurringSignal.dispatch_authority, false);

const noRecurring = deriveRecurringDemandSignal({
  observations: [{ ...observation, recurring_demand_count: 0 }],
});
assert.equal(noRecurring.recurring_demand_signal, 'NO_RECURRING_DEMAND_OBSERVED');

const providerCapacitySignal = deriveProviderCapacityVisibilitySignal({
  observations: [
    { ...observation, capacity_count: 4, demand_count: 10, observation_ref: 'OBS-PC1' },
    { ...observation, capacity_count: 3, demand_count: 8, observation_ref: 'OBS-PC2' },
  ],
});
assert.equal(providerCapacitySignal.organization_id, 'org-1');
assert.equal(providerCapacitySignal.corridor_ref, 'ADDIS-DEPOT-01');
assert.equal(providerCapacitySignal.service_profile, 'REGIONAL_FREIGHT');
assert.equal(providerCapacitySignal.observation_count, 2);
assert.equal(providerCapacitySignal.observed_capacity, 7);
assert.equal(providerCapacitySignal.observed_demand, 18);
assert.equal(providerCapacitySignal.capacity_gap, 11);
assert.equal(providerCapacitySignal.visibility_signal, 'CAPACITY_VISIBLE');
assert.equal(providerCapacitySignal.authority, 'logistics_derived_intelligence');
assert.equal(providerCapacitySignal.source_authority, 'existing_operational_domain_data');
assert.equal(providerCapacitySignal.capacity_authority, 'existing_capacity_authority');
assert.equal(providerCapacitySignal.provider_registry_authority, false);
assert.equal(providerCapacitySignal.provider_selection_authority, false);
assert.equal(providerCapacitySignal.reservation_authority, false);
assert.equal(providerCapacitySignal.dispatch_authority, false);
assert.equal(providerCapacitySignal.persistence, 'none');
assert.equal(providerCapacitySignal.transaction, false);

const noCapacity = deriveProviderCapacityVisibilitySignal({
  observations: [{ ...observation, capacity_count: 0 }],
});
assert.equal(noCapacity.visibility_signal, 'NO_CAPACITY_OBSERVED');

assert.throws(() => deriveProviderCapacityVisibilitySignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-PC3' }],
}), /organization scope conflict/i);
assert.throws(() => deriveProviderCapacityVisibilitySignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-PC4' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveProviderCapacityVisibilitySignal({
  observations: [observation, { ...observation, service_profile: 'B2C_DELIVERY', observation_ref: 'OBS-PC5' }],
}), /service profile scope conflict/i);

assert.throws(() => deriveRecurringDemandSignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-R3' }],
}), /organization scope conflict/i);
assert.throws(() => deriveRecurringDemandSignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-R4' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveRecurringDemandSignal({
  observations: [observation, { ...observation, service_profile: 'B2C_DELIVERY', observation_ref: 'OBS-R5' }],
}), /service profile scope conflict/i);

assert.throws(() => deriveServiceAreaGapSignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-G1' }],
}), /organization scope conflict/i);
assert.throws(() => deriveServiceAreaGapSignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-G2' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveServiceAreaGapSignal({
  observations: [observation, { ...observation, service_profile: 'B2C_DELIVERY', observation_ref: 'OBS-G3' }],
}), /service profile scope conflict/i);

const noShortage = deriveCapacityShortageSignal({
  observations: [{ ...observation, demand_count: 5, fulfilled_count: 5, shortage_count: 0 }],
});
assert.equal(noShortage.shortage_signal, 'NO_SHORTAGE_OBSERVED');
assert.equal(noShortage.unmet_demand, 0);

assert.throws(() => deriveCapacityShortageSignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-S1' }],
}), /organization scope conflict/i);
assert.throws(() => deriveCapacityShortageSignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-S2' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveCapacityShortageSignal({
  observations: [observation, { ...observation, service_profile: 'B2C_DELIVERY', observation_ref: 'OBS-S3' }],
}), /service profile scope conflict/i);

const constrainedDepot = deriveDepotThroughputSignal({
  observations: [{
    ...observation,
    throughput_count: 3,
    demand_count: 10,
    observation_ref: 'OBS-DEPOT-GAP',
  }],
});
assert.equal(constrainedDepot.throughput_gap, 7);
assert.equal(constrainedDepot.throughput_signal, 'THROUGHPUT_BELOW_DEMAND');

assert.throws(() => deriveDepotThroughputSignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-D1' }],
}), /organization scope conflict/i);
assert.throws(() => deriveDepotThroughputSignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-D2' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveDepotThroughputSignal({
  observations: [observation, { ...observation, service_profile: 'B2B_DISTRIBUTION', observation_ref: 'OBS-D3' }],
}), /service profile scope conflict/i);

const noBackhaul = deriveBackhaulOpportunitySignal({
  observations: [{ ...observation, backhaul_count: 0 }],
});
assert.equal(noBackhaul.backhaul_signal, 'NONE_OBSERVED');

assert.throws(() => deriveBackhaulOpportunitySignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-B1' }],
}), /organization scope conflict/i);
assert.throws(() => deriveBackhaulOpportunitySignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-B2' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveBackhaulOpportunitySignal({
  observations: [observation, { ...observation, service_profile: 'P2P_DELIVERY', observation_ref: 'OBS-B3' }],
}), /service profile scope conflict/i);

assert.throws(() => deriveCorridorDemandSignal({
  observations: [observation, { ...observation, organization_id: 'org-2', observation_ref: 'OBS-X' }],
}), /organization scope conflict/i);
assert.throws(() => deriveCorridorDemandSignal({
  observations: [observation, { ...observation, corridor_ref: 'OTHER-CORRIDOR', observation_ref: 'OBS-Y' }],
}), /corridor scope conflict/i);
assert.throws(() => deriveCorridorDemandSignal({
  observations: [observation, { ...observation, service_profile: 'B2C_DELIVERY', observation_ref: 'OBS-Z' }],
}), /service profile scope conflict/i);

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
