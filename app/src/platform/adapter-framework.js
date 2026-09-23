// Phase 16.3 — Canonical Adapter Framework.
//
// Adapters translate an external/provider contract into an existing Sellify
// capability. They do not own commerce state, persistence, ledgers,
// authorization, transactions, or event storage.
//
// Flow:
// Canonical Capability Contract → Adapter → External Provider
//
// The adapter registry is process-local metadata only. It is not a provider
// registry replacement and must delegate execution to the existing authority.

import { getPlatformCapability } from './capability-contract.js';
import { resolveAuthorityForCapability } from './authority-registry.js';

export const PLATFORM_ADAPTER_CONTRACT_VERSION = '1.0';

const FORBIDDEN_CLAIMS = Object.freeze([
  'ownsDatabase', 'ownsPersistence', 'ownsLedger', 'ownsEventStore',
  'ownsBroker', 'ownsAuthorization', 'ownsIdentityStore',
  'ownsTransactionEngine', 'ownsApiGateway',
]);

const registry = new Map();

function invalid(message) {
  const error = new Error(`Invalid platform adapter: ${message}`);
  error.code = 'PLATFORM_ADAPTER_INVALID';
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}

function normalize(value, field) {
  return text(value, field).toLowerCase();
}

function list(value, field) {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const result = value.map((item) => text(item, `${field} item`));
  if (new Set(result.map((item) => item.toLowerCase())).size !== result.length) {
    invalid(`${field} must not contain duplicates`);
  }
  return result;
}

function assertForbiddenClaims(input) {
  for (const key of FORBIDDEN_CLAIMS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) invalid(`forbidden ownership claim: ${key}`);
  }
}

export function definePlatformAdapter(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('manifest must be an object');
  assertForbiddenClaims(input);

  const id = normalize(input.id, 'id');
  const capability = normalize(input.capability, 'capability');
  const provider = normalize(input.provider, 'provider');
  const version = text(input.version || '1', 'version');
  const operations = list(input.operations || [], 'operations');
  const status = normalize(input.status || 'declared', 'status');
  const authority = resolveAuthorityForCapability(capability);
  getPlatformCapability(capability);

  if (!['declared', 'active', 'deferred'].includes(status)) {
    invalid('status must be declared, active, or deferred');
  }
  if (input.persistence !== undefined && input.persistence !== 'none') {
    invalid('adapters cannot declare persistent storage');
  }
  if (input.transactionAuthority !== undefined && input.transactionAuthority !== 'existing_domain_transaction') {
    invalid('adapters cannot declare a new transaction authority');
  }
  if (input.authorization !== undefined && input.authorization !== 'existing_authorization') {
    invalid('adapters must use existing authorization');
  }

  return Object.freeze({
    contract_version: PLATFORM_ADAPTER_CONTRACT_VERSION,
    id,
    capability,
    provider,
    version,
    operations: Object.freeze(operations),
    status,
    execution: 'translate_and_delegate',
    authority: authority.authority,
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    authorization: 'existing_authorization',
    eventStorage: 'existing_outbox_only',
  });
}

export function registerPlatformAdapter(input, { replace = false } = {}) {
  const adapter = definePlatformAdapter(input);
  if (registry.has(adapter.id) && !replace) {
    const error = new Error(`Platform adapter ${adapter.id} is already registered`);
    error.code = 'PLATFORM_ADAPTER_ALREADY_REGISTERED';
    throw error;
  }
  registry.set(adapter.id, adapter);
  return adapter;
}

export function getPlatformAdapter(adapterId) {
  const id = normalize(adapterId, 'adapter');
  return registry.get(id) || null;
}

export function listPlatformAdapters() {
  return [...registry.values()].map((adapter) => ({ ...adapter, operations: [...adapter.operations] }));
}

export function resolveAdapterBoundary(adapterId) {
  const adapter = getPlatformAdapter(adapterId);
  if (!adapter) {
    const error = new Error(`Unknown platform adapter: ${adapterId}`);
    error.code = 'PLATFORM_ADAPTER_UNKNOWN';
    throw error;
  }
  const capability = getPlatformCapability(adapter.capability);
  const authority = resolveAuthorityForCapability(adapter.capability);
  return Object.freeze({
    adapter: { ...adapter, operations: [...adapter.operations] },
    capability,
    authority,
    provider: adapter.provider,
    persistence: 'none',
    execution: 'external_provider_to_existing_authority',
  });
}

export function platformAdapterContract() {
  return Object.freeze({
    version: PLATFORM_ADAPTER_CONTRACT_VERSION,
    flow: 'canonical_capability_to_adapter_to_external_provider',
    registry: 'process_local_metadata_only',
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    authorization: 'existing_authorization',
    eventStorage: 'existing_outbox_only',
    duplicateAuthority: false,
    duplicatePersistence: false,
    duplicateLedger: false,
    duplicateEventStore: false,
    forbiddenClaims: FORBIDDEN_CLAIMS,
  });
}

export function assertAdapterBoundary(input) {
  const adapter = definePlatformAdapter(input);
  return adapter.persistence === 'none'
    && adapter.transactionAuthority === 'existing_domain_transaction'
    && adapter.authorization === 'existing_authorization';
}
