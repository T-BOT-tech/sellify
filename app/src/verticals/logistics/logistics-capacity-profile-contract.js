// L9 — Reusable Logistics Capacity Profile.
// Describes physical/service capacity that can be consumed by the existing
// Discovery matching authority. It is declarative: no provider selection,
// reservation, assignment, dispatch, routing, scheduling, or execution.

export const LOGISTICS_CAPACITY_PROFILE_CONTRACT_VERSION = '1.0';

export const LOGISTICS_CAPACITY_SERVICE_PROFILES = Object.freeze([
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

const PROFILES = new Set(LOGISTICS_CAPACITY_SERVICE_PROFILES);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim() || null;
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return Object.freeze({ ...value });
}

function positiveNumber(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) {
    throw new TypeError(`${field} must be a positive number`);
  }
  return result;
}

function normalizeProfiles(value) {
  const values = Array.isArray(value) && value.length ? value : LOGISTICS_CAPACITY_SERVICE_PROFILES;
  const profiles = values.map((item, index) => {
    const profile = text(item, `service_profiles[${index}]`).toUpperCase();
    if (!PROFILES.has(profile)) throw new TypeError(`Unsupported logistics service profile: ${profile}`);
    return profile;
  });
  if (new Set(profiles).size !== profiles.length) {
    throw new TypeError('service_profiles must not contain duplicates');
  }
  return Object.freeze(profiles);
}

export function normalizeLogisticsCapacityProfile(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Logistics capacity profile is required');
  }

  const payloadCapacity = positiveNumber(
    input.payloadCapacityKg ?? input.payload_capacity_kg,
    'payload_capacity_kg',
  );

  const profile = {
    contract_version: LOGISTICS_CAPACITY_PROFILE_CONTRACT_VERSION,
    capacity_ref: text(input.capacityRef ?? input.capacity_ref, 'capacity_ref'),
    organization_id: text(input.organizationId ?? input.organization_id, 'organization_id'),
    vehicle_type: text(input.vehicleType ?? input.vehicle_type, 'vehicle_type'),
    payload_capacity_kg: payloadCapacity,
    volume_capacity_m3: input.volumeCapacityM3 ?? input.volume_capacity_m3 ?? null,
    dimensions: input.dimensions ? object(input.dimensions, 'dimensions') : null,
    operating_area: input.operatingArea
      ? object(input.operatingArea, 'operating_area')
      : (input.operating_area ? object(input.operating_area, 'operating_area') : null),
    service_profiles: normalizeProfiles(input.serviceProfiles ?? input.service_profiles),
    availability: input.availability ? object(input.availability, 'availability') : null,
    schedule: input.schedule ? object(input.schedule, 'schedule') : null,
    owner_ref: optionalText(input.ownerRef ?? input.owner_ref),
    provider_ref: optionalText(input.providerRef ?? input.provider_ref),
    eligibility: input.eligibility ? object(input.eligibility, 'eligibility') : null,
  };

  if (profile.volume_capacity_m3 !== null) {
    profile.volume_capacity_m3 = positiveNumber(profile.volume_capacity_m3, 'volume_capacity_m3');
  }

  return Object.freeze(profile);
}

export function capacityProfileSupportsService(capacity, serviceProfile) {
  const normalized = normalizeLogisticsCapacityProfile(capacity);
  const profile = text(serviceProfile, 'service_profile').toUpperCase();
  if (!PROFILES.has(profile)) {
    throw new TypeError(`Unsupported logistics service profile: ${profile}`);
  }
  return normalized.service_profiles.includes(profile);
}

export function capacityProfileCanSatisfyPayload(capacity, payload = {}) {
  const normalized = normalizeLogisticsCapacityProfile(capacity);
  const weight = Number(payload.weightKg ?? payload.weight_kg ?? 0);
  if (!Number.isFinite(weight) || weight < 0) {
    throw new TypeError('payload.weight_kg must be a non-negative number');
  }
  if (weight > normalized.payload_capacity_kg) return false;

  const volume = payload.volumeM3 ?? payload.volume_m3;
  if (volume !== undefined && volume !== null) {
    const requestedVolume = Number(volume);
    if (!Number.isFinite(requestedVolume) || requestedVolume < 0) {
      throw new TypeError('payload.volume_m3 must be a non-negative number');
    }
    if (normalized.volume_capacity_m3 !== null && requestedVolume > normalized.volume_capacity_m3) {
      return false;
    }
  }
  return true;
}

export function assertLogisticsCapacityBoundary({
  organizationScoped = true,
  matchingAuthority = true,
  createsCapacityLedger = false,
  createsReservationAuthority = false,
  selectsProvider = false,
  assignsProvider = false,
  dispatches = false,
  routes = false,
  schedules = false,
  executes = false,
  mutatesCanonicalDomain = false,
} = {}) {
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'CAPACITY_ORGANIZATION_SCOPE_REQUIRED' });
  if (!matchingAuthority) return Object.freeze({ valid: false, reason: 'EXISTING_DISCOVERY_MATCHING_REQUIRED' });

  const forbidden = [
    [createsCapacityLedger, 'CAPACITY_LEDGER_FORBIDDEN'],
    [createsReservationAuthority, 'CAPACITY_RESERVATION_AUTHORITY_FORBIDDEN'],
    [selectsProvider, 'PROVIDER_SELECTION_FORBIDDEN'],
    [assignsProvider, 'PROVIDER_ASSIGNMENT_FORBIDDEN'],
    [dispatches, 'DISPATCH_EXECUTION_FORBIDDEN'],
    [routes, 'ROUTING_AUTHORITY_FORBIDDEN'],
    [schedules, 'SCHEDULING_AUTHORITY_FORBIDDEN'],
    [executes, 'EXTERNAL_EXECUTION_FORBIDDEN'],
    [mutatesCanonicalDomain, 'CANONICAL_DOMAIN_MUTATION_FORBIDDEN'],
  ];
  for (const [blocked, reason] of forbidden) {
    if (blocked) return Object.freeze({ valid: false, reason });
  }

  return Object.freeze({ valid: true, reason: 'CAPACITY_BOUNDARY_VALID' });
}

export function logisticsCapacityProfileContract() {
  return Object.freeze({
    version: LOGISTICS_CAPACITY_PROFILE_CONTRACT_VERSION,
    normalized_shape: Object.freeze([
      'capacity_ref', 'organization_id', 'vehicle_type',
      'payload_capacity_kg', 'volume_capacity_m3', 'dimensions',
      'operating_area', 'service_profiles', 'availability',
      'schedule', 'owner_ref', 'provider_ref', 'eligibility',
    ]),
    service_profiles: LOGISTICS_CAPACITY_SERVICE_PROFILES,
    authority: 'logistics_capacity_profile_only',
    matching_authority: 'existing_discovery_matching',
    provider_selection: false,
    assignment: false,
    reservation: false,
    dispatch_execution: false,
    routing: false,
    scheduling: false,
    persistence: 'existing_capacity_authority_only',
    duplicate_capacity_ledger: false,
    duplicate_matching_authority: false,
  });
}
