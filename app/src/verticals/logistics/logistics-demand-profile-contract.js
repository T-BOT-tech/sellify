// L8 — Logistics Demand / Service Profile.
// Normalizes the four Logistics service surfaces into one provider-neutral
// demand/request contract. This module describes requirements only; it does
// not create orders, shipments, inventory, payments, identities, matches,
// provider selections, assignments, or execution.
//
// Master model:
// Demand -> Capacity Requirement -> Existing Discovery Matching.

export const LOGISTICS_DEMAND_PROFILE_CONTRACT_VERSION = '1.0';

const SERVICE_PROFILES = Object.freeze([
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

const PROFILE_DEFINITIONS = Object.freeze({
  REGIONAL_FREIGHT: Object.freeze({
    service_profile: 'REGIONAL_FREIGHT',
    relationship_profile: 'b2b',
    physical_scale: 'regional',
    required_fields: Object.freeze([
      'origin', 'destination', 'timing', 'payload',
      'capacity_requirements', 'handling_requirements',
    ]),
    optional_fields: Object.freeze(['evidence_requirements', 'actor_context', 'source_context']),
  }),
  B2B_DISTRIBUTION: Object.freeze({
    service_profile: 'B2B_DISTRIBUTION',
    relationship_profile: 'b2b',
    physical_scale: 'local_distribution',
    required_fields: Object.freeze([
      'origin', 'destination', 'timing', 'payload',
      'capacity_requirements',
    ]),
    optional_fields: Object.freeze(['handling_requirements', 'evidence_requirements', 'actor_context', 'source_context']),
  }),
  B2C_DELIVERY: Object.freeze({
    service_profile: 'B2C_DELIVERY',
    relationship_profile: 'b2c',
    physical_scale: 'doorstep',
    required_fields: Object.freeze([
      'origin', 'destination', 'timing', 'payload',
      'capacity_requirements',
    ]),
    optional_fields: Object.freeze(['handling_requirements', 'evidence_requirements', 'actor_context', 'source_context']),
  }),
  P2P_DELIVERY: Object.freeze({
    service_profile: 'P2P_DELIVERY',
    relationship_profile: 'p2p',
    physical_scale: 'doorstep',
    required_fields: Object.freeze([
      'origin', 'destination', 'timing', 'payload',
      'capacity_requirements',
    ]),
    optional_fields: Object.freeze(['handling_requirements', 'evidence_requirements', 'actor_context', 'source_context']),
  }),
});

const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'order_id',
  'shipment_id',
  'payment_id',
  'inventory_id',
  'provider_id',
  'provider_selection',
  'assignment_id',
  'execution_id',
  'match_id',
]);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function normalizeProfile(value) {
  return requiredText(value, 'service_profile').toUpperCase();
}

function normalizeObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return Object.freeze({ ...value });
}

function assertNoForbiddenAuthorityFields(input) {
  for (const field of Object.keys(input || {})) {
    if (FORBIDDEN_AUTHORITY_FIELDS.has(field)) {
      throw new TypeError(`Logistics demand must not accept authority field: ${field}`);
    }
  }
}

export function getLogisticsDemandProfile(serviceProfile) {
  const profile = PROFILE_DEFINITIONS[normalizeProfile(serviceProfile)];
  if (!profile) throw new TypeError(`Unsupported logistics service profile: ${serviceProfile}`);
  return profile;
}

export function normalizeLogisticsDemand(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Logistics demand is required');
  }
  assertNoForbiddenAuthorityFields(input);

  const profile = getLogisticsDemandProfile(input.serviceProfile ?? input.service_profile);

  const origin = normalizeObject(input.origin, 'origin');
  const destination = normalizeObject(input.destination, 'destination');
  const timing = normalizeObject(input.timing, 'timing');
  const payload = normalizeObject(input.payload, 'payload');
  const capacityRequirements = normalizeObject(
    input.capacityRequirements ?? input.capacity_requirements,
    'capacity_requirements',
  );

  const demand = {
    service_profile: profile.service_profile,
    relationship_profile: profile.relationship_profile,
    physical_scale: profile.physical_scale,
    origin,
    destination,
    timing,
    payload,
    capacity_requirements: capacityRequirements,
    handling_requirements: input.handlingRequirements ?? input.handling_requirements ?? null,
    evidence_requirements: input.evidenceRequirements ?? input.evidence_requirements ?? null,
    actor_context: input.actorContext ?? input.actor_context ?? null,
    source_context: input.sourceContext ?? input.source_context ?? null,
  };

  if (demand.handling_requirements !== null) {
    demand.handling_requirements = normalizeObject(demand.handling_requirements, 'handling_requirements');
  }
  if (demand.evidence_requirements !== null) {
    demand.evidence_requirements = normalizeObject(demand.evidence_requirements, 'evidence_requirements');
  }
  if (demand.actor_context !== null) {
    demand.actor_context = normalizeObject(demand.actor_context, 'actor_context');
  }
  if (demand.source_context !== null) {
    demand.source_context = normalizeObject(demand.source_context, 'source_context');
  }

  return Object.freeze(demand);
}

export function validateLogisticsDemandProfile(input = {}) {
  try {
    const demand = normalizeLogisticsDemand(input);
    const profile = getLogisticsDemandProfile(demand.service_profile);
    const missing = profile.required_fields.filter(field => demand[field] == null);

    if (missing.length) {
      return Object.freeze({
        valid: false,
        reason: 'MANDATORY_DEMAND_FIELD_MISSING',
        service_profile: profile.service_profile,
        missing_fields: Object.freeze(missing),
      });
    }

    return Object.freeze({
      valid: true,
      reason: 'DEMAND_PROFILE_VALID',
      demand,
    });
  } catch (error) {
    return Object.freeze({
      valid: false,
      reason: 'INVALID_DEMAND_PROFILE',
      error: error.message,
    });
  }
}

export function assertLogisticsDemandBoundary({
  organizationScoped = true,
  authorized = true,
  discoveryAuthority = true,
  downstreamMutation = false,
  providerSelection = false,
  execution = false,
} = {}) {
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'DEMAND_ORGANIZATION_SCOPE_REQUIRED' });
  if (!authorized) return Object.freeze({ valid: false, reason: 'DEMAND_AUTHORIZATION_REQUIRED' });
  if (!discoveryAuthority) return Object.freeze({ valid: false, reason: 'EXISTING_DISCOVERY_MATCHING_REQUIRED' });
  if (downstreamMutation) return Object.freeze({ valid: false, reason: 'DEMAND_MUST_NOT_MUTATE_DOWNSTREAM_AUTHORITY' });
  if (providerSelection) return Object.freeze({ valid: false, reason: 'DEMAND_MUST_NOT_SELECT_PROVIDER' });
  if (execution) return Object.freeze({ valid: false, reason: 'DEMAND_MUST_NOT_EXECUTE' });
  return Object.freeze({ valid: true, reason: 'DEMAND_BOUNDARY_VALID' });
}

export function logisticsDemandProfileContract() {
  return Object.freeze({
    version: LOGISTICS_DEMAND_PROFILE_CONTRACT_VERSION,
    service_profiles: SERVICE_PROFILES,
    profiles: PROFILE_DEFINITIONS,
    normalized_shape: Object.freeze([
      'service_profile',
      'relationship_profile',
      'physical_scale',
      'origin',
      'destination',
      'timing',
      'payload',
      'capacity_requirements',
      'handling_requirements',
      'evidence_requirements',
      'actor_context',
      'source_context',
    ]),
    authority: 'logistics_demand_only',
    matching_authority: 'existing_discovery_matching',
    selection: false,
    assignment: false,
    execution: false,
    persistence: 'existing_domain_authorities_only',
    order_authority: false,
    shipment_authority: false,
    inventory_mutation: false,
    payment_mutation: false,
    identity_authority: 'existing_identity_compliance',
    duplicate_matching_authority: false,
  });
}
