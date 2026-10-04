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


export function validateExternalAdapterTrust({
  integration,
  organization_id,
  integration_ref,
  adapter_ref,
  correlation_ref,
  capabilities,
} = {}) {
  const normalized = validateExternalNetworkIntegration(integration);
  const organizationId = requireString(organization_id, 'organization_id');
  const integrationRef = requireString(integration_ref, 'integration_ref');
  const adapterRef = requireString(adapter_ref, 'adapter_ref');
  const correlationRef = requireString(correlation_ref, 'correlation_ref');

  if (normalized.organization_id !== organizationId) {
    invalid('adapter trust organization scope mismatch');
  }
  if (normalized.integration_ref !== integrationRef) {
    invalid('adapter trust integration scope mismatch');
  }
  if (normalized.adapter_ref !== adapterRef) {
    invalid('adapter trust adapter identity mismatch');
  }

  const declaredCapabilities = validateExternalAdapterCapabilities({
    ...normalized,
    capabilities: capabilities ?? ['STATUS_SYNCHRONIZATION'],
  });

  return Object.freeze({
    trusted: true,
    organization_id: organizationId,
    integration_ref: integrationRef,
    adapter_ref: adapterRef,
    correlation_ref: correlationRef,
    capability_authority: 'existing_integration_or_adapter_declaration',
    authorization_authority: 'existing_server_side_auth_scope',
    provider_identity_authority: 'existing_integration_state',
    provider_business_logic: 'adapter_only',
    logistics_core_provider_neutral: true,
    capabilities: declaredCapabilities.capabilities,
    direct_domain_mutation: false,
    persistence: 'existing_integration_or_canonical_domain_state_only',
  });
}

export function assertExternalAdapterTrustBoundary(value = {}) {
  if (value.trusted !== true) {
    invalid('external adapter trust must be established before crossing the boundary');
  }
  if (value.authorization_authority !== 'existing_server_side_auth_scope') {
    invalid('adapter authorization must remain under existing server-side auth scope');
  }
  if (value.provider_identity_authority !== 'existing_integration_state') {
    invalid('adapter identity must remain bound to existing integration state');
  }
  if (value.provider_business_logic !== 'adapter_only') {
    invalid('provider business logic must remain adapter-only');
  }
  if (value.logistics_core_provider_neutral !== true) {
    invalid('Logistics core must remain provider-neutral');
  }
  if (value.direct_domain_mutation === true) {
    invalid('trusted adapter must not directly mutate canonical domain state');
  }
  if (value.persistence !== 'existing_integration_or_canonical_domain_state_only') {
    invalid('adapter trust must not introduce a separate persistence authority');
  }
  for (const field of ['organization_id', 'integration_ref', 'adapter_ref', 'correlation_ref']) {
    requireString(value[field], field);
  }
  return true;
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



const EXTERNAL_OUTCOME_CLASSES = Object.freeze([
  'SUCCESS',
  'REJECTED',
  'PENDING',
  'FAILED_RETRYABLE',
  'FAILED_FINAL',
  'AMBIGUOUS',
]);

export function classifyExternalAdapterOutcome({ status, transport_error = false, timeout = false, response_received = true } = {}) {
  const normalizedStatus = requireString(status, 'status').toUpperCase();

  if (timeout || transport_error || !response_received) {
    return Object.freeze({
      outcome_class: 'AMBIGUOUS',
      retryable: true,
      canonical_state_mutation: false,
      resolution_required: true,
    });
  }

  if (normalizedStatus === 'ACCEPTED' || normalizedStatus === 'COMPLETED') {
    return Object.freeze({
      outcome_class: 'SUCCESS',
      retryable: false,
      canonical_state_mutation: false,
      resolution_required: false,
    });
  }

  if (normalizedStatus === 'REJECTED') {
    return Object.freeze({
      outcome_class: 'REJECTED',
      retryable: false,
      canonical_state_mutation: false,
      resolution_required: false,
    });
  }

  if (normalizedStatus === 'PENDING') {
    return Object.freeze({
      outcome_class: 'PENDING',
      retryable: true,
      canonical_state_mutation: false,
      resolution_required: true,
    });
  }

  return Object.freeze({
    outcome_class: 'FAILED_RETRYABLE',
    retryable: true,
    canonical_state_mutation: false,
    resolution_required: true,
  });
}

export function buildExternalRetryDecision({
  idempotency_key,
  attempt = 1,
  outcome,
  max_attempts = 3,
} = {}) {
  requireString(idempotency_key, 'idempotency_key');
  if (!Number.isInteger(attempt) || attempt < 1) invalid('attempt must be a positive integer');
  if (!Number.isInteger(max_attempts) || max_attempts < 1) invalid('max_attempts must be a positive integer');
  if (!outcome || typeof outcome !== 'object') invalid('outcome is required');
  if (!EXTERNAL_OUTCOME_CLASSES.includes(outcome.outcome_class)) invalid('unsupported external outcome class');

  const retryable = outcome.retryable === true;
  const retry = retryable && attempt < max_attempts;

  return Object.freeze({
    idempotency_key,
    attempt,
    max_attempts,
    outcome_class: outcome.outcome_class,
    retry,
    terminal: !retry,
    resolution_required: outcome.resolution_required === true,
    canonical_state_mutation: false,
    persistence: 'existing_integration_or_canonical_domain_state_only',
    event_store_authority: false,
  });
}

export function assertExternalRetryBoundary(value = {}) {
  if (value.canonical_state_mutation === true) {
    invalid('adapter retry handling must not mutate canonical state');
  }
  if (value.event_store_authority === true || value.event_store_authority === 'external_adapter') {
    invalid('adapter retry handling must not create an event-store authority');
  }
  if (value.persistence !== 'existing_integration_or_canonical_domain_state_only') {
    invalid('adapter retry persistence must remain within existing integration/core state');
  }
  if (typeof value.idempotency_key !== 'string' || !value.idempotency_key.trim()) {
    invalid('retry decision requires idempotency_key');
  }
  return true;
}

export function normalizeExternalStatusEvidence({
  integration,
  operation,
  correlation_ref,
  service_profile,
  response,
} = {}) {
  const capabilities = validateExternalAdapterCapabilities(integration);
  const profile = requireString(service_profile ?? capabilities.service_profile, 'service_profile').toUpperCase();
  if (profile !== capabilities.service_profile) invalid('service_profile does not match integration');

  const normalizedResponse = normalizeExternalAdapterResponse({
    integration: capabilities,
    operation,
    correlation_ref,
    response,
  });

  const evidence = Array.isArray(response?.evidence)
    ? response.evidence.map((item) => Object.freeze({
        kind: requireString(item.kind, 'evidence.kind').toLowerCase(),
        ref: requireString(item.ref, 'evidence.ref'),
        captured_at: item.captured_at ?? normalizedResponse.observed_at,
        actor_ref: item.actor_ref ? String(item.actor_ref) : null,
        context_ref: item.context_ref ? String(item.context_ref) : correlation_ref,
      }))
    : [];

  return Object.freeze({
    ...normalizedResponse,
    service_profile: profile,
    evidence: Object.freeze(evidence),
    evidence_authority: 'existing_logistics_evidence_and_proof_boundaries',
    tracking_authority: 'existing_shipment_tracking_boundary',
    canonical_mutation_authority: 'existing_canonical_domain_authority',
    direct_domain_mutation: false,
    persistence: 'existing_evidence_and_core_state_only',
    duplicate_evidence_store: false,
    duplicate_tracking_store: false,
    duplicate_event_store: false,
  });
}

export function assertExternalStatusEvidenceBoundary(value = {}) {
  if (value.direct_domain_mutation === true) {
    invalid('external status/evidence must not directly mutate canonical domain state');
  }

  for (const field of [
    'shipment_authority',
    'fulfillment_authority',
    'payment_authority',
    'inventory_authority',
    'assignment_authority',
    'routing_authority',
    'provider_selection_authority',
    'event_store_authority',
  ]) {
    if (value[field] === true || value[field] === 'external_adapter') {
      invalid(`external status/evidence boundary violation: ${field}`);
    }
  }

  if (value.evidence_authority !== 'existing_logistics_evidence_and_proof_boundaries') {
    invalid('evidence must remain within existing Logistics evidence/proof boundaries');
  }

  if (value.tracking_authority !== 'existing_shipment_tracking_boundary') {
    invalid('tracking must remain within existing shipment tracking boundary');
  }

  if (value.canonical_mutation_authority !== 'existing_canonical_domain_authority') {
    invalid('canonical mutation authority must remain existing canonical domain authority');
  }

  if (value.persistence !== 'existing_evidence_and_core_state_only') {
    invalid('external evidence persistence must remain existing evidence/core state only');
  }

  return true;
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
