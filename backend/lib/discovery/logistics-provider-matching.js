// Logistics provider suitability projection.
// Phase L6: reuse Discovery matching as the single matching/ranking authority.
// This module owns no provider state, credentials, authorization, or execution.

import { matchDiscoveryCandidates } from './matching-contract.js';

const CAPABILITY_ALIASES = Object.freeze({
  pickup: 'pickup',
  delivery: 'delivery',
  tracking: 'tracking',
  proof_of_delivery: 'proof_of_delivery',
  returns: 'returns',
  route_planning: 'route_planning',
  dispatch: 'dispatch',
  cross_border: 'cross_border',
});

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw Object.assign(new Error(`Logistics provider matching: ${field} must be a non-empty string`), {
      code: 'LOGISTICS_PROVIDER_MATCHING_INVALID',
    });
  }
  return value.trim();
}

function list(value, field) {
  if (!Array.isArray(value)) throw Object.assign(new Error(`Logistics provider matching: ${field} must be an array`), {
    code: 'LOGISTICS_PROVIDER_MATCHING_INVALID',
  });
  return [...new Set(value.map((item) => text(item, `${field} item`).toLowerCase()))];
}

function normalizeServiceAreas(value) {
  if (!Array.isArray(value)) return [];
  return value.map((area) => {
    if (!area || typeof area !== 'object') throw Object.assign(new Error('serviceAreas entries must be objects'), {
      code: 'LOGISTICS_PROVIDER_MATCHING_INVALID',
    });
    return {
      countryCode: area.countryCode ?? area.country_code,
      geoCode: area.geoCode ?? area.geo_code,
    };
  });
}

function normalizeCapacitySignals(value) {
  if (!Array.isArray(value)) return [];
  return value.map((signal) => ({
    subjectId: signal.subjectId ?? signal.subject_id,
    quantity: signal.quantity,
    unit: signal.unit,
  }));
}

/**
 * Convert Logistics provider evidence into the existing Discovery candidate
 * vocabulary. No provider record is created or persisted.
 */
export function projectLogisticsProviderForDiscovery(provider = {}) {
  const providerId = text(provider.provider_id ?? provider.providerId, 'provider_id');
  const capabilities = list(provider.capabilities ?? [], 'capabilities')
    .filter((capability) => CAPABILITY_ALIASES[capability]);
  const serviceAreas = normalizeServiceAreas(provider.serviceAreas ?? provider.service_areas);

  return Object.freeze({
    providerId,
    title: text(provider.name ?? provider.provider_name ?? providerId, 'provider name'),
    capabilities: Object.freeze(capabilities.map((code) => ({ code }))),
    serviceAreas: Object.freeze(serviceAreas.map(Object.freeze)),
    capacitySignals: Object.freeze(normalizeCapacitySignals(provider.capacitySignals ?? provider.capacity_signals).map(Object.freeze)),
    geography: provider.geography ? Object.freeze({
      countryCode: provider.geography.countryCode ?? provider.geography.country_code,
      geoCode: provider.geography.geoCode ?? provider.geography.geo_code,
    }) : undefined,
    organizationId: provider.organization_id ?? provider.organizationId,
    relationshipActive: provider.relationshipActive === true,
    sourceEntityId: providerId,
  });
}

/**
 * Evaluate logistics provider suitability through Discovery's canonical
 * eligibility/matching authority. Matching does not authorize or select.
 */
export function matchLogisticsProviders(providers = [], requirements = {}) {
  if (!Array.isArray(providers)) throw Object.assign(new Error('providers must be an array'), {
    code: 'LOGISTICS_PROVIDER_MATCHING_INVALID',
  });
  const candidates = providers.map(projectLogisticsProviderForDiscovery);
  const context = {
    capabilityCode: requirements.capability ?? requirements.capabilityCode,
    countryCode: requirements.countryCode,
    geoCode: requirements.geoCode,
    minimumQuantity: requirements.minimumQuantity,
    productId: requirements.productId,
    unit: requirements.unit,
  };

  return Object.freeze({
    authority: 'discovery_matching',
    candidates: Object.freeze(matchDiscoveryCandidates(candidates, context)),
    selection: 'not_performed',
    authorization: 'not_performed',
    execution: false,
    persistence: 'none',
    provider_state: 'not_owned',
    credentials: 'not_owned',
  });
}

export function logisticsProviderMatchingContract() {
  return Object.freeze({
    version: '1.0',
    authority: 'discovery_matching',
    source_authority: 'logistics provider capability/evidence',
    dimensions: Object.freeze(['capability', 'service_area', 'capacity']),
    eligibility_before_matching: true,
    selection: 'existing_logistics_provider_selection_contract',
    authorization: 'backend/lib/authorization.js',
    execution: 'existing_logistics_adapter_boundary',
    persistence: 'none',
    provider_registry: 'not_created',
    credential_storage: false,
    duplicate_matching_authority: false,
  });
}
