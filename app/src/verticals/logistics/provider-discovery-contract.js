// Phase 16.13.4 — Logistics Provider Registration / Discovery Boundary.
//
// Provider registration is metadata attached to the existing Platform Adapter
// registry. It does not create a second provider registry, persist provider
// records, store credentials, authorize actors, select a provider, or execute
// Logistics operations.
//
// Flow:
// Provider metadata → existing Platform Adapter registry → capability evidence
// → existing Logistics authority → adapter → external provider.

import { registerPlatformAdapter, listPlatformAdapters, resolveAdapterBoundary } from '../../platform/adapter-framework.js';
import { defineLogisticsProviderAdapter } from './provider-adapter-contract.js';
import { defineLogisticsProviderCapability } from './provider-capability-contract.js';

export const LOGISTICS_PROVIDER_DISCOVERY_CONTRACT_VERSION = '1.0';

const PROVIDER_TYPES = new Set(['carrier', 'courier', '3pl', '4pl', 'fleet', 'other']);
const FORBIDDEN_FIELDS = Object.freeze([
  'credentials', 'credential', 'secret', 'token', 'apiKey', 'password',
  'commercialTerms', 'contract', 'pricing', 'commission', 'settlement',
  'database', 'store', 'persistence', 'ledger', 'ownsDatabase', 'ownsPersistence',
  'ownsAuthorization', 'ownsIdentityStore', 'ownsTransactionEngine', 'ownsEventStore',
]);

function invalid(message, code = 'LOGISTICS_PROVIDER_DISCOVERY_INVALID') {
  const error = new Error(`Invalid logistics provider discovery: ${message}`);
  error.code = code;
  throw error;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}
function normalized(value, field) { return text(value, field).toLowerCase(); }
function list(value, field) {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const result = value.map((item) => normalized(item, `${field} item`));
  if (new Set(result).size !== result.length) invalid(`${field} must not contain duplicates`);
  return Object.freeze(result);
}
function rejectForbidden(input) {
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) invalid(`provider discovery cannot contain ${field}`);
  }
}

export function defineLogisticsProviderRegistration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('registration must be an object');
  rejectForbidden(input);

  const providerId = normalized(input.provider_id, 'provider_id');
  const providerType = normalized(input.provider_type ?? 'other', 'provider_type');
  if (!PROVIDER_TYPES.has(providerType)) invalid(`unsupported provider_type: ${providerType}`);
  const adapterId = normalized(input.adapter_id, 'adapter_id');
  const capabilities = list(input.capabilities ?? [], 'capabilities');
  const geographies = list(input.geographies ?? [], 'geographies');
  const status = normalized(input.status ?? 'declared', 'status');
  if (!['declared', 'active', 'deferred'].includes(status)) invalid('status must be declared, active, or deferred');

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_DISCOVERY_CONTRACT_VERSION,
    provider_id: providerId,
    provider_type: providerType,
    display_name: text(input.display_name ?? providerId, 'display_name'),
    adapter_id: adapterId,
    capabilities,
    geographies,
    status,
    discovery: 'metadata_only',
    persistence: 'none',
    authorization: 'existing_authorization',
    provider_selection: false,
    credential_storage: false,
    commercial_relationship: 'external',
    execution: 'deferred_to_existing_adapter_boundary',
  });
}

export function registerLogisticsProvider(input) {
  const registration = defineLogisticsProviderRegistration(input);
  const adapterDefinition = defineLogisticsProviderAdapter({
    id: registration.adapter_id,
    provider: registration.provider_id,
    provider_type: registration.provider_type,
    provider_contract_version: input.provider_contract_version ?? '1',
    version: input.adapter_version ?? '1',
    operations: registration.capabilities,
    status: registration.status,
  });
  const adapter = registerPlatformAdapter(adapterDefinition);
  return Object.freeze({ registration, adapter });
}

export function discoverRegisteredLogisticsProviders() {
  return Object.freeze(listPlatformAdapters()
    .filter((adapter) => adapter.capability === 'logistics.operations')
    .map((adapter) => Object.freeze({
      provider_id: adapter.provider,
      adapter_id: adapter.id,
      adapter_version: adapter.version,
      capabilities: Object.freeze([...adapter.operations]),
      status: adapter.status,
      authority: 'logistics',
      discovery: 'metadata_only',
      persistence: 'none',
      authorization: 'existing_authorization',
      provider_selection: false,
      execution: 'none',
    })));
}

export function resolveRegisteredLogisticsProvider(adapterId) {
  const id = normalized(adapterId, 'adapter_id');
  const boundary = resolveAdapterBoundary(id);
  if (boundary.capability.capability !== 'logistics.operations') {
    invalid(`adapter ${id} is not registered for Logistics`, 'LOGISTICS_PROVIDER_NOT_LOGISTICS');
  }
  return Object.freeze({
    provider_id: boundary.provider,
    adapter_id: boundary.adapter.id,
    capabilities: Object.freeze([...boundary.adapter.operations]),
    authority: 'logistics',
    discovery: 'metadata_only',
    persistence: 'none',
    authorization: 'existing_authorization',
    provider_selection: false,
    execution: 'deferred',
  });
}

export function verifyLogisticsProviderCapabilityEvidence(input) {
  const evidence = defineLogisticsProviderCapability(input);
  return Object.freeze({
    ...evidence,
    discovery: 'metadata_only',
    verified: evidence.evidence_mode === 'verified' && evidence.status === 'AVAILABLE',
    provider_selection: false,
    execution: false,
  });
}

export function logisticsProviderDiscoveryContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_DISCOVERY_CONTRACT_VERSION,
    registration_authority: 'existing platform adapter registry',
    discovery: 'metadata_only',
    persistence: 'none',
    authorization: 'existing_authorization',
    provider_selection: false,
    credential_storage: false,
    commercial_relationship: 'external',
    execution: 'deferred',
    duplicate_provider_registry: false,
    duplicate_logistics_authority: false,
    duplicate_fulfillment_authority: false,
    capability_evidence_authority: 'app/src/verticals/logistics/provider-capability-contract.js',
    adapter_authority: 'app/src/platform/adapter-framework.js',
  });
}
