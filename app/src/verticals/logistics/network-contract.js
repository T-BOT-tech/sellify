// Phase 16.13.1 — Logistics Network Contract.
//
// Establishes the internal/external logistics boundary without creating a
// second logistics authority, provider store, credential store, or network
// ledger. A SELLIFY logistics operation may be fulfilled by an internal actor
// or by an external provider/network actor. Both are projected into the same
// canonical Logistics capability boundary.
//
// Flow:
// Consumer → Canonical Logistics Contract → Actor/Provider Adapter → External
// System (when applicable)
//
// Core Commerce, Inventory, Payments, Locations and Fulfillment remain their
// existing authorities.

export const LOGISTICS_NETWORK_CONTRACT_VERSION = '1.0';

const ACTOR_TYPES = new Set([
  'internal_logistics_user',
  'external_courier',
  'external_carrier',
  'external_3pl',
  'external_4pl',
  'external_fleet',
]);

const PROVIDER_TYPES = new Set([
  'carrier',
  'courier',
  '3pl',
  '4pl',
  'fleet',
  'other',
]);

const SOURCES = new Set(['sellify', 'provider', 'network', 'manual']);

function invalid(message, code = 'LOGISTICS_NETWORK_INVALID') {
  const error = new Error(`Invalid logistics network contract: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function normalized(value, field) {
  return text(value, field).toLowerCase();
}

function list(value, field) {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const result = value.map((item) => text(item, `${field} item`));
  if (new Set(result.map((item) => item.toLowerCase())).size !== result.length) {
    invalid(`${field} must not contain duplicates`);
  }
  return Object.freeze(result);
}

export function normalizeLogisticsActor(actor) {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
    invalid('actor must be an object');
  }
  const id = text(actor.id ?? actor.actor_id, 'actor.id');
  const type = normalized(actor.type ?? actor.actor_type, 'actor.type');
  if (!ACTOR_TYPES.has(type)) invalid(`unsupported actor type: ${type}`);
  const organizationId = actor.organization_id == null ? null : text(actor.organization_id, 'actor.organization_id');
  const providerId = actor.provider_id == null ? null : text(actor.provider_id, 'actor.provider_id');

  if (type === 'internal_logistics_user' && !organizationId) {
    invalid('internal logistics actors require organization_id');
  }
  if (type !== 'internal_logistics_user' && !providerId) {
    invalid('external logistics actors require provider_id');
  }

  return Object.freeze({
    id,
    type,
    organization_id: organizationId,
    provider_id: providerId,
    source: actor.source == null ? 'sellify' : normalized(actor.source, 'actor.source'),
  });
}

export function defineLogisticsProvider(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('provider must be an object');
  }
  const id = text(input.id ?? input.provider_id, 'provider.id');
  const type = normalized(input.type ?? 'other', 'provider.type');
  if (!PROVIDER_TYPES.has(type)) invalid(`unsupported provider type: ${type}`);
  const name = text(input.name ?? id, 'provider.name');
  const capabilities = list(input.capabilities ?? [], 'provider.capabilities');
  const source = normalized(input.source ?? 'provider', 'provider.source');
  if (!SOURCES.has(source)) invalid(`unsupported provider source: ${source}`);

  // Provider identity is metadata at this boundary. It is not a persisted
  // provider registry and must not contain credentials or secrets.
  for (const forbidden of ['credentials', 'secret', 'token', 'apiKey', 'password']) {
    if (Object.prototype.hasOwnProperty.call(input, forbidden)) {
      invalid(`provider contract cannot contain ${forbidden}`);
    }
  }

  return Object.freeze({
    contract_version: LOGISTICS_NETWORK_CONTRACT_VERSION,
    id,
    type,
    name,
    capabilities,
    source,
    persistence: 'none',
    credential_authority: 'external_provider_or_existing_secret_boundary',
    authorization: 'existing_authorization',
    transactionAuthority: 'existing_domain_transaction',
  });
}

export function defineLogisticsAdapter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('adapter must be an object');
  }
  const id = normalized(input.id, 'adapter.id');
  const providerId = text(input.provider_id, 'adapter.provider_id');
  const contractVersion = text(input.provider_contract_version ?? '1', 'adapter.provider_contract_version');
  const operations = list(input.operations ?? [], 'adapter.operations');
  const status = normalized(input.status ?? 'declared', 'adapter.status');
  if (!['declared', 'active', 'deferred'].includes(status)) invalid('adapter.status is invalid');

  if (input.persistence !== undefined && input.persistence !== 'none') {
    invalid('logistics adapters cannot own persistence');
  }
  if (input.authorization !== undefined && input.authorization !== 'existing_authorization') {
    invalid('logistics adapters must use existing authorization');
  }
  if (input.transactionAuthority !== undefined && input.transactionAuthority !== 'existing_domain_transaction') {
    invalid('logistics adapters cannot create a transaction authority');
  }

  return Object.freeze({
    contract_version: LOGISTICS_NETWORK_CONTRACT_VERSION,
    id,
    provider_id: providerId,
    provider_contract_version: contractVersion,
    operations,
    status,
    execution: 'translate_and_delegate',
    persistence: 'none',
    authorization: 'existing_authorization',
    transactionAuthority: 'existing_domain_transaction',
    eventStorage: 'existing_outbox_only',
  });
}

export function normalizeLogisticsNetworkAssignment(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    invalid('assignment must be an object');
  }
  const shipmentId = text(input.shipment_id, 'assignment.shipment_id');
  const providerId = text(input.provider_id, 'assignment.provider_id');
  const actor = normalizeLogisticsActor(input.actor);
  if (actor.provider_id && actor.provider_id !== providerId) {
    invalid('actor provider_id conflicts with assignment provider_id');
  }
  const source = normalized(input.source ?? 'sellify', 'assignment.source');
  if (!SOURCES.has(source)) invalid(`unsupported assignment source: ${source}`);

  return Object.freeze({
    shipment_id: shipmentId,
    provider_id: providerId,
    actor,
    source,
    authority: 'logistics-pack',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    persistence: 'existing_domain_state_only',
    idempotency_key: `logistics-assignment:${shipmentId}:${providerId}:${actor.id}`,
  });
}

export function logisticsNetworkContract() {
  return Object.freeze({
    version: LOGISTICS_NETWORK_CONTRACT_VERSION,
    actor_model: Object.freeze({
      internal: 'internal_logistics_user',
      external: Object.freeze(['external_courier', 'external_carrier', 'external_3pl', 'external_4pl', 'external_fleet']),
    }),
    canonical_authority: 'logistics-pack',
    core_authorities: Object.freeze({
      order: 'commerce',
      inventory: 'inventory',
      payment: 'payments',
      location: 'locations',
      fulfillment: 'app/src/logistics/fulfillment.js',
      audit: 'audit',
    }),
    adapter_flow: 'canonical_logistics_contract_to_adapter_to_external_provider',
    provider_registry: 'not_created',
    credential_store: 'not_created',
    persistence: 'none',
    authorization: 'existing_authorization',
    eventStorage: 'existing_outbox_only',
    duplicate_domain_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    network_execution: 'deferred_until_explicit_provider_capability_and_authorization_policy',
  });
}
