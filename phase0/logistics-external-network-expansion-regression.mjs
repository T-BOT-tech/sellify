import assert from 'node:assert/strict';

import {
  normalizeExternalNetworkIntegration,
  normalizeExternalIntegrationLifecycle,
  normalizeExternalInboundMessage,
  normalizeExternalEvidenceReconciliation,
  normalizeExternalCanonicalHandoff,
  assertExternalCanonicalHandoffBoundary,
  buildExternalCanonicalHandoffDisposition,
  externalNetworkExpansionClosureGate,
  assertExternalEvidenceReconciliationBoundary,
  buildExternalEvidenceReconciliationDisposition,
  assertExternalInboundBoundary,
  buildExternalInboundDisposition,
  assertExternalIntegrationLifecycleBoundary,
  assertExternalIntegrationLifecycleTransition,
  validateExternalAdapterTrust,
  assertExternalAdapterTrustBoundary,
  validateExternalNetworkIntegration,
  assertExternalNetworkBoundary,
  buildExternalNetworkEnvelope,
  normalizeExternalAdapterCapabilities,
  validateExternalAdapterCapabilities,
  assertExternalAdapterCapabilityBoundary,
  buildExternalAdapterRequest,
  normalizeExternalAdapterResponse,
  normalizeExternalStatusEvidence,
  assertExternalStatusEvidenceBoundary,
  classifyExternalAdapterOutcome,
  buildExternalRetryDecision,
  assertExternalRetryBoundary,
} from '../app/src/verticals/logistics/external-network-expansion-contract.js';

const integration = {
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  external_network_ref: 'NETWORK-01',
  service_profile: 'REGIONAL_FREIGHT',
  direction: 'BIDIRECTIONAL',
};

const normalized = normalizeExternalNetworkIntegration(integration);
const inbound = normalizeExternalInboundMessage({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS', 'DELIVERY_PROOF'],
  },
  operation: 'DELIVERY_STATUS',
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-IN-01',
  idempotency_key: 'IDEMP-IN-01',
  message_ref: 'MSG-IN-01',
  payload: { external_ref: 'EXT-DEL-01', status: 'COMPLETED' },
});
assert.equal(inbound.authority, 'external_adapter_observation');
assert.equal(inbound.canonical_mutation_authority, 'existing_canonical_domain_authority');
assert.equal(inbound.direct_domain_mutation, false);
assert.equal(inbound.duplicate_callback_store, false);
assert.equal(inbound.duplicate_event_store, false);
assert.equal(assertExternalInboundBoundary(inbound), true);

const acceptedInbound = buildExternalInboundDisposition({ message: inbound, previously_seen: false });
assert.equal(acceptedInbound.disposition, 'ACCEPT_FOR_CANONICAL_PROCESSING');
assert.equal(acceptedInbound.direct_domain_mutation, false);

const duplicateInbound = buildExternalInboundDisposition({ message: inbound, previously_seen: true });
assert.equal(duplicateInbound.disposition, 'DUPLICATE_IGNORED');
assert.equal(duplicateInbound.idempotency_key, 'IDEMP-IN-01');

assert.throws(() => normalizeExternalInboundMessage({
  integration,
  operation: 'UNSUPPORTED_OPERATION',
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-IN-02',
  idempotency_key: 'IDEMP-IN-02',
  message_ref: 'MSG-IN-02',
  payload: {},
}), /unsupported external inbound operation/i);

assert.throws(() => normalizeExternalInboundMessage({
  integration,
  operation: 'DELIVERY_STATUS',
  organization_id: 'org-other',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-IN-03',
  idempotency_key: 'IDEMP-IN-03',
  message_ref: 'MSG-IN-03',
  payload: {},
}), /organization scope mismatch/i);

assert.throws(() => assertExternalInboundBoundary({
  ...inbound,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalInboundBoundary({
  ...inbound,
  event_store_authority: 'external_adapter',
}), /event_store_authority/i);

assert.throws(() => assertExternalInboundBoundary({
  ...inbound,
  persistence: 'external_callback_store',
}), /callback persistence authority/i);

assert.throws(() => buildExternalInboundDisposition({
  message: { ...inbound, idempotency_key: '' },
  previously_seen: false,
}), /idempotency_key/i);


for (const state of ['CONFIGURED', 'ENABLED', 'SUSPENDED', 'DISABLED', 'RETIRED']) {
  const lifecycle = normalizeExternalIntegrationLifecycle({
    integration,
    state,
  });
  assert.equal(lifecycle.lifecycle_state, state);
  assert.equal(lifecycle.lifecycle_authority, 'existing_integration_configuration_authority');
  assert.equal(lifecycle.authorization_authority, 'existing_server_side_auth_scope');
  assert.equal(lifecycle.execution_authority, false);
  assert.equal(lifecycle.provider_registry_authority, false);
  assert.equal(lifecycle.persistence, 'existing_integration_or_canonical_domain_state_only');
  assert.equal(assertExternalIntegrationLifecycleBoundary(lifecycle), true);
}

for (const [from_state, to_state] of [
  ['CONFIGURED', 'ENABLED'],
  ['CONFIGURED', 'DISABLED'],
  ['CONFIGURED', 'RETIRED'],
  ['ENABLED', 'SUSPENDED'],
  ['ENABLED', 'DISABLED'],
  ['ENABLED', 'RETIRED'],
  ['SUSPENDED', 'ENABLED'],
  ['SUSPENDED', 'DISABLED'],
  ['SUSPENDED', 'RETIRED'],
  ['DISABLED', 'CONFIGURED'],
  ['DISABLED', 'RETIRED'],
]) {
  assert.equal(assertExternalIntegrationLifecycleTransition({ from_state, to_state }), true);
}

for (const transition of [
  ['RETIRED', 'ENABLED'],
  ['RETIRED', 'CONFIGURED'],
  ['ENABLED', 'CONFIGURED'],
  ['SUSPENDED', 'CONFIGURED'],
  ['DISABLED', 'ENABLED'],
]) {
  assert.throws(() => assertExternalIntegrationLifecycleTransition({
    from_state: transition[0],
    to_state: transition[1],
  }), /invalid external integration lifecycle transition/i);
}

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'ENABLED',
  organization_id: 'org-other',
}), /organization scope mismatch/i);

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'ENABLED',
  integration_ref: 'INT-other',
}), /integration scope mismatch/i);

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'ENABLED',
  adapter_ref: 'ADAPTER-SPOOFED',
}), /adapter identity mismatch/i);

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'UNKNOWN',
}), /unsupported external integration lifecycle state/i);


const trustedAdapter = validateExternalAdapterTrust({
  integration,
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-TRUST-01',
  capabilities: ['TRACKING_STATUS', 'DELIVERY_PROOF'],
});
assert.equal(trustedAdapter.trusted, true);
assert.equal(trustedAdapter.organization_id, 'org-1');
assert.equal(trustedAdapter.integration_ref, 'INT-001');
assert.equal(trustedAdapter.adapter_ref, 'ADAPTER-CARRIER-01');
assert.equal(trustedAdapter.authorization_authority, 'existing_server_side_auth_scope');
assert.equal(trustedAdapter.provider_identity_authority, 'existing_integration_state');
assert.equal(trustedAdapter.direct_domain_mutation, false);
assert.equal(assertExternalAdapterTrustBoundary(trustedAdapter), true);

assert.throws(() => validateExternalAdapterTrust({
  integration,
  organization_id: 'org-OTHER',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-TRUST-02',
  capabilities: ['TRACKING_STATUS'],
}), /organization scope mismatch/i);

assert.throws(() => validateExternalAdapterTrust({
  integration,
  organization_id: 'org-1',
  integration_ref: 'INT-OTHER',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-TRUST-03',
  capabilities: ['TRACKING_STATUS'],
}), /integration scope mismatch/i);

assert.throws(() => validateExternalAdapterTrust({
  integration,
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-SPOOFED',
  correlation_ref: 'CORR-TRUST-04',
  capabilities: ['TRACKING_STATUS'],
}), /adapter identity mismatch/i);


assert.equal(normalized.contract_version, '1.0');
assert.equal(normalized.organization_id, 'org-1');
assert.equal(normalized.integration_ref, 'INT-001');
assert.equal(normalized.adapter_ref, 'ADAPTER-CARRIER-01');
assert.equal(normalized.external_network_ref, 'NETWORK-01');
assert.equal(normalized.service_profile, 'REGIONAL_FREIGHT');
assert.equal(normalized.direction, 'BIDIRECTIONAL');

for (const profile of ['REGIONAL_FREIGHT', 'B2B_DISTRIBUTION', 'B2C_DELIVERY', 'P2P_DELIVERY']) {
  assert.equal(normalizeExternalNetworkIntegration({
    ...integration,
    service_profile: profile,
  }).service_profile, profile);
}

for (const direction of ['SELLIFY_TO_EXTERNAL', 'EXTERNAL_TO_SELLIFY', 'BIDIRECTIONAL', 'READ_ONLY']) {
  assert.equal(normalizeExternalNetworkIntegration({
    ...integration,
    direction,
  }).direction, direction);
}

assert.throws(() => normalizeExternalNetworkIntegration({
  ...integration,
  service_profile: 'UNKNOWN',
}), /unsupported service_profile/i);

assert.throws(() => normalizeExternalNetworkIntegration({
  ...integration,
  direction: 'UNKNOWN',
}), /unsupported integration direction/i);

const validated = validateExternalNetworkIntegration(integration);
assert.equal(validated.valid, true);
assert.equal(validated.boundary.canonical_contract, 'existing_logistics_contract');
assert.equal(validated.boundary.adapter_authority, 'external_adapter');
assert.equal(validated.boundary.provider_business_logic, 'adapter_only');
assert.equal(validated.boundary.logistics_core_provider_neutral, true);
assert.equal(validated.boundary.provider_registry_authority, false);
assert.equal(validated.boundary.selection_authority, false);
assert.equal(validated.boundary.assignment_authority, false);
assert.equal(validated.boundary.routing_authority, false);
assert.equal(validated.boundary.gps_authority, false);
assert.equal(validated.boundary.shipment_authority, false);
assert.equal(validated.boundary.fulfillment_authority, false);
assert.equal(validated.boundary.inventory_authority, false);
assert.equal(validated.boundary.payment_authority, false);
assert.equal(validated.boundary.settlement_authority, false);
assert.equal(validated.boundary.identity_authority, false);
assert.equal(validated.boundary.event_store_authority, false);
assert.equal(validated.boundary.persistence, 'existing_integration_or_canonical_domain_state_only');

assert.equal(assertExternalNetworkBoundary(validated.boundary), true);

const envelope = buildExternalNetworkEnvelope({
  integration,
  operation: 'CREATE_DELIVERY_REQUEST',
  idempotency_key: 'idem-001',
  payload: {
    external_request_ref: 'EXT-REQ-01',
    destination_ref: 'LOC-01',
  },
});
assert.equal(envelope.authority, 'external_adapter_boundary');
assert.equal(envelope.transaction_authority, 'existing_canonical_domain_authority');
assert.equal(envelope.provider_selection_authority, false);
assert.equal(envelope.routing_authority, false);
assert.equal(envelope.assignment_authority, false);
assert.equal(envelope.idempotency_key, 'idem-001');

for (const field of [
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
]) {
  assert.throws(() => assertExternalNetworkBoundary({
    ...validated.boundary,
    [field]: true,
  }), new RegExp(field));
}

assert.throws(() => assertExternalNetworkBoundary({
  ...validated.boundary,
  logistics_core_provider_neutral: false,
}), /provider-neutral/i);

assert.throws(() => assertExternalNetworkBoundary({
  ...validated.boundary,
  provider_business_logic: 'logistics_core',
}), /adapter-only/i);

assert.throws(() => assertExternalNetworkBoundary({
  ...validated.boundary,
  adapter_authority: 'logistics_core',
}), /external_adapter/i);

const capabilities = normalizeExternalAdapterCapabilities({
  ...integration,
  capabilities: ['DELIVERY_REQUEST', 'TRACKING_STATUS', 'DELIVERY_PROOF', 'CAPACITY_INQUIRY'],
});
assert.deepEqual(capabilities.capabilities, [
  'DELIVERY_REQUEST',
  'TRACKING_STATUS',
  'DELIVERY_PROOF',
  'CAPACITY_INQUIRY',
]);
assert.equal(capabilities.capability_authority, 'external_adapter_declaration');
assert.equal(capabilities.execution_authority, false);
assert.equal(capabilities.provider_selection_authority, false);
assert.equal(capabilities.routing_authority, false);
assert.equal(capabilities.assignment_authority, false);
assert.equal(capabilities.persistence, 'existing_integration_or_canonical_domain_state_only');

for (const capability of [
  'DELIVERY_REQUEST',
  'DELIVERY_CANCEL',
  'TRACKING_STATUS',
  'DELIVERY_PROOF',
  'CAPACITY_INQUIRY',
  'STATUS_SYNCHRONIZATION',
]) {
  assert.equal(normalizeExternalAdapterCapabilities({
    ...integration,
    capabilities: [capability],
  }).capabilities[0], capability);
}

assert.throws(() => normalizeExternalAdapterCapabilities({
  ...integration,
  capabilities: ['UNKNOWN_CAPABILITY'],
}), /unsupported adapter capability/i);

assert.throws(() => normalizeExternalAdapterCapabilities({
  ...integration,
  capabilities: ['TRACKING_STATUS', 'TRACKING_STATUS'],
}), /duplicate adapter capability/i);

const readOnlyCapabilities = validateExternalAdapterCapabilities({
  ...integration,
  direction: 'READ_ONLY',
  capabilities: ['TRACKING_STATUS', 'DELIVERY_PROOF', 'CAPACITY_INQUIRY', 'STATUS_SYNCHRONIZATION'],
});
assert.equal(readOnlyCapabilities.valid, true);

assert.throws(() => validateExternalAdapterCapabilities({
  ...integration,
  direction: 'READ_ONLY',
  capabilities: ['DELIVERY_REQUEST'],
}), /READ_ONLY adapters cannot advertise DELIVERY_REQUEST/i);

assert.throws(() => validateExternalAdapterCapabilities({
  ...integration,
  direction: 'READ_ONLY',
  capabilities: ['DELIVERY_CANCEL'],
}), /READ_ONLY adapters cannot advertise DELIVERY_CANCEL/i);

assert.equal(assertExternalAdapterCapabilityBoundary(capabilities), true);

for (const field of [
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
]) {
  assert.throws(() => assertExternalAdapterCapabilityBoundary({
    ...capabilities,
    [field]: true,
  }), new RegExp(field));
}

assert.throws(() => assertExternalAdapterCapabilityBoundary({
  ...capabilities,
  capability_authority: 'external_adapter',
}), /declarative/i);

const request = buildExternalAdapterRequest({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST', 'TRACKING_STATUS'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-001',
  idempotency_key: 'idem-req-001',
  payload: { destination_ref: 'LOC-01' },
});
assert.equal(request.operation, 'DELIVERY_REQUEST');
assert.equal(request.correlation_ref, 'CORR-001');
assert.equal(request.idempotency_key, 'idem-req-001');
assert.equal(request.authority, 'external_adapter_boundary');
assert.equal(request.canonical_mutation_authority, 'existing_canonical_domain_authority');
assert.equal(request.direct_domain_mutation, false);

assert.throws(() => buildExternalAdapterRequest({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-002',
  idempotency_key: 'idem-req-002',
  payload: {},
}), /capability not advertised/i);

const normalizedResponse = normalizeExternalAdapterResponse({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-001',
  response: {
    status: 'accepted',
    external_ref: 'EXT-REQ-01',
    observed_at: '2026-10-04T10:00:00Z',
    evidence_ref: 'EVID-01',
  },
});
assert.equal(normalizedResponse.status, 'ACCEPTED');
assert.equal(normalizedResponse.external_ref, 'EXT-REQ-01');
assert.equal(normalizedResponse.correlation_ref, 'CORR-001');
assert.equal(normalizedResponse.authority, 'external_adapter_observation');
assert.equal(normalizedResponse.canonical_mutation_authority, 'existing_canonical_domain_authority');
assert.equal(normalizedResponse.direct_domain_mutation, false);
assert.equal(normalizedResponse.provider_selection_authority, false);
assert.equal(normalizedResponse.routing_authority, false);
assert.equal(normalizedResponse.assignment_authority, false);
assert.equal(normalizedResponse.shipment_authority, false);
assert.equal(normalizedResponse.fulfillment_authority, false);
assert.equal(normalizedResponse.payment_authority, false);
assert.equal(normalizedResponse.inventory_authority, false);

assert.throws(() => normalizeExternalAdapterResponse({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-003',
  response: { status: 'UNKNOWN' },
}), /unsupported adapter response status/i);

assert.throws(() => buildExternalAdapterRequest({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-004',
  payload: {},
}), /idempotency_key is required/i);

assert.throws(() => buildExternalNetworkEnvelope({
  integration,
  operation: 'CREATE_DELIVERY_REQUEST',
  payload: {},
}), /idempotency_key is required/i);


const statusEvidence = normalizeExternalStatusEvidence({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS'],
  },
  operation: 'TRACKING_STATUS',
  correlation_ref: 'CORR-TRACK-01',
  service_profile: 'REGIONAL_FREIGHT',
  response: {
    status: 'completed',
    external_ref: 'EXT-SHIP-01',
    observed_at: '2026-10-04T11:00:00Z',
    evidence: [
      {
        kind: 'checkpoint',
        ref: 'CHECKPOINT-01',
        captured_at: '2026-10-04T10:59:00Z',
        actor_ref: 'carrier-user-01',
      },
    ],
  },
});
assert.equal(statusEvidence.status, 'COMPLETED');
assert.equal(statusEvidence.external_ref, 'EXT-SHIP-01');
assert.equal(statusEvidence.evidence[0].kind, 'checkpoint');
assert.equal(statusEvidence.evidence[0].ref, 'CHECKPOINT-01');
assert.equal(statusEvidence.evidence_authority, 'existing_logistics_evidence_and_proof_boundaries');
assert.equal(statusEvidence.tracking_authority, 'existing_shipment_tracking_boundary');
assert.equal(statusEvidence.persistence, 'existing_evidence_and_core_state_only');
assert.equal(statusEvidence.duplicate_evidence_store, false);
assert.equal(statusEvidence.duplicate_tracking_store, false);
assert.equal(statusEvidence.duplicate_event_store, false);
assert.equal(assertExternalStatusEvidenceBoundary(statusEvidence), true);

assert.throws(() => normalizeExternalStatusEvidence({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS'],
  },
  operation: 'TRACKING_STATUS',
  correlation_ref: 'CORR-TRACK-02',
  service_profile: 'B2C_DELIVERY',
  response: {
    status: 'completed',
    evidence: [],
  },
}), /service_profile does not match integration/i);

assert.throws(() => assertExternalStatusEvidenceBoundary({
  ...statusEvidence,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalStatusEvidenceBoundary({
  ...statusEvidence,
  shipment_authority: 'external_adapter',
}), /shipment_authority/i);

assert.throws(() => assertExternalStatusEvidenceBoundary({
  ...statusEvidence,
  evidence_authority: 'external_adapter',
}), /existing Logistics evidence/i);


const successOutcome = classifyExternalAdapterOutcome({ status: 'COMPLETED' });
assert.equal(successOutcome.outcome_class, 'SUCCESS');
assert.equal(successOutcome.retryable, false);
assert.equal(successOutcome.canonical_state_mutation, false);

const pendingOutcome = classifyExternalAdapterOutcome({ status: 'PENDING' });
assert.equal(pendingOutcome.outcome_class, 'PENDING');
assert.equal(pendingOutcome.retryable, true);
assert.equal(pendingOutcome.resolution_required, true);

const rejectedOutcome = classifyExternalAdapterOutcome({ status: 'REJECTED' });
assert.equal(rejectedOutcome.outcome_class, 'REJECTED');
assert.equal(rejectedOutcome.retryable, false);

const timeoutOutcome = classifyExternalAdapterOutcome({
  status: 'PENDING',
  timeout: true,
  response_received: false,
});
assert.equal(timeoutOutcome.outcome_class, 'AMBIGUOUS');
assert.equal(timeoutOutcome.retryable, true);
assert.equal(timeoutOutcome.canonical_state_mutation, false);
assert.equal(timeoutOutcome.resolution_required, true);

const retryDecision = buildExternalRetryDecision({
  idempotency_key: 'idem-retry-001',
  attempt: 1,
  max_attempts: 3,
  outcome: timeoutOutcome,
});
assert.equal(retryDecision.retry, true);
assert.equal(retryDecision.terminal, false);
assert.equal(retryDecision.canonical_state_mutation, false);
assert.equal(retryDecision.event_store_authority, false);
assert.equal(assertExternalRetryBoundary(retryDecision), true);

const terminalRetryDecision = buildExternalRetryDecision({
  idempotency_key: 'idem-retry-002',
  attempt: 3,
  max_attempts: 3,
  outcome: timeoutOutcome,
});
assert.equal(terminalRetryDecision.retry, false);
assert.equal(terminalRetryDecision.terminal, true);
assert.equal(terminalRetryDecision.resolution_required, true);

assert.throws(() => buildExternalRetryDecision({
  idempotency_key: 'idem-retry-003',
  attempt: 1,
  max_attempts: 3,
  outcome: {
    outcome_class: 'AMBIGUOUS',
    retryable: true,
    resolution_required: true,
  },
}), /canonical/i);

assert.throws(() => assertExternalRetryBoundary({
  ...retryDecision,
  canonical_state_mutation: true,
}), /must not mutate canonical state/i);

assert.throws(() => assertExternalRetryBoundary({
  ...retryDecision,
  event_store_authority: true,
}), /event-store authority/i);

assert.throws(() => assertExternalRetryBoundary({
  ...retryDecision,
  persistence: 'external_retry_store',
}), /existing integration\/core state/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  authorization_authority: 'external_adapter',
}), /server-side auth scope/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  provider_identity_authority: 'external_adapter',
}), /existing integration state/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  persistence: 'external_adapter_registry',
}), /separate persistence authority/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  lifecycle_authority: 'external_adapter',
}), /existing integration configuration authority/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  authorization_authority: 'external_adapter',
}), /server-side auth scope/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  execution_authority: true,
}), /provider execution authority/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  provider_registry_authority: true,
}), /provider registry authority/i);


const matchedHandoff = normalizeExternalCanonicalHandoff({
  reconciliation: matchedReconciliation,
  canonical_target: 'core_fulfillment',
  transition_ref: 'TRANS-001',
  authorization_scope: 'org-1:fulfillment:write',
});
assert.equal(matchedHandoff.action, 'CANONICAL_PROCESSING_ELIGIBLE');
assert.equal(matchedHandoff.canonical_processing_authority, 'existing_canonical_domain_authority');
assert.equal(matchedHandoff.authorization_authority, 'existing_server_side_auth_scope');
assert.equal(matchedHandoff.direct_domain_mutation, false);
assert.equal(matchedHandoff.external_execution_authority, false);
assert.equal(matchedHandoff.financial_completion_authority, 'existing_payment_and_settlement_authority');
assert.equal(assertExternalCanonicalHandoffBoundary(matchedHandoff), true);
const matchedDisposition = buildExternalCanonicalHandoffDisposition({ handoff: matchedHandoff });
assert.equal(matchedDisposition.canonical_processing_allowed, true);
assert.equal(matchedDisposition.canonical_transition_allowed, false);
assert.equal(matchedDisposition.mutation_executor, 'existing_canonical_domain_authority');
assert.equal(matchedDisposition.external_adapter_execution, false);

const blockedHandoff = normalizeExternalCanonicalHandoff({
  reconciliation: conflictingReference,
  canonical_target: 'core_fulfillment',
  transition_ref: 'TRANS-002',
  authorization_scope: 'org-1:fulfillment:write',
});
assert.equal(blockedHandoff.action, 'CANONICAL_TRANSITION_BLOCKED');
assert.equal(buildExternalCanonicalHandoffDisposition({ handoff: blockedHandoff }).canonical_processing_allowed, false);

const observationHandoff = normalizeExternalCanonicalHandoff({
  reconciliation: newObservation,
  canonical_target: 'logistics_evidence',
  transition_ref: 'TRANS-003',
  authorization_scope: 'org-1:logistics:evidence',
});
assert.equal(observationHandoff.action, 'CANONICAL_PROCESSING_ELIGIBLE');

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  direct_domain_mutation: true,
}), /must not execute or directly mutate/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  external_execution_authority: true,
}), /must not execute or directly mutate/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  authorization_authority: 'external_adapter',
}), /server-side auth scope/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  canonical_processing_authority: 'external_adapter',
}), /canonical domain authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  financial_completion_authority: 'external_adapter',
}), /financial completion/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  provider_selection_authority: true,
}), /provider_selection_authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  routing_authority: true,
}), /routing_authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  assignment_authority: true,
}), /assignment_authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  duplicate_handoff_store: true,
}), /duplicate handoff store/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  persistence: 'external_handoff_store',
}), /canonical domain persistence/i);

const closureLifecycle = normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' });

const closure = externalNetworkExpansionClosureGate({
  integration: normalized,
  capabilities,
  lifecycle: closureLifecycle,
  inbound,
  reconciliation: matchedReconciliation,
  handoff: matchedHandoff,
});
assert.equal(closure.closed, true);
assert.equal(closure.provider_neutral, true);
assert.equal(closure.canonical_mutation_delegated, true);
assert.equal(closure.persistence, 'existing_integration_or_canonical_domain_state_only');
assert.equal(closure.integration_ref, 'INT-001');

assert.throws(() => externalNetworkExpansionClosureGate({
  integration: normalized,
  capabilities: { ...capabilities, provider_selection_authority: true },
  lifecycle: closureLifecycle,
  inbound,
  reconciliation: matchedReconciliation,
  handoff: matchedHandoff,
}), /provider selection authority/i);

assert.throws(() => externalNetworkExpansionClosureGate({
  integration: normalized,
  capabilities,
  lifecycle: closureLifecycle,
  inbound: { ...inbound, direct_domain_mutation: true },
  reconciliation: matchedReconciliation,
  handoff: matchedHandoff,
}), /direct canonical mutation/i);

assert.throws(() => externalNetworkExpansionClosureGate({
  integration: normalized,
  capabilities,
  lifecycle: closureLifecycle,
  inbound,
  reconciliation: matchedReconciliation,
  handoff: { ...matchedHandoff, external_execution_authority: true },
}), /external execution authority/i);

assert.throws(() => externalNetworkExpansionClosureGate({
  integration: normalized,
  capabilities,
  lifecycle: closureLifecycle,
  inbound,
  reconciliation: matchedReconciliation,
  handoff: { ...matchedHandoff, persistence: 'external_handoff_store' },
}), /existing canonical-domain persistence/i);

console.log('L21.10 External Canonical Handoff Boundary Regression: PASS');



const reconciliationBase = {
  ...inbound,
  payload: {
    external_ref: 'EXT-DEL-01',
    status: 'COMPLETED',
    evidence_ref: 'EVID-01',
  },
};

const matchedReconciliation = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_reference: 'EXT-DEL-01',
  canonical_status: 'COMPLETED',
  canonical_evidence_ref: 'EVID-01',
});
assert.equal(matchedReconciliation.reconciliation_outcome, 'MATCHED');
assert.equal(matchedReconciliation.evidence_authority, 'existing_logistics_evidence_and_proof_boundaries');
assert.equal(matchedReconciliation.tracking_authority, 'existing_shipment_tracking_boundary');
assert.equal(matchedReconciliation.fulfillment_authority, 'existing_core_fulfillment');
assert.equal(matchedReconciliation.financial_completion_authority, 'existing_payment_and_settlement_authority');
assert.equal(matchedReconciliation.direct_domain_mutation, false);
assert.equal(assertExternalEvidenceReconciliationBoundary(matchedReconciliation), true);
assert.equal(
  buildExternalEvidenceReconciliationDisposition({ reconciliation: matchedReconciliation }).action,
  'ACCEPT_OBSERVATION',
);

const newObservation = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
});
assert.equal(newObservation.reconciliation_outcome, 'NEW_OBSERVATION');
assert.equal(
  buildExternalEvidenceReconciliationDisposition({ reconciliation: newObservation }).action,
  'PRESERVE_FOR_CANONICAL_EVIDENCE_PROCESSING',
);

const conflictingReference = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_reference: 'DIFFERENT-REF',
  canonical_status: 'COMPLETED',
});
assert.equal(conflictingReference.reconciliation_outcome, 'CONFLICT');
assert.equal(
  buildExternalEvidenceReconciliationDisposition({ reconciliation: conflictingReference }).action,
  'BLOCK_CANONICAL_TRANSITION',
);

const conflictingStatus = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_reference: 'EXT-DEL-01',
  canonical_status: 'IN_TRANSIT',
});
assert.equal(conflictingStatus.reconciliation_outcome, 'CONFLICT');

const conflictingEvidence = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_evidence_ref: 'EVID-DIFFERENT',
});
assert.equal(conflictingEvidence.reconciliation_outcome, 'CONFLICT');

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  evidence_authority: 'external_adapter',
}), /existing Logistics evidence/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  tracking_authority: 'external_adapter',
}), /existing shipment tracking/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  fulfillment_authority: 'external_adapter',
}), /existing Core fulfillment/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  financial_completion_authority: 'external_adapter',
}), /payment and settlement/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  duplicate_reconciliation_store: true,
}), /duplicate store/i);

mport assert from 'node:assert/strict';

import {
  normalizeExternalNetworkIntegration,
  normalizeExternalIntegrationLifecycle,
  normalizeExternalInboundMessage,
  normalizeExternalEvidenceReconciliation,
  normalizeExternalCanonicalHandoff,
  assertExternalCanonicalHandoffBoundary,
  buildExternalCanonicalHandoffDisposition,
  assertExternalEvidenceReconciliationBoundary,
  buildExternalEvidenceReconciliationDisposition,
  assertExternalInboundBoundary,
  buildExternalInboundDisposition,
  assertExternalIntegrationLifecycleBoundary,
  assertExternalIntegrationLifecycleTransition,
  validateExternalAdapterTrust,
  assertExternalAdapterTrustBoundary,
  validateExternalNetworkIntegration,
  assertExternalNetworkBoundary,
  buildExternalNetworkEnvelope,
  normalizeExternalAdapterCapabilities,
  validateExternalAdapterCapabilities,
  assertExternalAdapterCapabilityBoundary,
  buildExternalAdapterRequest,
  normalizeExternalAdapterResponse,
  normalizeExternalStatusEvidence,
  assertExternalStatusEvidenceBoundary,
  classifyExternalAdapterOutcome,
  buildExternalRetryDecision,
  assertExternalRetryBoundary,
} from '../app/src/verticals/logistics/external-network-expansion-contract.js';

const integration = {
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  external_network_ref: 'NETWORK-01',
  service_profile: 'REGIONAL_FREIGHT',
  direction: 'BIDIRECTIONAL',
};

const normalized = normalizeExternalNetworkIntegration(integration);
const reconciliationBase = {
  ...inbound,
  payload: {
    external_ref: 'EXT-DEL-01',
    status: 'COMPLETED',
    evidence_ref: 'EVID-01',
  },
};

const matchedReconciliation = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_reference: 'EXT-DEL-01',
  canonical_status: 'COMPLETED',
  canonical_evidence_ref: 'EVID-01',
});
assert.equal(matchedReconciliation.reconciliation_outcome, 'MATCHED');
assert.equal(matchedReconciliation.evidence_authority, 'existing_logistics_evidence_and_proof_boundaries');
assert.equal(matchedReconciliation.tracking_authority, 'existing_shipment_tracking_boundary');
assert.equal(matchedReconciliation.fulfillment_authority, 'existing_core_fulfillment');
assert.equal(matchedReconciliation.financial_completion_authority, 'existing_payment_and_settlement_authority');
assert.equal(matchedReconciliation.direct_domain_mutation, false);
assert.equal(assertExternalEvidenceReconciliationBoundary(matchedReconciliation), true);
assert.equal(
  buildExternalEvidenceReconciliationDisposition({ reconciliation: matchedReconciliation }).action,
  'ACCEPT_OBSERVATION',
);

const newObservation = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
});
assert.equal(newObservation.reconciliation_outcome, 'NEW_OBSERVATION');
assert.equal(
  buildExternalEvidenceReconciliationDisposition({ reconciliation: newObservation }).action,
  'PRESERVE_FOR_CANONICAL_EVIDENCE_PROCESSING',
);

const conflictingReference = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_reference: 'DIFFERENT-REF',
  canonical_status: 'COMPLETED',
});
assert.equal(conflictingReference.reconciliation_outcome, 'CONFLICT');
assert.equal(
  buildExternalEvidenceReconciliationDisposition({ reconciliation: conflictingReference }).action,
  'BLOCK_CANONICAL_TRANSITION',
);

const conflictingStatus = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_reference: 'EXT-DEL-01',
  canonical_status: 'IN_TRANSIT',
});
assert.equal(conflictingStatus.reconciliation_outcome, 'CONFLICT');

const conflictingEvidence = normalizeExternalEvidenceReconciliation({
  inbound_message: reconciliationBase,
  canonical_evidence_ref: 'EVID-DIFFERENT',
});
assert.equal(conflictingEvidence.reconciliation_outcome, 'CONFLICT');

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  evidence_authority: 'external_adapter',
}), /existing Logistics evidence/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  tracking_authority: 'external_adapter',
}), /existing shipment tracking/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  fulfillment_authority: 'external_adapter',
}), /existing Core fulfillment/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  financial_completion_authority: 'external_adapter',
}), /payment and settlement/i);

assert.throws(() => assertExternalEvidenceReconciliationBoundary({
  ...matchedReconciliation,
  duplicate_reconciliation_store: true,
}), /duplicate store/i);

const inbound = normalizeExternalInboundMessage({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS', 'DELIVERY_PROOF'],
  },
  operation: 'DELIVERY_STATUS',
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-IN-01',
  idempotency_key: 'IDEMP-IN-01',
  message_ref: 'MSG-IN-01',
  payload: { external_ref: 'EXT-DEL-01', status: 'COMPLETED' },
});
assert.equal(inbound.authority, 'external_adapter_observation');
assert.equal(inbound.canonical_mutation_authority, 'existing_canonical_domain_authority');
assert.equal(inbound.direct_domain_mutation, false);
assert.equal(inbound.duplicate_callback_store, false);
assert.equal(inbound.duplicate_event_store, false);
assert.equal(assertExternalInboundBoundary(inbound), true);

const acceptedInbound = buildExternalInboundDisposition({ message: inbound, previously_seen: false });
assert.equal(acceptedInbound.disposition, 'ACCEPT_FOR_CANONICAL_PROCESSING');
assert.equal(acceptedInbound.direct_domain_mutation, false);

const duplicateInbound = buildExternalInboundDisposition({ message: inbound, previously_seen: true });
assert.equal(duplicateInbound.disposition, 'DUPLICATE_IGNORED');
assert.equal(duplicateInbound.idempotency_key, 'IDEMP-IN-01');

assert.throws(() => normalizeExternalInboundMessage({
  integration,
  operation: 'UNSUPPORTED_OPERATION',
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-IN-02',
  idempotency_key: 'IDEMP-IN-02',
  message_ref: 'MSG-IN-02',
  payload: {},
}), /unsupported external inbound operation/i);

assert.throws(() => normalizeExternalInboundMessage({
  integration,
  operation: 'DELIVERY_STATUS',
  organization_id: 'org-other',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-IN-03',
  idempotency_key: 'IDEMP-IN-03',
  message_ref: 'MSG-IN-03',
  payload: {},
}), /organization scope mismatch/i);

assert.throws(() => assertExternalInboundBoundary({
  ...inbound,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalInboundBoundary({
  ...inbound,
  event_store_authority: 'external_adapter',
}), /event_store_authority/i);

assert.throws(() => assertExternalInboundBoundary({
  ...inbound,
  persistence: 'external_callback_store',
}), /callback persistence authority/i);

assert.throws(() => buildExternalInboundDisposition({
  message: { ...inbound, idempotency_key: '' },
  previously_seen: false,
}), /idempotency_key/i);


for (const state of ['CONFIGURED', 'ENABLED', 'SUSPENDED', 'DISABLED', 'RETIRED']) {
  const lifecycle = normalizeExternalIntegrationLifecycle({
    integration,
    state,
  });
  assert.equal(lifecycle.lifecycle_state, state);
  assert.equal(lifecycle.lifecycle_authority, 'existing_integration_configuration_authority');
  assert.equal(lifecycle.authorization_authority, 'existing_server_side_auth_scope');
  assert.equal(lifecycle.execution_authority, false);
  assert.equal(lifecycle.provider_registry_authority, false);
  assert.equal(lifecycle.persistence, 'existing_integration_or_canonical_domain_state_only');
  assert.equal(assertExternalIntegrationLifecycleBoundary(lifecycle), true);
}

for (const [from_state, to_state] of [
  ['CONFIGURED', 'ENABLED'],
  ['CONFIGURED', 'DISABLED'],
  ['CONFIGURED', 'RETIRED'],
  ['ENABLED', 'SUSPENDED'],
  ['ENABLED', 'DISABLED'],
  ['ENABLED', 'RETIRED'],
  ['SUSPENDED', 'ENABLED'],
  ['SUSPENDED', 'DISABLED'],
  ['SUSPENDED', 'RETIRED'],
  ['DISABLED', 'CONFIGURED'],
  ['DISABLED', 'RETIRED'],
]) {
  assert.equal(assertExternalIntegrationLifecycleTransition({ from_state, to_state }), true);
}

for (const transition of [
  ['RETIRED', 'ENABLED'],
  ['RETIRED', 'CONFIGURED'],
  ['ENABLED', 'CONFIGURED'],
  ['SUSPENDED', 'CONFIGURED'],
  ['DISABLED', 'ENABLED'],
]) {
  assert.throws(() => assertExternalIntegrationLifecycleTransition({
    from_state: transition[0],
    to_state: transition[1],
  }), /invalid external integration lifecycle transition/i);
}

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'ENABLED',
  organization_id: 'org-other',
}), /organization scope mismatch/i);

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'ENABLED',
  integration_ref: 'INT-other',
}), /integration scope mismatch/i);

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'ENABLED',
  adapter_ref: 'ADAPTER-SPOOFED',
}), /adapter identity mismatch/i);

assert.throws(() => normalizeExternalIntegrationLifecycle({
  integration,
  state: 'UNKNOWN',
}), /unsupported external integration lifecycle state/i);


const trustedAdapter = validateExternalAdapterTrust({
  integration,
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-TRUST-01',
  capabilities: ['TRACKING_STATUS', 'DELIVERY_PROOF'],
});
assert.equal(trustedAdapter.trusted, true);
assert.equal(trustedAdapter.organization_id, 'org-1');
assert.equal(trustedAdapter.integration_ref, 'INT-001');
assert.equal(trustedAdapter.adapter_ref, 'ADAPTER-CARRIER-01');
assert.equal(trustedAdapter.authorization_authority, 'existing_server_side_auth_scope');
assert.equal(trustedAdapter.provider_identity_authority, 'existing_integration_state');
assert.equal(trustedAdapter.direct_domain_mutation, false);
assert.equal(assertExternalAdapterTrustBoundary(trustedAdapter), true);

assert.throws(() => validateExternalAdapterTrust({
  integration,
  organization_id: 'org-OTHER',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-TRUST-02',
  capabilities: ['TRACKING_STATUS'],
}), /organization scope mismatch/i);

assert.throws(() => validateExternalAdapterTrust({
  integration,
  organization_id: 'org-1',
  integration_ref: 'INT-OTHER',
  adapter_ref: 'ADAPTER-CARRIER-01',
  correlation_ref: 'CORR-TRUST-03',
  capabilities: ['TRACKING_STATUS'],
}), /integration scope mismatch/i);

assert.throws(() => validateExternalAdapterTrust({
  integration,
  organization_id: 'org-1',
  integration_ref: 'INT-001',
  adapter_ref: 'ADAPTER-SPOOFED',
  correlation_ref: 'CORR-TRUST-04',
  capabilities: ['TRACKING_STATUS'],
}), /adapter identity mismatch/i);


assert.equal(normalized.contract_version, '1.0');
assert.equal(normalized.organization_id, 'org-1');
assert.equal(normalized.integration_ref, 'INT-001');
assert.equal(normalized.adapter_ref, 'ADAPTER-CARRIER-01');
assert.equal(normalized.external_network_ref, 'NETWORK-01');
assert.equal(normalized.service_profile, 'REGIONAL_FREIGHT');
assert.equal(normalized.direction, 'BIDIRECTIONAL');

for (const profile of ['REGIONAL_FREIGHT', 'B2B_DISTRIBUTION', 'B2C_DELIVERY', 'P2P_DELIVERY']) {
  assert.equal(normalizeExternalNetworkIntegration({
    ...integration,
    service_profile: profile,
  }).service_profile, profile);
}

for (const direction of ['SELLIFY_TO_EXTERNAL', 'EXTERNAL_TO_SELLIFY', 'BIDIRECTIONAL', 'READ_ONLY']) {
  assert.equal(normalizeExternalNetworkIntegration({
    ...integration,
    direction,
  }).direction, direction);
}

assert.throws(() => normalizeExternalNetworkIntegration({
  ...integration,
  service_profile: 'UNKNOWN',
}), /unsupported service_profile/i);

assert.throws(() => normalizeExternalNetworkIntegration({
  ...integration,
  direction: 'UNKNOWN',
}), /unsupported integration direction/i);

const validated = validateExternalNetworkIntegration(integration);
assert.equal(validated.valid, true);
assert.equal(validated.boundary.canonical_contract, 'existing_logistics_contract');
assert.equal(validated.boundary.adapter_authority, 'external_adapter');
assert.equal(validated.boundary.provider_business_logic, 'adapter_only');
assert.equal(validated.boundary.logistics_core_provider_neutral, true);
assert.equal(validated.boundary.provider_registry_authority, false);
assert.equal(validated.boundary.selection_authority, false);
assert.equal(validated.boundary.assignment_authority, false);
assert.equal(validated.boundary.routing_authority, false);
assert.equal(validated.boundary.gps_authority, false);
assert.equal(validated.boundary.shipment_authority, false);
assert.equal(validated.boundary.fulfillment_authority, false);
assert.equal(validated.boundary.inventory_authority, false);
assert.equal(validated.boundary.payment_authority, false);
assert.equal(validated.boundary.settlement_authority, false);
assert.equal(validated.boundary.identity_authority, false);
assert.equal(validated.boundary.event_store_authority, false);
assert.equal(validated.boundary.persistence, 'existing_integration_or_canonical_domain_state_only');

assert.equal(assertExternalNetworkBoundary(validated.boundary), true);

const envelope = buildExternalNetworkEnvelope({
  integration,
  operation: 'CREATE_DELIVERY_REQUEST',
  idempotency_key: 'idem-001',
  payload: {
    external_request_ref: 'EXT-REQ-01',
    destination_ref: 'LOC-01',
  },
});
assert.equal(envelope.authority, 'external_adapter_boundary');
assert.equal(envelope.transaction_authority, 'existing_canonical_domain_authority');
assert.equal(envelope.provider_selection_authority, false);
assert.equal(envelope.routing_authority, false);
assert.equal(envelope.assignment_authority, false);
assert.equal(envelope.idempotency_key, 'idem-001');

for (const field of [
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
]) {
  assert.throws(() => assertExternalNetworkBoundary({
    ...validated.boundary,
    [field]: true,
  }), new RegExp(field));
}

assert.throws(() => assertExternalNetworkBoundary({
  ...validated.boundary,
  logistics_core_provider_neutral: false,
}), /provider-neutral/i);

assert.throws(() => assertExternalNetworkBoundary({
  ...validated.boundary,
  provider_business_logic: 'logistics_core',
}), /adapter-only/i);

assert.throws(() => assertExternalNetworkBoundary({
  ...validated.boundary,
  adapter_authority: 'logistics_core',
}), /external_adapter/i);

const capabilities = normalizeExternalAdapterCapabilities({
  ...integration,
  capabilities: ['DELIVERY_REQUEST', 'TRACKING_STATUS', 'DELIVERY_PROOF', 'CAPACITY_INQUIRY'],
});
assert.deepEqual(capabilities.capabilities, [
  'DELIVERY_REQUEST',
  'TRACKING_STATUS',
  'DELIVERY_PROOF',
  'CAPACITY_INQUIRY',
]);
assert.equal(capabilities.capability_authority, 'external_adapter_declaration');
assert.equal(capabilities.execution_authority, false);
assert.equal(capabilities.provider_selection_authority, false);
assert.equal(capabilities.routing_authority, false);
assert.equal(capabilities.assignment_authority, false);
assert.equal(capabilities.persistence, 'existing_integration_or_canonical_domain_state_only');

for (const capability of [
  'DELIVERY_REQUEST',
  'DELIVERY_CANCEL',
  'TRACKING_STATUS',
  'DELIVERY_PROOF',
  'CAPACITY_INQUIRY',
  'STATUS_SYNCHRONIZATION',
]) {
  assert.equal(normalizeExternalAdapterCapabilities({
    ...integration,
    capabilities: [capability],
  }).capabilities[0], capability);
}

assert.throws(() => normalizeExternalAdapterCapabilities({
  ...integration,
  capabilities: ['UNKNOWN_CAPABILITY'],
}), /unsupported adapter capability/i);

assert.throws(() => normalizeExternalAdapterCapabilities({
  ...integration,
  capabilities: ['TRACKING_STATUS', 'TRACKING_STATUS'],
}), /duplicate adapter capability/i);

const readOnlyCapabilities = validateExternalAdapterCapabilities({
  ...integration,
  direction: 'READ_ONLY',
  capabilities: ['TRACKING_STATUS', 'DELIVERY_PROOF', 'CAPACITY_INQUIRY', 'STATUS_SYNCHRONIZATION'],
});
assert.equal(readOnlyCapabilities.valid, true);

assert.throws(() => validateExternalAdapterCapabilities({
  ...integration,
  direction: 'READ_ONLY',
  capabilities: ['DELIVERY_REQUEST'],
}), /READ_ONLY adapters cannot advertise DELIVERY_REQUEST/i);

assert.throws(() => validateExternalAdapterCapabilities({
  ...integration,
  direction: 'READ_ONLY',
  capabilities: ['DELIVERY_CANCEL'],
}), /READ_ONLY adapters cannot advertise DELIVERY_CANCEL/i);

assert.equal(assertExternalAdapterCapabilityBoundary(capabilities), true);

for (const field of [
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
]) {
  assert.throws(() => assertExternalAdapterCapabilityBoundary({
    ...capabilities,
    [field]: true,
  }), new RegExp(field));
}

assert.throws(() => assertExternalAdapterCapabilityBoundary({
  ...capabilities,
  capability_authority: 'external_adapter',
}), /declarative/i);

const request = buildExternalAdapterRequest({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST', 'TRACKING_STATUS'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-001',
  idempotency_key: 'idem-req-001',
  payload: { destination_ref: 'LOC-01' },
});
assert.equal(request.operation, 'DELIVERY_REQUEST');
assert.equal(request.correlation_ref, 'CORR-001');
assert.equal(request.idempotency_key, 'idem-req-001');
assert.equal(request.authority, 'external_adapter_boundary');
assert.equal(request.canonical_mutation_authority, 'existing_canonical_domain_authority');
assert.equal(request.direct_domain_mutation, false);

assert.throws(() => buildExternalAdapterRequest({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-002',
  idempotency_key: 'idem-req-002',
  payload: {},
}), /capability not advertised/i);

const normalizedResponse = normalizeExternalAdapterResponse({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-001',
  response: {
    status: 'accepted',
    external_ref: 'EXT-REQ-01',
    observed_at: '2026-10-04T10:00:00Z',
    evidence_ref: 'EVID-01',
  },
});
assert.equal(normalizedResponse.status, 'ACCEPTED');
assert.equal(normalizedResponse.external_ref, 'EXT-REQ-01');
assert.equal(normalizedResponse.correlation_ref, 'CORR-001');
assert.equal(normalizedResponse.authority, 'external_adapter_observation');
assert.equal(normalizedResponse.canonical_mutation_authority, 'existing_canonical_domain_authority');
assert.equal(normalizedResponse.direct_domain_mutation, false);
assert.equal(normalizedResponse.provider_selection_authority, false);
assert.equal(normalizedResponse.routing_authority, false);
assert.equal(normalizedResponse.assignment_authority, false);
assert.equal(normalizedResponse.shipment_authority, false);
assert.equal(normalizedResponse.fulfillment_authority, false);
assert.equal(normalizedResponse.payment_authority, false);
assert.equal(normalizedResponse.inventory_authority, false);

assert.throws(() => normalizeExternalAdapterResponse({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-003',
  response: { status: 'UNKNOWN' },
}), /unsupported adapter response status/i);

assert.throws(() => buildExternalAdapterRequest({
  integration: {
    ...integration,
    capabilities: ['DELIVERY_REQUEST'],
  },
  operation: 'DELIVERY_REQUEST',
  correlation_ref: 'CORR-004',
  payload: {},
}), /idempotency_key is required/i);

assert.throws(() => buildExternalNetworkEnvelope({
  integration,
  operation: 'CREATE_DELIVERY_REQUEST',
  payload: {},
}), /idempotency_key is required/i);


const statusEvidence = normalizeExternalStatusEvidence({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS'],
  },
  operation: 'TRACKING_STATUS',
  correlation_ref: 'CORR-TRACK-01',
  service_profile: 'REGIONAL_FREIGHT',
  response: {
    status: 'completed',
    external_ref: 'EXT-SHIP-01',
    observed_at: '2026-10-04T11:00:00Z',
    evidence: [
      {
        kind: 'checkpoint',
        ref: 'CHECKPOINT-01',
        captured_at: '2026-10-04T10:59:00Z',
        actor_ref: 'carrier-user-01',
      },
    ],
  },
});
assert.equal(statusEvidence.status, 'COMPLETED');
assert.equal(statusEvidence.external_ref, 'EXT-SHIP-01');
assert.equal(statusEvidence.evidence[0].kind, 'checkpoint');
assert.equal(statusEvidence.evidence[0].ref, 'CHECKPOINT-01');
assert.equal(statusEvidence.evidence_authority, 'existing_logistics_evidence_and_proof_boundaries');
assert.equal(statusEvidence.tracking_authority, 'existing_shipment_tracking_boundary');
assert.equal(statusEvidence.persistence, 'existing_evidence_and_core_state_only');
assert.equal(statusEvidence.duplicate_evidence_store, false);
assert.equal(statusEvidence.duplicate_tracking_store, false);
assert.equal(statusEvidence.duplicate_event_store, false);
assert.equal(assertExternalStatusEvidenceBoundary(statusEvidence), true);

assert.throws(() => normalizeExternalStatusEvidence({
  integration: {
    ...integration,
    capabilities: ['TRACKING_STATUS'],
  },
  operation: 'TRACKING_STATUS',
  correlation_ref: 'CORR-TRACK-02',
  service_profile: 'B2C_DELIVERY',
  response: {
    status: 'completed',
    evidence: [],
  },
}), /service_profile does not match integration/i);

assert.throws(() => assertExternalStatusEvidenceBoundary({
  ...statusEvidence,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalStatusEvidenceBoundary({
  ...statusEvidence,
  shipment_authority: 'external_adapter',
}), /shipment_authority/i);

assert.throws(() => assertExternalStatusEvidenceBoundary({
  ...statusEvidence,
  evidence_authority: 'external_adapter',
}), /existing Logistics evidence/i);


const successOutcome = classifyExternalAdapterOutcome({ status: 'COMPLETED' });
assert.equal(successOutcome.outcome_class, 'SUCCESS');
assert.equal(successOutcome.retryable, false);
assert.equal(successOutcome.canonical_state_mutation, false);

const pendingOutcome = classifyExternalAdapterOutcome({ status: 'PENDING' });
assert.equal(pendingOutcome.outcome_class, 'PENDING');
assert.equal(pendingOutcome.retryable, true);
assert.equal(pendingOutcome.resolution_required, true);

const rejectedOutcome = classifyExternalAdapterOutcome({ status: 'REJECTED' });
assert.equal(rejectedOutcome.outcome_class, 'REJECTED');
assert.equal(rejectedOutcome.retryable, false);

const timeoutOutcome = classifyExternalAdapterOutcome({
  status: 'PENDING',
  timeout: true,
  response_received: false,
});
assert.equal(timeoutOutcome.outcome_class, 'AMBIGUOUS');
assert.equal(timeoutOutcome.retryable, true);
assert.equal(timeoutOutcome.canonical_state_mutation, false);
assert.equal(timeoutOutcome.resolution_required, true);

const retryDecision = buildExternalRetryDecision({
  idempotency_key: 'idem-retry-001',
  attempt: 1,
  max_attempts: 3,
  outcome: timeoutOutcome,
});
assert.equal(retryDecision.retry, true);
assert.equal(retryDecision.terminal, false);
assert.equal(retryDecision.canonical_state_mutation, false);
assert.equal(retryDecision.event_store_authority, false);
assert.equal(assertExternalRetryBoundary(retryDecision), true);

const terminalRetryDecision = buildExternalRetryDecision({
  idempotency_key: 'idem-retry-002',
  attempt: 3,
  max_attempts: 3,
  outcome: timeoutOutcome,
});
assert.equal(terminalRetryDecision.retry, false);
assert.equal(terminalRetryDecision.terminal, true);
assert.equal(terminalRetryDecision.resolution_required, true);

assert.throws(() => buildExternalRetryDecision({
  idempotency_key: 'idem-retry-003',
  attempt: 1,
  max_attempts: 3,
  outcome: {
    outcome_class: 'AMBIGUOUS',
    retryable: true,
    resolution_required: true,
  },
}), /canonical/i);

assert.throws(() => assertExternalRetryBoundary({
  ...retryDecision,
  canonical_state_mutation: true,
}), /must not mutate canonical state/i);

assert.throws(() => assertExternalRetryBoundary({
  ...retryDecision,
  event_store_authority: true,
}), /event-store authority/i);

assert.throws(() => assertExternalRetryBoundary({
  ...retryDecision,
  persistence: 'external_retry_store',
}), /existing integration\/core state/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  authorization_authority: 'external_adapter',
}), /server-side auth scope/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  provider_identity_authority: 'external_adapter',
}), /existing integration state/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  direct_domain_mutation: true,
}), /must not directly mutate/i);

assert.throws(() => assertExternalAdapterTrustBoundary({
  ...trustedAdapter,
  persistence: 'external_adapter_registry',
}), /separate persistence authority/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  lifecycle_authority: 'external_adapter',
}), /existing integration configuration authority/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  authorization_authority: 'external_adapter',
}), /server-side auth scope/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  execution_authority: true,
}), /provider execution authority/i);

assert.throws(() => assertExternalIntegrationLifecycleBoundary({
  ...normalizeExternalIntegrationLifecycle({ integration, state: 'ENABLED' }),
  provider_registry_authority: true,
}), /provider registry authority/i);


const matchedHandoff = normalizeExternalCanonicalHandoff({
  reconciliation: matchedReconciliation,
  canonical_target: 'core_fulfillment',
  transition_ref: 'TRANS-001',
  authorization_scope: 'org-1:fulfillment:write',
});
assert.equal(matchedHandoff.action, 'CANONICAL_PROCESSING_ELIGIBLE');
assert.equal(matchedHandoff.canonical_processing_authority, 'existing_canonical_domain_authority');
assert.equal(matchedHandoff.authorization_authority, 'existing_server_side_auth_scope');
assert.equal(matchedHandoff.direct_domain_mutation, false);
assert.equal(matchedHandoff.external_execution_authority, false);
assert.equal(matchedHandoff.financial_completion_authority, 'existing_payment_and_settlement_authority');
assert.equal(assertExternalCanonicalHandoffBoundary(matchedHandoff), true);
const matchedDisposition = buildExternalCanonicalHandoffDisposition({ handoff: matchedHandoff });
assert.equal(matchedDisposition.canonical_processing_allowed, true);
assert.equal(matchedDisposition.canonical_transition_allowed, false);
assert.equal(matchedDisposition.mutation_executor, 'existing_canonical_domain_authority');
assert.equal(matchedDisposition.external_adapter_execution, false);

const blockedHandoff = normalizeExternalCanonicalHandoff({
  reconciliation: conflictingReference,
  canonical_target: 'core_fulfillment',
  transition_ref: 'TRANS-002',
  authorization_scope: 'org-1:fulfillment:write',
});
assert.equal(blockedHandoff.action, 'CANONICAL_TRANSITION_BLOCKED');
assert.equal(buildExternalCanonicalHandoffDisposition({ handoff: blockedHandoff }).canonical_processing_allowed, false);

const observationHandoff = normalizeExternalCanonicalHandoff({
  reconciliation: newObservation,
  canonical_target: 'logistics_evidence',
  transition_ref: 'TRANS-003',
  authorization_scope: 'org-1:logistics:evidence',
});
assert.equal(observationHandoff.action, 'CANONICAL_PROCESSING_ELIGIBLE');

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  direct_domain_mutation: true,
}), /must not execute or directly mutate/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  external_execution_authority: true,
}), /must not execute or directly mutate/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  authorization_authority: 'external_adapter',
}), /server-side auth scope/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  canonical_processing_authority: 'external_adapter',
}), /canonical domain authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  financial_completion_authority: 'external_adapter',
}), /financial completion/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  provider_selection_authority: true,
}), /provider_selection_authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  routing_authority: true,
}), /routing_authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  assignment_authority: true,
}), /assignment_authority/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  duplicate_handoff_store: true,
}), /duplicate handoff store/i);

assert.throws(() => assertExternalCanonicalHandoffBoundary({
  ...matchedHandoff,
  persistence: 'external_handoff_store',
}), /canonical domain persistence/i);

console.log('L21.10 External Evidence Reconciliation Boundary Regression: PASS');
console.log('L21.9 External Evidence Reconciliation Boundary Regression: PASS');


