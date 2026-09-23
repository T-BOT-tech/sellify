// Phase 16.13.3 — Logistics Provider Adapter Contract.
//
// A Logistics adapter translates the canonical SELLIFY Logistics contract to
// an external provider/network. It never becomes the Logistics, Fulfillment,
// Inventory, Commerce, Payment, authorization, or event authority.
//
// Flow:
// Canonical Logistics capability → Provider Adapter → External Provider
//
// Provider selection, authorization, persistence, credentials, and domain
// transactions remain outside this adapter contract.

import { definePlatformAdapter, resolveAdapterBoundary } from '../../platform/adapter-framework.js';

export const LOGISTICS_PROVIDER_ADAPTER_CONTRACT_VERSION = '1.0';

const OPERATIONS = new Set([
  'pickup',
  'delivery',
  'tracking',
  'proof_of_delivery',
  'returns',
  'route_planning',
  'dispatch',
  'cross_border',
]);

const FORBIDDEN_FIELDS = Object.freeze([
  'credentials', 'secret', 'token', 'apiKey', 'password',
  'ownsDatabase', 'ownsPersistence', 'ownsLedger', 'ownsEventStore',
  'ownsAuthorization', 'ownsIdentityStore', 'ownsTransactionEngine',
]);

function invalid(message, code = 'LOGISTICS_PROVIDER_ADAPTER_INVALID') {
  const error = new Error(`Invalid logistics provider adapter: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function list(value, field) {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const result = value.map((item) => text(item, `${field} item`).toLowerCase());
  if (new Set(result).size !== result.length) invalid(`${field} must not contain duplicates`);
  for (const item of result) if (!OPERATIONS.has(item)) invalid(`${field} contains unsupported operation: ${item}`);
  return Object.freeze(result);
}

export function defineLogisticsProviderAdapter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('adapter must be an object');
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) invalid(`adapter cannot contain ${field}`);
  }

  const base = definePlatformAdapter({
    ...input,
    capability: 'logistics.operations',
    operations: list(input.operations ?? [], 'operations'),
    authorization: input.authorization ?? 'existing_authorization',
    transactionAuthority: input.transactionAuthority ?? 'existing_domain_transaction',
    persistence: input.persistence ?? 'none',
  });

  if (input.capability && input.capability !== 'logistics.operations') {
    invalid('capability must resolve to logistics.operations');
  }

  return Object.freeze({
    ...base,
    contract_version: LOGISTICS_PROVIDER_ADAPTER_CONTRACT_VERSION,
    provider_type: input.provider_type == null ? 'other' : text(input.provider_type, 'provider_type').toLowerCase(),
    provider_contract_version: text(input.provider_contract_version ?? '1', 'provider_contract_version'),
    operations: Object.freeze([...base.operations]),
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    execution: 'translate_and_delegate',
    provider_selection: false,
    credential_authority: 'external_provider_or_existing_secret_boundary',
    persistence: 'none',
    authorization: 'existing_authorization',
    transactionAuthority: 'existing_domain_transaction',
    eventStorage: 'existing_outbox_only',
  });
}

export function resolveLogisticsProviderAdapterBoundary(input) {
  const adapter = typeof input === 'string'
    ? { id: input }
    : input;
  const id = text(adapter?.id, 'adapter.id').toLowerCase();
  const boundary = resolveAdapterBoundary(id);
  if (boundary.capability.capability !== 'logistics.operations') {
    invalid(`adapter ${id} is not a Logistics adapter`, 'LOGISTICS_PROVIDER_ADAPTER_CAPABILITY_MISMATCH');
  }
  return Object.freeze({
    ...boundary,
    adapter: { ...boundary.adapter, operations: [...boundary.adapter.operations] },
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    provider_selection: false,
    execution: 'external_provider_to_existing_logistics_authority',
  });
}

export function logisticsProviderAdapterContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_ADAPTER_CONTRACT_VERSION,
    flow: 'canonical_logistics_capability_to_adapter_to_external_provider',
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    authorization: 'backend/lib/authorization.js',
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    eventStorage: 'existing_outbox_only',
    credential_authority: 'external_provider_or_existing_secret_boundary',
    provider_selection: false,
    duplicate_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    duplicate_payment_authority: false,
  });
}

export function assertLogisticsProviderAdapterBoundary(input) {
  const adapter = defineLogisticsProviderAdapter(input);
  return adapter.canonical_authority === 'logistics'
    && adapter.persistence === 'none'
    && adapter.authorization === 'existing_authorization'
    && adapter.transactionAuthority === 'existing_domain_transaction'
    && adapter.provider_selection === false;
}
