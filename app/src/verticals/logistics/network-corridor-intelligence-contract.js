// L20.1 — Logistics Network / Corridor Intelligence Contract.
//
// Derived operational intelligence only.
// This boundary consumes validated operational observations and derives
// corridor demand, backhaul opportunities, depot throughput, capacity
// shortages, service-area gaps, recurring demand, and provider-capacity
// visibility. It creates no transaction, routing, provider, capacity,
// fulfillment, shipment, or event authority.

export const LOGISTICS_NETWORK_CORRIDOR_INTELLIGENCE_CONTRACT_VERSION = '1.0';

export const NETWORK_INTELLIGENCE_METRICS = Object.freeze([
  'CORRIDOR_DEMAND',
  'BACKHAUL_OPPORTUNITY',
  'DEPOT_THROUGHPUT',
  'CAPACITY_SHORTAGE',
  'SERVICE_AREA_GAP',
  'RECURRING_DEMAND',
  'PROVIDER_CAPACITY_VISIBILITY',
]);

const METRICS = new Set(NETWORK_INTELLIGENCE_METRICS);
const PROFILES = new Set([
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

function invalid(message) {
  const error = new TypeError(
    `Invalid logistics network/corridor intelligence: ${message}`,
  );
  error.code = 'LOGISTICS_NETWORK_CORRIDOR_INTELLIGENCE_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    invalid(`${field} must be a non-negative integer`);
  }
  return value;
}

function normalizeProfile(value, field) {
  const result = text(value, field).toUpperCase();
  if (!PROFILES.has(result)) invalid(`unsupported service profile: ${result}`);
  return result;
}

export function normalizeNetworkIntelligenceObservation(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('observation must be an object');
  }

  const organizationId = text(
    input.organization_id ?? input.organizationId,
    'organization_id',
  );
  const corridorRef = text(
    input.corridor_ref ?? input.corridorRef,
    'corridor_ref',
  );
  const serviceProfile = normalizeProfile(
    input.service_profile ?? input.serviceProfile,
    'service_profile',
  );

  const observationRef = text(
    input.observation_ref ?? input.observationRef,
    'observation_ref',
  );

  const demandCount = nonNegativeInteger(
    input.demand_count ?? input.demandCount ?? 0,
    'demand_count',
  );
  const fulfilledCount = nonNegativeInteger(
    input.fulfilled_count ?? input.fulfilledCount ?? 0,
    'fulfilled_count',
  );
  const capacityCount = nonNegativeInteger(
    input.capacity_count ?? input.capacityCount ?? 0,
    'capacity_count',
  );
  const backhaulCount = nonNegativeInteger(
    input.backhaul_count ?? input.backhaulCount ?? 0,
    'backhaul_count',
  );
  const throughputCount = nonNegativeInteger(
    input.throughput_count ?? input.throughputCount ?? 0,
    'throughput_count',
  );
  const shortageCount = nonNegativeInteger(
    input.shortage_count ?? input.shortageCount ?? 0,
    'shortage_count',
  );
  const serviceAreaGapCount = nonNegativeInteger(
    input.service_area_gap_count ?? input.serviceAreaGapCount ?? 0,
    'service_area_gap_count',
  );
  const recurringDemandCount = nonNegativeInteger(
    input.recurring_demand_count ?? input.recurringDemandCount ?? 0,
    'recurring_demand_count',
  );

  if (fulfilledCount > demandCount) {
    invalid('fulfilled_count cannot exceed demand_count');
  }

  return Object.freeze({
    contract_version: LOGISTICS_NETWORK_CORRIDOR_INTELLIGENCE_CONTRACT_VERSION,
    organization_id: organizationId,
    corridor_ref: corridorRef,
    service_profile: serviceProfile,
    observation_ref: observationRef,
    demand_count: demandCount,
    fulfilled_count: fulfilledCount,
    capacity_count: capacityCount,
    backhaul_count: backhaulCount,
    throughput_count: throughputCount,
    shortage_count: shortageCount,
    service_area_gap_count: serviceAreaGapCount,
    recurring_demand_count: recurringDemandCount,
    source_authority: 'existing_operational_domain_data',
    intelligence_authority: 'logistics_derived_intelligence',
    persistence: 'none',
    transaction_authority: 'none',
    routing_authority: false,
    provider_selection_authority: false,
    capacity_authority: 'existing_capacity_authority',
  });
}


export function deriveCorridorDemandSignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const totalDemand = normalized.reduce((sum, item) => sum + item.demand_count, 0);
  const totalFulfilled = normalized.reduce((sum, item) => sum + item.fulfilled_count, 0);
  const recurringDemand = normalized.reduce(
    (sum, item) => sum + item.recurring_demand_count,
    0,
  );
  const unmetDemand = totalDemand - totalFulfilled;

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    total_demand: totalDemand,
    total_fulfilled: totalFulfilled,
    unmet_demand: unmetDemand,
    fulfillment_rate: totalDemand === 0 ? 1 : totalFulfilled / totalDemand,
    recurring_demand: recurringDemand,
    authority: 'logistics_derived_intelligence',
    persistence: 'none',
    routing: false,
    provider_selection: false,
    assignment: false,
    transaction: false,
  });
}


export function deriveBackhaulOpportunitySignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const totalBackhaul = normalized.reduce(
    (sum, item) => sum + item.backhaul_count,
    0,
  );
  const totalCapacity = normalized.reduce(
    (sum, item) => sum + item.capacity_count,
    0,
  );
  const totalDemand = normalized.reduce(
    (sum, item) => sum + item.demand_count,
    0,
  );
  const totalFulfilled = normalized.reduce(
    (sum, item) => sum + item.fulfilled_count,
    0,
  );

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    backhaul_opportunities: totalBackhaul,
    available_capacity: totalCapacity,
    demand: totalDemand,
    fulfilled_demand: totalFulfilled,
    utilization_gap: Math.max(totalDemand - totalFulfilled, 0),
    backhaul_signal: totalBackhaul > 0 ? 'AVAILABLE' : 'NONE_OBSERVED',
    authority: 'logistics_derived_intelligence',
    persistence: 'none',
    routing: false,
    provider_selection: false,
    assignment: false,
    transaction: false,
  });
}


export function deriveDepotThroughputSignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const throughput = normalized.reduce(
    (sum, item) => sum + item.throughput_count,
    0,
  );
  const demand = normalized.reduce(
    (sum, item) => sum + item.demand_count,
    0,
  );
  const capacity = normalized.reduce(
    (sum, item) => sum + item.capacity_count,
    0,
  );

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    throughput,
    demand,
    available_capacity: capacity,
    throughput_gap: Math.max(demand - throughput, 0),
    throughput_signal: throughput === 0
      ? 'NO_THROUGHPUT_OBSERVED'
      : throughput >= demand && demand > 0
        ? 'THROUGHPUT_COVERS_DEMAND'
        : 'THROUGHPUT_BELOW_DEMAND',
    authority: 'logistics_derived_intelligence',
    warehouse_authority: 'existing_warehouse',
    inventory_authority: 'existing_inventory',
    persistence: 'none',
    stock_mutation: false,
    fulfillment_mutation: false,
    routing: false,
    provider_selection: false,
    assignment: false,
    transaction: false,
  });
}


export function deriveCapacityShortageSignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const demand = normalized.reduce((sum, item) => sum + item.demand_count, 0);
  const fulfilled = normalized.reduce((sum, item) => sum + item.fulfilled_count, 0);
  const observedShortage = normalized.reduce(
    (sum, item) => sum + item.shortage_count,
    0,
  );
  const availableCapacity = normalized.reduce(
    (sum, item) => sum + item.capacity_count,
    0,
  );
  const unmetDemand = demand - fulfilled;

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    demand,
    fulfilled_demand: fulfilled,
    unmet_demand: unmetDemand,
    observed_shortage: observedShortage,
    available_capacity: availableCapacity,
    shortage_signal: observedShortage > 0 || unmetDemand > 0
      ? 'SHORTAGE_OBSERVED'
      : 'NO_SHORTAGE_OBSERVED',
    authority: 'logistics_derived_intelligence',
    capacity_authority: 'existing_capacity_authority',
    reservation_authority: false,
    capacity_ledger: false,
    persistence: 'none',
    routing: false,
    provider_selection: false,
    assignment: false,
    transaction: false,
  });
}






export function networkCorridorIntelligenceClosureGate(snapshot = {}) {
  const requiredAuthority = {
    authority: 'logistics_derived_intelligence',
    source_authority: 'existing_operational_domain_data',
    persistence: 'none',
    transaction: false,
    routing_authority: false,
    provider_selection_authority: false,
    reservation_authority: false,
    assignment_authority: false,
    dispatch_authority: false,
  };

  for (const [key, expected] of Object.entries(requiredAuthority)) {
    if (snapshot[key] !== expected) {
      invalid(`network intelligence closure violation: ${key}`);
    }
  }

  if (snapshot.scheduling_authority !== 'existing_l11_scheduling') {
    invalid('network intelligence closure violation: scheduling_authority');
  }

  const forbiddenAuthorityFields = [
    'provider_registry_authority',
    'capacity_ledger',
    'shipment_authority',
    'fulfillment_authority',
    'payment_authority',
    'inventory_authority',
    'event_store_authority',
    'gps_authority',
  ];

  for (const field of forbiddenAuthorityFields) {
    if (snapshot[field] === true || snapshot[field] === 'logistics') {
      invalid(`network intelligence closure violation: ${field}`);
    }
  }

  return Object.freeze({
    closed: true,
    contract_version: snapshot.contract_version,
    organization_id: snapshot.organization_id,
    corridor_ref: snapshot.corridor_ref,
    service_profile: snapshot.service_profile,
    authority: snapshot.authority,
    persistence: snapshot.persistence,
    transaction: snapshot.transaction,
  });
}

export function composeNetworkIntelligenceSnapshot({
  demandSignal,
  backhaulSignal,
  depotThroughputSignal,
  capacityShortageSignal,
  serviceAreaGapSignal,
  recurringDemandSignal,
  providerCapacityVisibilitySignal,
} = {}) {
  const signals = [
    demandSignal,
    backhaulSignal,
    depotThroughputSignal,
    capacityShortageSignal,
    serviceAreaGapSignal,
    recurringDemandSignal,
    providerCapacityVisibilitySignal,
  ];

  if (signals.some((signal) => !signal || typeof signal !== 'object')) {
    invalid('all L20 intelligence signals are required');
  }

  const first = signals[0];
  for (const signal of signals.slice(1)) {
    if (signal.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (signal.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (signal.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    demand: Object.freeze(demandSignal),
    backhaul: Object.freeze(backhaulSignal),
    depot_throughput: Object.freeze(depotThroughputSignal),
    capacity_shortage: Object.freeze(capacityShortageSignal),
    service_area_gap: Object.freeze(serviceAreaGapSignal),
    recurring_demand: Object.freeze(recurringDemandSignal),
    provider_capacity_visibility: Object.freeze(providerCapacityVisibilitySignal),
    authority: 'logistics_derived_intelligence',
    source_authority: 'existing_operational_domain_data',
    persistence: 'none',
    transaction: false,
    routing_authority: false,
    provider_selection_authority: false,
    scheduling_authority: 'existing_l11_scheduling',
    reservation_authority: false,
    assignment_authority: false,
    dispatch_authority: false,
  });
}

export function deriveProviderCapacityVisibilitySignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const observedCapacity = normalized.reduce(
    (sum, item) => sum + item.capacity_count,
    0,
  );
  const demand = normalized.reduce((sum, item) => sum + item.demand_count, 0);

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    observed_capacity: observedCapacity,
    observed_demand: demand,
    capacity_gap: Math.max(demand - observedCapacity, 0),
    visibility_signal: observedCapacity > 0
      ? 'CAPACITY_VISIBLE'
      : 'NO_CAPACITY_OBSERVED',
    authority: 'logistics_derived_intelligence',
    source_authority: 'existing_operational_domain_data',
    capacity_authority: 'existing_capacity_authority',
    provider_registry_authority: false,
    provider_selection_authority: false,
    reservation_authority: false,
    dispatch_authority: false,
    persistence: 'none',
    transaction: false,
  });
}

export function deriveRecurringDemandSignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const recurring = normalized.reduce(
    (sum, item) => sum + item.recurring_demand_count,
    0,
  );
  const demand = normalized.reduce((sum, item) => sum + item.demand_count, 0);
  const fulfilled = normalized.reduce((sum, item) => sum + item.fulfilled_count, 0);

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    demand,
    fulfilled_demand: fulfilled,
    unmet_demand: demand - fulfilled,
    recurring_demand: recurring,
    recurring_demand_signal: recurring > 0
      ? 'RECURRING_DEMAND_OBSERVED'
      : 'NO_RECURRING_DEMAND_OBSERVED',
    authority: 'logistics_derived_intelligence',
    source_authority: 'existing_operational_domain_data',
    persistence: 'none',
    transaction: false,
    scheduling_authority: 'existing_l11_scheduling',
    reservation_authority: false,
    order_creation_authority: false,
    dispatch_authority: false,
  });
}

export function deriveServiceAreaGapSignal({ observations } = {}) {
  if (!Array.isArray(observations) || observations.length === 0) {
    invalid('observations must be a non-empty array');
  }

  const normalized = observations.map(normalizeNetworkIntelligenceObservation);
  const first = normalized[0];

  for (const item of normalized.slice(1)) {
    if (item.organization_id !== first.organization_id) {
      invalid('organization scope conflict');
    }
    if (item.corridor_ref !== first.corridor_ref) {
      invalid('corridor scope conflict');
    }
    if (item.service_profile !== first.service_profile) {
      invalid('service profile scope conflict');
    }
  }

  const demand = normalized.reduce((sum, item) => sum + item.demand_count, 0);
  const fulfilled = normalized.reduce((sum, item) => sum + item.fulfilled_count, 0);
  const observedGap = normalized.reduce(
    (sum, item) => sum + item.service_area_gap_count,
    0,
  );

  return Object.freeze({
    contract_version: first.contract_version,
    organization_id: first.organization_id,
    corridor_ref: first.corridor_ref,
    service_profile: first.service_profile,
    observation_count: normalized.length,
    demand,
    fulfilled_demand: fulfilled,
    unmet_demand: demand - fulfilled,
    observed_service_area_gap: observedGap,
    coverage_signal: observedGap > 0
      ? 'SERVICE_AREA_GAP_OBSERVED'
      : 'NO_SERVICE_AREA_GAP_OBSERVED',
    authority: 'logistics_derived_intelligence',
    location_authority: 'existing_locations',
    gps_authority: false,
    routing_authority: false,
    provider_selection_authority: false,
    dispatch_authority: false,
    persistence: 'none',
    transaction: false,
  });
}

export function deriveNetworkCorridorIntelligence({ observation } = {}) {
  const normalized = normalizeNetworkIntelligenceObservation(observation);

  const unmetDemand = normalized.demand_count - normalized.fulfilled_count;

  return Object.freeze({
    contract_version: normalized.contract_version,
    organization_id: normalized.organization_id,
    corridor_ref: normalized.corridor_ref,
    service_profile: normalized.service_profile,
    observation_ref: normalized.observation_ref,
    metrics: Object.freeze({
      CORRIDOR_DEMAND: normalized.demand_count,
      BACKHAUL_OPPORTUNITY: normalized.backhaul_count,
      DEPOT_THROUGHPUT: normalized.throughput_count,
      CAPACITY_SHORTAGE: normalized.shortage_count,
      SERVICE_AREA_GAP: normalized.service_area_gap_count,
      RECURRING_DEMAND: normalized.recurring_demand_count,
      PROVIDER_CAPACITY_VISIBILITY: normalized.capacity_count,
    }),
    unmet_demand: unmetDemand,
    fulfillment_rate: normalized.demand_count === 0
      ? 1
      : normalized.fulfilled_count / normalized.demand_count,
    persistence: 'none',
    authority: 'logistics_derived_intelligence',
    routing: false,
    provider_selection: false,
    assignment: false,
    transaction: false,
  });
}

export function assertNetworkCorridorIntelligenceBoundary({
  organizationScoped = true,
  createsTransactionAuthority = false,
  createsRoutingAuthority = false,
  createsProviderSelectionAuthority = false,
  createsProviderRegistry = false,
  createsCapacityAuthority = false,
  createsCapacityLedger = false,
  createsShipmentAuthority = false,
  createsFulfillmentAuthority = false,
  createsEventStore = false,
  persistsIntelligence = false,
  mutatesOperationalState = false,
} = {}) {
  if (!organizationScoped) {
    return Object.freeze({
      valid: false,
      reason: 'NETWORK_INTELLIGENCE_ORGANIZATION_SCOPE_REQUIRED',
    });
  }

  const forbidden = [
    [createsTransactionAuthority, 'TRANSACTION_AUTHORITY_FORBIDDEN'],
    [createsRoutingAuthority, 'ROUTING_AUTHORITY_FORBIDDEN'],
    [createsProviderSelectionAuthority, 'PROVIDER_SELECTION_AUTHORITY_FORBIDDEN'],
    [createsProviderRegistry, 'DUPLICATE_PROVIDER_REGISTRY_FORBIDDEN'],
    [createsCapacityAuthority, 'DUPLICATE_CAPACITY_AUTHORITY_FORBIDDEN'],
    [createsCapacityLedger, 'CAPACITY_LEDGER_FORBIDDEN'],
    [createsShipmentAuthority, 'DUPLICATE_SHIPMENT_AUTHORITY_FORBIDDEN'],
    [createsFulfillmentAuthority, 'DUPLICATE_FULFILLMENT_AUTHORITY_FORBIDDEN'],
    [createsEventStore, 'LOGISTICS_EVENT_STORE_FORBIDDEN'],
    [persistsIntelligence, 'INTELLIGENCE_PERSISTENCE_FORBIDDEN'],
    [mutatesOperationalState, 'OPERATIONAL_STATE_MUTATION_FORBIDDEN'],
  ];

  for (const [blocked, reason] of forbidden) {
    if (blocked) return Object.freeze({ valid: false, reason });
  }

  return Object.freeze({
    valid: true,
    reason: 'NETWORK_CORRIDOR_INTELLIGENCE_BOUNDARY_VALIDATED',
  });
}

export function logisticsNetworkCorridorIntelligenceContract() {
  return Object.freeze({
    version: LOGISTICS_NETWORK_CORRIDOR_INTELLIGENCE_CONTRACT_VERSION,
    metrics: [...NETWORK_INTELLIGENCE_METRICS],
    source_authority: 'existing_operational_domain_data',
    intelligence_authority: 'logistics_derived_intelligence',
    persistence: 'none',
    transaction_authority: false,
    routing_authority: false,
    provider_selection_authority: false,
    provider_registry: false,
    capacity_authority: 'existing_capacity_authority',
    capacity_ledger: false,
    shipment_authority: 'existing_core_order',
    fulfillment_authority: 'existing_core_fulfillment',
    event_store: false,
    principle: 'derive intelligence from real operational data without creating a new transaction authority',
  });
}
