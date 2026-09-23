// Phase 16.8 — External Integration Gateway.
//
// The gateway is a controlled execution boundary, not a new API gateway
// authority. It validates an external integration request, resolves the
// canonical integration/capability/authority chain, delegates authorization
// to the existing authorization policy, and executes only through a
// dependency-injected existing capability handler.
//
// Flow:
// External Consumer → Integration Gateway → Integration Contract
//   → Capability → Existing Authorization → Existing Authority
//
// Adapter metadata may identify an external provider boundary, but provider
// execution remains outside this module. No persistence, credentials, token
// store, transaction engine, event store, broker, or domain authority lives
// here.

import { AUTHZ } from '../../../backend/lib/authorization.js';
import { getPlatformCapability } from './capability-contract.js';
import {
  getPlatformIntegration,
  resolveIntegrationBoundary,
} from './integration-contract.js';

export const PLATFORM_INTEGRATION_GATEWAY_VERSION = '1.0';

const FORBIDDEN_INPUT_FIELDS = Object.freeze([
  'database', 'store', 'persistence', 'credentials', 'secrets',
  'tokenStore', 'authorizationStore', 'transactionEngine', 'ledger',
  'eventStore', 'broker', 'apiGateway', 'ownsDatabase', 'ownsPersistence',
  'ownsAuthorization', 'ownsTransactionEngine', 'ownsEventStore', 'ownsBroker',
]);

function fail(message, code = 'PLATFORM_GATEWAY_INVALID') {
  const error = new Error(`Invalid platform integration gateway request: ${message}`);
  error.code = code;
  throw error;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) fail(`${field} must be a non-empty string`);
  return value.trim();
}

function normalized(value, field) {
  return text(value, field).toLowerCase();
}

function assertSafeObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('request must be an object');
  for (const field of FORBIDDEN_INPUT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      fail(`gateway cannot accept ${field}`);
    }
  }
}

function assertScope(integration, context = {}) {
  const scope = integration.scope;
  if (scope === 'tenant_scoped' && !context.tenantId) {
    fail('tenant-scoped integration requires tenantId', 'PLATFORM_GATEWAY_SCOPE_REQUIRED');
  }
  if (scope === 'country_scoped' && !context.countryCode) {
    fail('country-scoped integration requires countryCode', 'PLATFORM_GATEWAY_SCOPE_REQUIRED');
  }
  if (scope === 'regional_scoped' && !context.regionCode) {
    fail('regional-scoped integration requires regionCode', 'PLATFORM_GATEWAY_SCOPE_REQUIRED');
  }
}

function assertDirection(integration) {
  if (!['inbound', 'bidirectional'].includes(integration.direction)) {
    fail('integration is not executable for inbound gateway traffic', 'PLATFORM_GATEWAY_DIRECTION_DENIED');
  }
}

function assertStatus(integration) {
  if (integration.status !== 'active') {
    fail(`integration ${integration.id} is not active`, 'PLATFORM_GATEWAY_INTEGRATION_INACTIVE');
  }
}

export function validateIntegrationGatewayRequest(input = {}) {
  assertSafeObject(input);
  const integrationId = normalized(input.integrationId, 'integrationId');
  const action = normalized(input.action, 'action');
  const context = input.context == null ? {} : input.context;
  if (!context || typeof context !== 'object' || Array.isArray(context)) fail('context must be an object');
  const payload = input.payload == null ? {} : input.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('payload must be an object');
  return Object.freeze({ integrationId, action, context, payload });
}

export function resolveIntegrationGatewayRequest(input) {
  const request = validateIntegrationGatewayRequest(input);
  const integration = getPlatformIntegration(request.integrationId);
  if (!integration) fail(`unknown integration: ${request.integrationId}`, 'PLATFORM_GATEWAY_INTEGRATION_UNKNOWN');

  assertStatus(integration);
  assertDirection(integration);
  assertScope(integration, request.context);

  if (!integration.operations.map((item) => item.toLowerCase()).includes(request.action)) {
    fail(`operation ${request.action} is not declared by integration ${integration.id}`, 'PLATFORM_GATEWAY_OPERATION_DENIED');
  }

  const boundary = resolveIntegrationBoundary(integration.id);
  const capability = getPlatformCapability(boundary.capability.capability);
  if (!capability.actions.map((item) => item.toLowerCase()).includes(request.action)) {
    fail(`action ${request.action} is not exposed by capability ${capability.capability}`, 'PLATFORM_GATEWAY_CAPABILITY_ACTION_DENIED');
  }

  return Object.freeze({ request, integration: boundary.integration, capability, authority: boundary.authority, adapter: boundary.adapter });
}

export async function executeIntegrationGatewayRequest(input, {
  authorize,
  capabilityHandlers = {},
} = {}) {
  const resolved = resolveIntegrationGatewayRequest(input);
  if (typeof authorize !== 'function') fail('existing authorization function is required', 'PLATFORM_GATEWAY_AUTHORIZATION_REQUIRED');

  const context = resolved.request.context;
  const actor = context.actor;
  const organization = context.organization ?? context.tenantId ?? null;
  const location = context.location ?? null;
  const permission = `${resolved.capability.resource}:${resolved.request.action}`;
  const decision = await authorize(actor, organization, location, resolved.capability.resource, permission);
  if (decision !== AUTHZ.ALLOW) {
    const error = new Error(`Authorization denied for ${permission}`);
    error.code = 'PLATFORM_GATEWAY_AUTHORIZATION_DENIED';
    error.decision = decision;
    throw error;
  }

  const handler = capabilityHandlers[resolved.capability.capability];
  if (typeof handler !== 'function') {
    fail(`no existing capability handler is registered for ${resolved.capability.capability}`, 'PLATFORM_GATEWAY_HANDLER_REQUIRED');
  }

  const result = await handler({
    action: resolved.request.action,
    payload: resolved.request.payload,
    context,
    capability: resolved.capability,
    authority: resolved.authority,
    integration: resolved.integration,
    adapter: resolved.adapter,
  });

  return Object.freeze({
    integrationId: resolved.integration.id,
    capability: resolved.capability.capability,
    authority: resolved.authority.authority,
    action: resolved.request.action,
    result,
    execution: 'authorized_delegate_to_existing_authority',
    persistence: 'none',
  });
}

export function platformIntegrationGatewayContract() {
  return Object.freeze({
    version: PLATFORM_INTEGRATION_GATEWAY_VERSION,
    flow: 'external_consumer_to_integration_gateway_to_canonical_capability_to_existing_authority',
    authorization: 'existing_authorization_injected',
    authentication: 'existing_session_or_external_identity_boundary',
    persistence: 'none',
    credentials: 'never_owned_or_stored',
    transactionAuthority: 'existing_domain_transaction',
    eventStorage: 'existing_outbox_only',
    providerExecution: 'outside_gateway',
    duplicateApiGateway: false,
    duplicateDatabase: false,
    duplicateLedger: false,
    duplicateEventStore: false,
    duplicateBroker: false,
    duplicateDomainAuthority: false,
    failClosed: true,
  });
}

export function assertIntegrationGatewayBoundary() {
  const contract = platformIntegrationGatewayContract();
  if (contract.persistence !== 'none') fail('unexpected persistence authority');
  if (contract.credentials !== 'never_owned_or_stored') fail('unexpected credential ownership');
  if (contract.providerExecution !== 'outside_gateway') fail('provider execution crossed gateway boundary');
  if (contract.duplicateApiGateway || contract.duplicateDatabase || contract.duplicateLedger || contract.duplicateEventStore || contract.duplicateBroker || contract.duplicateDomainAuthority) {
    fail('gateway cannot create duplicate infrastructure');
  }
  return contract;
}
