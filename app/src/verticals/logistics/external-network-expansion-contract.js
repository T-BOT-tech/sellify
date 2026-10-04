/**
 * L21 — External Network Expansion
 *
 * Canonical boundary for external logistics networks.
 *
 * This contract deliberately does not implement a provider adapter. The live
 * repository currently has no concrete logistics provider/adapter authority
 * to extend. It defines the stable boundary that a future adapter must obey.
 */

const SERVICE_PROFILES = Object.freeze([
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

const DIRECTIONS = Object.freeze([
  'SELLIFY_TO_EXTERNAL',
  'EXTERNAL_TO_SELLIFY',
  'BIDIRECTIONAL',
  'READ_ONLY',
]);

function invalid(message) {
  throw new Error(message);
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    invalid(`${field} is required`);
  }
  return value.trim();
}

export function normalizeExternalNetworkIntegration(input = {}) {
  const organizationId = requireString(input.organization_id, 'organization_id');
  const integrationRef = requireString(input.integration_ref, 'integration_ref');
  const adapterRef = requireString(input.adapter_ref, 'adapter_ref');
  const externalNetworkRef = requireString(input.external_network_ref, 'external_network_ref');
  const serviceProfile = requireString(input.service_profile, 'service_profile').toUpperCase();
  const direction = requireString(input.direction, 'direction').toUpperCase();

  if (!SERVICE_PROFILES.includes(serviceProfile)) {
    invalid('unsupported service_profile');
  }

  if (!DIRECTIONS.includes(direction)) {
    invalid('unsupported integration direction');
  }

  return Object.freeze({
    contract_version: '1.0',
    organization_id: organizationId,
    integration_ref: integrationRef,
    adapter_ref: adapterRef,
    external_network_ref: externalNetworkRef,
    service_profile: serviceProfile,
    direction,
    canonical_contract: 'logistics_external_network',
  });
}


const ADAPTER_CAPABILITIES = Object.freeze([
  'DELIVERY_REQUEST',
  'DELIVERY_CANCEL',
  'TRACKING_STATUS',
  'DELIVERY_PROOF',
  'CAPACITY_INQUIRY',
  'STATUS_SYNCHRONIZATION',
]);

export function normalizeExternalAdapterCapabilities(input = {}) {
  const integration = normalizeExternalNetworkIntegration(input);

  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    invalid('capabilities must be a non-empty array');
  }

  const capabilities = input.capabilities.map((value) => {
    if (typeof value !== 'string' || value.trim() === '') {
      invalid('capability must be a non-empty string');
    }
    const normalized = value.trim().toUpperCase();
    if (!ADAPTER_CAPABILITIES.includes(normalized)) {
      invalid('unsupported adapter capability');
    }
    return normalized;
  });

  if (new Set(capabilities).size !== capabilities.length) {
    invalid('duplicate adapter capability');
  }

  return Object.freeze({
    ...integration,
    capabilities: Object.freeze(capabilities),
    capability_authority: 'external_adapter_declaration',
    execution_authority: false,
    provider_selection_authority: false,
    routing_authority: false,
    assignment_authority: false,
    persistence: 'existing_integration_or_canonical_domain_state_only',
  });
}


export function buildExternalAdapterRequest({
  integration,
  operation,
  payload,
  idempotency_key,
  correlation_ref,
} = {}) {
  const capabilities = validateExternalAdapterCapabilities(integration);
  requireString(operation, 'operation');
  requireString(idempotency_key, 'idempotency_key');
  const correlationRef = requireString(correlation_ref, 'correlation_ref');

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    invalid('payload must be an object');
  }

  const operationCapability = {
    DELIVERY_REQUEST: 'DELIVERY_REQUEST',
    DELIVERY_CANCEL: 'DELIVERY_CANCEL',
    TRACKING_STATUS: 'TRACKING_STATUS',
    DELIVERY_PROOF: 'DELIVERY_PROOF',
    CAPACITY_INQUIRY: 'CAPACITY_INQUIRY',
    STATUS_SYNCHRONIZATION: 'STATUS_SYNCHRONIZATION',
  }[operation];

  if (!operationCapability) {
    invalid('unsupported adapter operation');
  }

  if (!capabilities.capabilities.includes(operationCapability)) {
    invalid('adapter capability not advertised for operation');
  }

  return Object.freeze({
    contract_version: capabilities.contract_version,
    integration_ref: capabilities.integration_ref,
    adapter_ref: capabilities.adapter_ref,
    external_network_ref: capabilities.external_network_ref,
    service_profile: capabilities.service_profile,
    direction: capabilities.direction,
    operation,
    correlation_ref: correlationRef,
    idempotency_key,
    payload: Object.freeze({ ...payload }),
    authority: 'external_adapter_boundary',
    canonical_mutation_authority: 'existing_canonical_domain_authority',
    direct_domain_mutation: false,
  });
}

export function normalizeExternalAdapterResponse({
  integration,
  operation,
  correlation_ref,
  response,
} = {}) {
  const capabilities = validateExternalAdapterCapabilities(integration);
  requireString(operation, 'operation');
  const correlationRef = requireString(correlation_ref, 'correlation_ref');

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    invalid('response must be an object');
  }

  const status = requireString(response.status, 'response.status').toUpperCase();
  const allowedStatuses = ['ACCEPTED', 'REJECTED', 'PENDING', 'COMPLETED', 'FAILED'];

  if (!allowedStatuses.includes(status)) {
    invalid('unsupported adapter response status');
  }

  const externalRef = response.external_ref == null
    ? null
    : requireString(response.external_ref, 'response.external_ref');

  return Object.freeze({
    contract_version: capabilities.contract_version,
    integration_ref: capabilities.integration_ref,
    adapter_ref: capabilities.adapter_ref,
    external_network_ref: capabilities.external_network_ref,
    service_profile: capabilities.service_profile,
    operation,
    correlation_ref: correlationRef,
    status,
    external_ref: externalRef,
    observed_at: response.observed_at ?? null,
    evidence_ref: response.evidence_ref ?? null,
    authority: 'external_adapter_observation',
    canonical_mutation_authority: 'existing_canonical_domain_authority',
    direct_domain_mutation: false,
    provider_selection_authority: false,
    routing_authority: false,
    assignment_authority: false,
    shipment_authority: false,
    fulfillment_authority: false,
    payment_authority: false,
    inventory_authority: false,
  });
}

export function validateExternalAdapterCapabilities(input = {}) {
  const normalized = normalizeExternalAdapterCapabilities(input);

  if (
    normalized.capabilities.includes('DELIVERY_REQUEST') &&
    normalized.direction === 'READ_ONLY'
  ) {
    invalid('READ_ONLY adapters cannot advertise DELIVERY_REQUEST');
  }

  if (
    normalized.capabilities.includes('DELIVERY_CANCEL') &&
    normalized.direction === 'READ_ONLY'
  ) {
    invalid('READ_ONLY adapters cannot advertise DELIVERY_CANCEL');
  }

  return Object.freeze({
    valid: true,
    ...normalized,
  });
}

export function assertExternalAdapterCapabilityBoundary(capabilities = {}) {
  const forbidden = [
    'provider_registry_authority',
    'provider_selection_authority',
    'routing_authority',
    'assignment_authority',
    'dispatch_authority',
    'shipment_authority',
    'fulfillment_authority',
    'inventory_authority',
    'payment_authority',
    'settlement_authority',
    'identity_authority',
    'event_store_authority',
    'execution_authority',
  ];

  for (const field of forbidden) {
    if (capabilities[field] === true || capabilities[field] === 'external_adapter') {
      invalid(`adapter capability boundary violation: ${field}`);
    }
  }

  if (capabilities.capability_authority !== 'external_adapter_declaration') {
    invalid('adapter capability authority must remain declarative');
  }

  return true;
}

export function validateExternalNetworkIntegration(input = {}) {
  const normalized = normalizeExternalNetworkIntegration(input);

  return Object.freeze({
    valid: true,
    ...normalized,
    boundary: Object.freeze({
      canonical_contract: 'existing_logistics_contract',
      adapter_authority: 'external_adapter',
      provider_business_logic: 'adapter_only',
      logistics_core_provider_neutral: true,
      provider_registry_authority: false,
      selection_authority: false,
      assignment_authority: false,
      routing_authority: false,
      gps_authority: false,
      shipment_authority: false,
      fulfillment_authority: false,
      inventory_authority: false,
      payment_authority: false,
      settlement_authority: false,
      identity_authority: false,
      event_store_authority: false,
      persistence: 'existing_integration_or_canonical_domain_state_only',
    }),
  });
}

export function assertExternalNetworkBoundary(boundary = {}) {
  const forbidden = [
    'provider_registry_authority',
    'selection_authority',
    'assignment_authority',
    'routing_authority',
    'gps_authority',
    'shipment_authority',
    'fulfillment_authority',
    'inventory_authority',
    'payment_authority',
    'settlement_authority',
    'identity_authority',
    'event_store_authority',
  ];

  for (const field of forbidden) {
    if (boundary[field] === true || boundary[field] === 'logistics') {
      invalid(`external network boundary violation: ${field}`);
    }
  }

  if (boundary.logistics_core_provider_neutral !== true) {
    invalid('external network boundary requires provider-neutral Logistics core');
  }

  if (boundary.provider_business_logic !== 'adapter_only') {
    invalid('provider business logic must remain adapter-only');
  }

  if (boundary.adapter_authority !== 'external_adapter') {
    invalid('adapter authority must remain external_adapter');
  }

  return true;
}

export function buildExternalNetworkEnvelope({
  integration,
  operation,
  payload,
  idempotency_key,
} = {}) {
  const validated = validateExternalNetworkIntegration(integration);
  requireString(operation, 'operation');
  requireString(idempotency_key, 'idempotency_key');

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    invalid('payload must be an object');
  }

  assertExternalNetworkBoundary(validated.boundary);

  return Object.freeze({
    contract_version: validated.contract_version,
    integration_ref: validated.integration_ref,
    adapter_ref: validated.adapter_ref,
    external_network_ref: validated.external_network_ref,
    service_profile: validated.service_profile,
    direction: validated.direction,
    operation,
    idempotency_key,
    payload: Object.freeze({ ...payload }),
    canonical_contract: validated.canonical_contract,
    authority: 'external_adapter_boundary',
    persistence: 'existing_integration_or_canonical_domain_state_only',
    transaction_authority: 'existing_canonical_domain_authority',
    provider_selection_authority: false,
    routing_authority: false,
    assignment_authority: false,
  });
}
