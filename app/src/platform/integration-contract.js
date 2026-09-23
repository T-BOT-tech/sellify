// Phase 16.4 — Canonical Platform Integration Contracts.
//
// Integrations compose existing capabilities and adapters. They do not become
// a new commerce, persistence, payment, inventory, identity, authorization,
// transaction, invoice, ledger, or event-store authority.
//
// Flow:
// Consumer → Integration Contract → Canonical Capability → Adapter → Provider

import { getPlatformCapability } from './capability-contract.js';
import { resolveAuthorityForCapability } from './authority-registry.js';
import { getPlatformAdapter } from './adapter-framework.js';

export const PLATFORM_INTEGRATION_CONTRACT_VERSION = '1.0';

const FORBIDDEN_CLAIMS = Object.freeze([
  'ownsDatabase', 'ownsPersistence', 'ownsCommerce', 'ownsInventory',
  'ownsPayments', 'ownsIdentity', 'ownsAuthorization', 'ownsCustomerStore',
  'ownsLocationStore', 'ownsFulfillment', 'ownsInvoiceAuthority',
  'ownsLedger', 'ownsEventStore', 'ownsBroker', 'ownsTransactionEngine',
  'ownsApiGateway',
]);

const registry = new Map();

function invalid(message) {
  const error = new Error(`Invalid platform integration: ${message}`);
  error.code = 'PLATFORM_INTEGRATION_INVALID';
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

export function definePlatformIntegration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('manifest must be an object');
  assertForbiddenClaims(input);

  const id = normalize(input.id, 'id');
  const source = normalize(input.source, 'source');
  const target = normalize(input.target, 'target');
  const capability = normalize(input.capability, 'capability');
  const version = text(input.version || '1', 'version');
  const direction = normalize(input.direction || 'inbound', 'direction');
  const operations = list(input.operations || [], 'operations');
  const status = normalize(input.status || 'declared', 'status');
  const scope = normalize(input.scope || 'tenant_scoped', 'scope');
  const adapterId = input.adapterId == null ? null : normalize(input.adapterId, 'adapterId');

  if (!['inbound', 'outbound', 'bidirectional'].includes(direction)) invalid('direction must be inbound, outbound, or bidirectional');
  if (!['declared', 'active', 'deferred'].includes(status)) invalid('status must be declared, active, or deferred');
  if (!['tenant_scoped', 'country_scoped', 'regional_scoped', 'global_scoped'].includes(scope)) invalid('scope is invalid');
  if (input.persistence !== undefined && input.persistence !== 'none') invalid('integrations cannot declare persistent storage');
  if (input.transactionAuthority !== undefined && input.transactionAuthority !== 'existing_domain_transaction') invalid('integrations cannot declare a new transaction authority');
  if (input.authorization !== undefined && input.authorization !== 'existing_authorization') invalid('integrations must use existing authorization');
  if (input.eventStorage !== undefined && input.eventStorage !== 'existing_outbox_only') invalid('integrations must use existing outbox only');

  const capabilityRecord = getPlatformCapability(capability);
  const authority = resolveAuthorityForCapability(capability);

  if (adapterId && !getPlatformAdapter(adapterId)) {
    const error = new Error(`Unknown platform adapter: ${adapterId}`);
    error.code = 'PLATFORM_INTEGRATION_ADAPTER_UNKNOWN';
    throw error;
  }

  return Object.freeze({
    contract_version: PLATFORM_INTEGRATION_CONTRACT_VERSION,
    id,
    source,
    target,
    capability,
    version,
    direction,
    operations: Object.freeze(operations),
    status,
    scope,
    adapterId,
    authority: authority.authority,
    authorityOwner: capabilityRecord.authority,
    execution: 'compose_and_delegate',
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    authorization: 'existing_authorization',
    eventStorage: 'existing_outbox_only',
  });
}

export function registerPlatformIntegration(input, { replace = false } = {}) {
  const integration = definePlatformIntegration(input);
  if (registry.has(integration.id) && !replace) {
    const error = new Error(`Platform integration ${integration.id} is already registered`);
    error.code = 'PLATFORM_INTEGRATION_ALREADY_REGISTERED';
    throw error;
  }
  registry.set(integration.id, integration);
  return integration;
}

export function getPlatformIntegration(integrationId) {
  const id = normalize(integrationId, 'integration');
  return registry.get(id) || null;
}

export function listPlatformIntegrations() {
  return [...registry.values()].map((item) => ({ ...item, operations: [...item.operations] }));
}

export function resolveIntegrationBoundary(integrationId) {
  const integration = getPlatformIntegration(integrationId);
  if (!integration) {
    const error = new Error(`Unknown platform integration: ${integrationId}`);
    error.code = 'PLATFORM_INTEGRATION_UNKNOWN';
    throw error;
  }
  const capability = getPlatformCapability(integration.capability);
  const authority = resolveAuthorityForCapability(integration.capability);
  const adapter = integration.adapterId ? getPlatformAdapter(integration.adapterId) : null;
  return Object.freeze({
    integration: { ...integration, operations: [...integration.operations] },
    capability,
    authority,
    adapter,
    source: integration.source,
    target: integration.target,
    scope: integration.scope,
    persistence: 'none',
    execution: adapter ? 'integration_to_adapter_to_existing_authority' : 'integration_to_existing_authority',
  });
}

export function platformIntegrationContract() {
  return Object.freeze({
    version: PLATFORM_INTEGRATION_CONTRACT_VERSION,
    flow: 'consumer_to_integration_to_capability_to_adapter_to_provider',
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

export function assertIntegrationBoundary(input) {
  const integration = definePlatformIntegration(input);
  return integration.persistence === 'none'
    && integration.transactionAuthority === 'existing_domain_transaction'
    && integration.authorization === 'existing_authorization'
    && integration.eventStorage === 'existing_outbox_only';
}
