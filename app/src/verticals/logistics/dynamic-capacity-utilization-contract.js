// L19.1 — Dynamic Capacity Utilization Contract.
//
// Optional cross-service capacity-utilization policy.
// This is NOT the primary capacity authority.
//
// Base service capability remains independently available (including 24/7).
// L19 only describes optional utilization preferences over an existing
// capacity reference. It creates no capacity ledger, reservation authority,
// courier/provider registry, dispatch authority, routing engine, or scheduler.
//
// L19 → L11:
//   utilization policy → scheduling decision → assignment
//
// A utilization window is advisory by default. It may influence matching or
// scheduling, but it cannot manufacture capacity availability.

export const LOGISTICS_DYNAMIC_CAPACITY_UTILIZATION_CONTRACT_VERSION = '1.0';

export const DYNAMIC_CAPACITY_PROFILES = Object.freeze([
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

export const DYNAMIC_CAPACITY_ALLOCATION_MODES = Object.freeze([
  'PREFERRED',
]);

const PROFILES = new Set(DYNAMIC_CAPACITY_PROFILES);
const MODES = new Set(DYNAMIC_CAPACITY_ALLOCATION_MODES);

function invalid(message, code = 'LOGISTICS_DYNAMIC_CAPACITY_UTILIZATION_INVALID') {
  const error = new TypeError(`Invalid logistics dynamic capacity utilization: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  return text(value, field);
}

function timestamp(value, field) {
  const result = text(value, field);
  const parsed = Date.parse(result);
  if (!Number.isFinite(parsed)) invalid(`${field} must be an ISO-8601 timestamp`);
  return Object.freeze({ value: result, ms: parsed });
}

function normalizeProfile(value, field) {
  const result = text(value, field).toUpperCase();
  if (!PROFILES.has(result)) invalid(`unsupported service profile: ${result}`);
  return result;
}

function normalizeAvailability(value) {
  if (value === undefined || value === null) {
    return Object.freeze({ mode: '24_7' });
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid('base_availability must be an object');
  }

  const mode = text(value.mode ?? '24_7', 'base_availability.mode').toUpperCase();
  if (mode !== '24_7') {
    invalid('base_availability.mode must be 24_7 until an authoritative availability model exists');
  }

  return Object.freeze({ mode: '24_7' });
}

function normalizeEligibleProfiles(value) {
  if (value === undefined || value === null) {
    return Object.freeze([...DYNAMIC_CAPACITY_PROFILES]);
  }
  if (!Array.isArray(value) || value.length === 0) {
    invalid('eligible_service_profiles must be a non-empty array');
  }

  const profiles = value.map((item, index) =>
    normalizeProfile(item, `eligible_service_profiles[${index}]`),
  );

  if (new Set(profiles).size !== profiles.length) {
    invalid('eligible_service_profiles must not contain duplicates');
  }

  return Object.freeze(profiles);
}

function normalizeAllocation(value, index, eligibleProfiles) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`allocations[${index}] must be an object`);
  }

  const profile = normalizeProfile(
    value.service_profile ?? value.serviceProfile,
    `allocations[${index}].service_profile`,
  );

  if (!eligibleProfiles.includes(profile)) {
    invalid(`allocations[${index}] service profile is not eligible for this capacity`);
  }

  const start = timestamp(
    value.start ?? value.requested_start ?? value.requestedStart,
    `allocations[${index}].start`,
  );
  const end = timestamp(
    value.end ?? value.requested_end ?? value.requestedEnd,
    `allocations[${index}].end`,
  );

  if (end.ms <= start.ms) {
    invalid(`allocations[${index}] end must be after start`);
  }

  const mode = text(
    value.mode ?? 'PREFERRED',
    `allocations[${index}].mode`,
  ).toUpperCase();

  if (!MODES.has(mode)) {
    invalid(`allocations[${index}] unsupported allocation mode: ${mode}`);
  }

  return Object.freeze({
    service_profile: profile,
    start: start.value,
    end: end.value,
    mode,
  });
}

function allocationKey(allocation) {
  return [
    allocation.service_profile,
    allocation.start,
    allocation.end,
    allocation.mode,
  ].join('|');
}

export function normalizeDynamicCapacityUtilizationRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('request must be an object');
  }

  const organizationId = text(
    input.organization_id ?? input.organizationId,
    'organization_id',
  );
  const capacityRef = text(
    input.capacity_ref ?? input.capacityRef,
    'capacity_ref',
  );
  const baseAvailability = normalizeAvailability(
    input.base_availability ?? input.baseAvailability,
  );
  const eligibleProfiles = normalizeEligibleProfiles(
    input.eligible_service_profiles ?? input.eligibleServiceProfiles,
  );

  const allocationsInput = input.allocations ?? [];
  if (!Array.isArray(allocationsInput)) {
    invalid('allocations must be an array');
  }

  const allocations = allocationsInput.map((item, index) =>
    normalizeAllocation(item, index, eligibleProfiles),
  );

  const keys = allocations.map(allocationKey);
  if (new Set(keys).size !== keys.length) {
    invalid('duplicate utilization allocation is not allowed');
  }

  return Object.freeze({
    contract_version: LOGISTICS_DYNAMIC_CAPACITY_UTILIZATION_CONTRACT_VERSION,
    organization_id: organizationId,
    capacity_ref: capacityRef,
    base_availability: baseAvailability,
    eligible_service_profiles: eligibleProfiles,
    allocations: Object.freeze(allocations),
    persistence: 'none',
    capacity_authority: 'existing_capacity_authority',
    scheduling_authority: 'existing_l11_scheduling',
    allocation_authority: 'logistics_dynamic_utilization_policy',
    reservation_authority: 'none',
    mutation_authority: 'none',
  });
}

export function evaluateDynamicCapacityUtilization({
  request = {},
  requestedProfile,
  requestedStart,
  requestedEnd,
} = {}) {
  const normalized = normalizeDynamicCapacityUtilizationRequest(request);
  const profile = normalizeProfile(requestedProfile, 'requested_profile');
  const start = timestamp(requestedStart, 'requested_start');
  const end = timestamp(requestedEnd, 'requested_end');

  if (end.ms <= start.ms) {
    invalid('requested_end must be after requested_start');
  }

  if (!normalized.eligible_service_profiles.includes(profile)) {
    return Object.freeze({
      contract_version: normalized.contract_version,
      capacity_ref: normalized.capacity_ref,
      service_profile: profile,
      evaluation: 'INELIGIBLE',
      reason: 'SERVICE_PROFILE_NOT_ELIGIBLE',
      matching_allocation: null,
      base_availability: normalized.base_availability,
      capacity_authority: normalized.capacity_authority,
      scheduling_authority: normalized.scheduling_authority,
      reservation: false,
      persistence: 'none',
    });
  }

  const candidates = normalized.allocations.filter((allocation) => {
    if (allocation.service_profile !== profile) return false;
    return Date.parse(allocation.start) < end.ms &&
      start.ms < Date.parse(allocation.end);
  });

  if (candidates.length === 0) {
    return Object.freeze({
      contract_version: normalized.contract_version,
      capacity_ref: normalized.capacity_ref,
      service_profile: profile,
      evaluation: 'AVAILABLE_BASELINE',
      reason: 'NO_OPTIONAL_UTILIZATION_WINDOW',
      matching_allocation: null,
      base_availability: normalized.base_availability,
      capacity_authority: normalized.capacity_authority,
      scheduling_authority: normalized.scheduling_authority,
      reservation: false,
      persistence: 'none',
    });
  }

  return Object.freeze({
    contract_version: normalized.contract_version,
    capacity_ref: normalized.capacity_ref,
    service_profile: profile,
    evaluation: 'PREFERRED_WINDOW',
    reason: 'OPTIONAL_UTILIZATION_WINDOW_MATCH',
    matching_allocation: candidates[0],
    base_availability: normalized.base_availability,
    capacity_authority: normalized.capacity_authority,
    scheduling_authority: normalized.scheduling_authority,
    reservation: false,
    persistence: 'none',
  });
}


export function composeDynamicCapacityPool({
  requests = [],
  requestedProfile,
  requestedStart,
  requestedEnd,
} = {}) {
  if (!Array.isArray(requests) || requests.length === 0) {
    invalid('requests must be a non-empty array');
  }

  const profile = normalizeProfile(requestedProfile, 'requested_profile');
  const start = timestamp(requestedStart, 'requested_start');
  const end = timestamp(requestedEnd, 'requested_end');

  if (end.ms <= start.ms) {
    invalid('requested_end must be after requested_start');
  }

  const normalized = requests.map((request, index) => {
    try {
      return normalizeDynamicCapacityUtilizationRequest(request);
    } catch (error) {
      error.message = `requests[${index}]: ${error.message}`;
      throw error;
    }
  });

  const organizationIds = new Set(normalized.map(item => item.organization_id));
  if (organizationIds.size !== 1) {
    return Object.freeze({
      evaluation: 'INELIGIBLE',
      reason: 'POOL_ORGANIZATION_SCOPE_CONFLICT',
      service_profile: profile,
      candidates: Object.freeze([]),
      reservation: false,
      persistence: 'none',
    });
  }

  const candidates = [];
  for (const capacity of normalized) {
    if (!capacity.eligible_service_profiles.includes(profile)) continue;

    const matchingAllocations = capacity.allocations.filter((allocation) => {
      if (allocation.service_profile !== profile) return false;
      return Date.parse(allocation.start) < end.ms &&
        start.ms < Date.parse(allocation.end);
    });

    candidates.push(Object.freeze({
      organization_id: capacity.organization_id,
      capacity_ref: capacity.capacity_ref,
      service_profile: profile,
      evaluation: matchingAllocations.length
        ? 'PREFERRED_WINDOW'
        : 'AVAILABLE_BASELINE',
      preference: matchingAllocations.length ? 'PREFERRED' : 'BASELINE',
      matching_allocations: Object.freeze(matchingAllocations),
      capacity_authority: capacity.capacity_authority,
      scheduling_authority: capacity.scheduling_authority,
      reservation: false,
      persistence: 'none',
    }));
  }

  candidates.sort((left, right) => {
    if (left.preference !== right.preference) {
      return left.preference === 'PREFERRED' ? -1 : 1;
    }
    return left.capacity_ref.localeCompare(right.capacity_ref);
  });

  return Object.freeze({
    evaluation: candidates.length ? 'POOL_ELIGIBLE' : 'INELIGIBLE',
    reason: candidates.length
      ? 'OPTIONAL_UTILIZATION_POOL_COMPOSED'
      : 'NO_ELIGIBLE_CAPACITY_PROFILE',
    service_profile: profile,
    candidates: Object.freeze(candidates),
    reservation: false,
    persistence: 'none',
    selection_authority: 'existing_capacity_matching_or_scheduling_authority',
  });
}


export function buildDynamicCapacitySchedulingInput({
  pool,
  capacityRef,
  requestedProfile,
  requestedStart,
  requestedEnd,
  schedulingContext = {},
} = {}) {
  if (!pool || typeof pool !== 'object' || Array.isArray(pool)) {
    invalid('pool must be an object');
  }

  const normalizedCapacityRef = text(capacityRef, 'capacity_ref');
  const profile = normalizeProfile(requestedProfile, 'requested_profile');
  const start = timestamp(requestedStart, 'requested_start');
  const end = timestamp(requestedEnd, 'requested_end');

  if (end.ms <= start.ms) {
    invalid('requested_end must be after requested_start');
  }

  const candidate = (pool.candidates ?? []).find(
    item => item.capacity_ref === normalizedCapacityRef &&
      item.service_profile === profile,
  );

  if (!candidate) {
    invalid('capacity_ref is not an eligible member of the L19 pool');
  }

  return Object.freeze({
    capacity_ref: normalizedCapacityRef,
    service_profile: profile,
    requested_start: start.value,
    requested_end: end.value,
    utilization_preference: candidate.preference,
    utilization_evaluation: candidate.evaluation,
    scheduling_context: Object.freeze({ ...schedulingContext }),
    decision_authority: 'existing_l11_scheduling',
    execution_authority: 'existing_logistics_assignment',
    reservation: false,
    authorization: false,
    assignment: false,
    persistence: 'none',
  });
}

export function applyDynamicCapacitySchedulingDecision({
  schedulingInput,
  evaluation,
} = {}) {
  if (!schedulingInput || typeof schedulingInput !== 'object' || Array.isArray(schedulingInput)) {
    invalid('schedulingInput must be an object');
  }

  if (schedulingInput.decision_authority !== 'existing_l11_scheduling') {
    invalid('L19 scheduling input must target existing L11 scheduling');
  }

  if (!evaluation || typeof evaluation !== 'object' || Array.isArray(evaluation)) {
    invalid('evaluation must be an object');
  }

  const outcome = String(
    evaluation.evaluation ?? evaluation.outcome ?? '',
  ).trim().toUpperCase();

  if (!['FEASIBLE', 'CONFLICT', 'UNKNOWN'].includes(outcome)) {
    invalid('L11 evaluation must be FEASIBLE, CONFLICT, or UNKNOWN');
  }

  return Object.freeze({
    capacity_ref: schedulingInput.capacity_ref,
    service_profile: schedulingInput.service_profile,
    utilization_preference: schedulingInput.utilization_preference,
    utilization_evaluation: schedulingInput.utilization_evaluation,
    scheduling_evaluation: outcome,
    scheduling_decision: outcome === 'FEASIBLE' ? 'SCHEDULE' : 'BLOCK',
    decision_authority: 'existing_l11_scheduling',
    authorized: false,
    execution: false,
    reservation: false,
    assignment: false,
    persistence: 'none',
  });
}

export function assertDynamicCapacityUtilizationBoundary({
  organizationScoped = true,
  createsCapacityAuthority = false,
  createsCapacityLedger = false,
  createsReservationAuthority = false,
  createsCourierRegistry = false,
  createsProviderRegistry = false,
  createsDispatchAuthority = false,
  createsRoutingAuthority = false,
  createsGpsAuthority = false,
  createsSchedulingAuthority = false,
  mutatesAssignment = false,
} = {}) {
  if (!organizationScoped) {
    return Object.freeze({
      valid: false,
      reason: 'DYNAMIC_CAPACITY_ORGANIZATION_SCOPE_REQUIRED',
    });
  }

  const forbidden = [
    [createsCapacityAuthority, 'DUPLICATE_CAPACITY_AUTHORITY_FORBIDDEN'],
    [createsCapacityLedger, 'CAPACITY_LEDGER_FORBIDDEN'],
    [createsReservationAuthority, 'CAPACITY_RESERVATION_AUTHORITY_FORBIDDEN'],
    [createsCourierRegistry, 'DUPLICATE_COURIER_REGISTRY_FORBIDDEN'],
    [createsProviderRegistry, 'DUPLICATE_PROVIDER_REGISTRY_FORBIDDEN'],
    [createsDispatchAuthority, 'DISPATCH_AUTHORITY_FORBIDDEN'],
    [createsRoutingAuthority, 'ROUTING_AUTHORITY_FORBIDDEN'],
    [createsGpsAuthority, 'GPS_AUTHORITY_FORBIDDEN'],
    [createsSchedulingAuthority, 'DUPLICATE_SCHEDULING_AUTHORITY_FORBIDDEN'],
    [mutatesAssignment, 'ASSIGNMENT_MUTATION_FORBIDDEN'],
  ];

  for (const [blocked, reason] of forbidden) {
    if (blocked) return Object.freeze({ valid: false, reason });
  }

  return Object.freeze({
    valid: true,
    reason: 'DYNAMIC_CAPACITY_UTILIZATION_BOUNDARY_VALIDATED',
  });
}

export function dynamicCapacityUtilizationContract() {
  return Object.freeze({
    version: LOGISTICS_DYNAMIC_CAPACITY_UTILIZATION_CONTRACT_VERSION,
    purpose: 'optional cross-service capacity utilization policy',
    base_availability: '24/7 capable when supported by existing capacity authority',
    profiles: DYNAMIC_CAPACITY_PROFILES,
    allocation_modes: DYNAMIC_CAPACITY_ALLOCATION_MODES,
    default_allocation_mode: 'PREFERRED',
    capacity_authority: 'existing_capacity_authority',
    matching_authority: 'existing_or_future_capacity_matching_authority',
    scheduling_authority: 'existing_l11_scheduling',
    assignment_authority: 'existing_logistics_assignment',
    persistence: 'none',
    reservation_authority: 'none',
    capacity_ledger: false,
    courier_registry: false,
    provider_registry: false,
    dispatch_authority: false,
    routing_authority: false,
    gps_authority: false,
    duplicate_scheduler: false,
    principle: 'optional utilization must not reduce the independent service availability of B2B, B2C, or P2P',
  });
}
