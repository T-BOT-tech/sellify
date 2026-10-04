import assert from 'node:assert/strict';

import {
  normalizeExternalNetworkIntegration,
  validateExternalNetworkIntegration,
  assertExternalNetworkBoundary,
  buildExternalNetworkEnvelope,
  normalizeExternalAdapterCapabilities,
  validateExternalAdapterCapabilities,
  assertExternalAdapterCapabilityBoundary,
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

assert.throws(() => buildExternalNetworkEnvelope({
  integration,
  operation: 'CREATE_DELIVERY_REQUEST',
  payload: {},
}), /idempotency_key is required/i);

console.log('L21.1 External Network Expansion Canonical Boundary Regression: PASS');

  integration,
  operation: 'CREATE_DELIVERY_REQUEST',
  payload: {},
}), /idempotency_key is required/i);

console.log('L21.1 External Network Expansion Canonical Boundary Regression: PASS');
