// L7 — Logistics Network Integration Composition.
//
// Composes an external carrier/3PL/courier connection through the existing
// Platform Integration + Adapter authorities. This module owns no integration
// registry, credentials, provider state, routing, shipment ledger, or domain
// transaction.
//
// Flow:
// External Network ↔ Platform Integration → logistics.operations → Adapter →
// existing Logistics/Fulfillment authority.

import {
  definePlatformIntegration,
  registerPlatformIntegration,
} from '../../platform/integration-contract.js';

const TYPES = new Set(['carrier', 'courier', '3pl', '4pl', 'fleet', 'other']);
const DIRECTIONS = new Set(['inbound', 'outbound', 'bidirectional']);

function invalid(message, code = 'LOGISTICS_NETWORK_INTEGRATION_INVALID') {
  const error = new Error(`Invalid logistics network integration: ${message}`);
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
  const result = value.map((item) => normalized(item, `${field} item`));
  if (new Set(result).size !== result.length) invalid(`${field} must not contain duplicates`);
  return Object.freeze(result);
}

export function defineLogisticsNetworkIntegration(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('integration must be an object');

  const providerId = normalized(input.provider_id ?? input.providerId, 'provider_id');
  const providerType = normalized(input.provider_type ?? input.providerType ?? 'other', 'provider_type');
  if (!TYPES.has(providerType)) invalid(`unsupported provider_type: ${providerType}`);

  const adapterId = normalized(input.adapter_id ?? input.adapterId, 'adapter_id');
  const operations = list(input.operations ?? ['pickup', 'delivery', 'tracking'], 'operations');
  const direction = normalized(input.direction ?? 'bidirectional', 'direction');
  if (!DIRECTIONS.has(direction)) invalid(`unsupported direction: ${direction}`);

  const source = text(input.source ?? providerId, 'source');
  const target = text(input.target ?? 'sellify-logistics', 'target');

  const integration = definePlatformIntegration({
    id: input.id ?? `logistics-${providerId}`,
    source,
    target,
    capability: 'logistics.operations',
    version: input.version ?? '1.0',
    direction,
    operations,
    status: input.status ?? 'declared',
    scope: input.scope ?? 'tenant_scoped',
    adapterId,
    persistence: 'none',
    transactionAuthority: 'existing_domain_transaction',
    authorization: 'existing_authorization',
    eventStorage: 'existing_outbox_only',
  });

  return Object.freeze({
    ...integration,
    provider_id: providerId,
    provider_type: providerType,
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    provider_execution: 'adapter_delegated',
    credential_authority: 'external_provider_or_existing_secret_boundary',
    persistence: 'none',
  });
}

export function registerLogisticsNetworkIntegration(input, options = {}) {
  return registerPlatformIntegration(defineLogisticsNetworkIntegration(input), options);
}

export function logisticsNetworkIntegrationContract() {
  return Object.freeze({
    version: '1.0',
    authority: 'existing_platform_integration + logistics.operations',
    adapter_authority: 'app/src/platform/adapter-framework.js',
    capability: 'logistics.operations',
    provider_types: Object.freeze([...TYPES]),
    directions: Object.freeze([...DIRECTIONS]),
    persistence: 'none',
    credentials: 'not_owned',
    routing_authority: 'not_created',
    shipment_ledger: 'not_created',
    provider_registry: 'not_created',
    authorization: 'backend/lib/authorization.js',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    execution: 'adapter_delegated',
    duplicate_domain_authority: false,
  });
}

export function assertLogisticsNetworkIntegrationBoundary(input) {
  const integration = defineLogisticsNetworkIntegration(input);
  return integration.canonical_authority === 'logistics'
    && integration.persistence === 'none'
    && integration.authorization === 'existing_authorization'
    && integration.transactionAuthority === 'existing_domain_transaction';
}
