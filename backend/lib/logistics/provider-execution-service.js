// Phase 16.13.14 — server-side Logistics provider execution composition boundary.
//
// This is the server-consumable composition point for the already-existing
// Logistics provider execution bridge. It deliberately does not create an
// HTTP/provider callback route, credential store, transport client, retry
// engine, or fulfillment authority.
//
// Server execution flow:
// authorized handoff -> existing adapter -> external provider delegate ->
// normalized/reliable result -> existing canonical application transaction.
//
// The external provider delegate remains deployment/integration supplied.
// Canonical mutation is always delegated to the existing domain transaction.

import { executeLogisticsProviderExecutionBridge } from '../../../app/src/verticals/logistics/provider-execution-bridge-contract.js';
import { applyLogisticsProviderCanonicalResult } from './provider-execution-application.js';

function invalid(message, code = 'LOGISTICS_PROVIDER_EXECUTION_SERVICE_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} is required`);
  return value.trim();
}

export async function executeLogisticsProviderExecution({
  handoff,
  chatId,
  serverOrderId,
  actor = null,
  locationId = null,
  idempotencyKey,
  currentStatus = null,
  processedCallbackIds = [],
  invokeProvider = null,
  timeoutMs = 30000,
} = {}) {
  requiredText(chatId, 'chatId');
  requiredText(serverOrderId, 'serverOrderId');
  requiredText(idempotencyKey, 'idempotencyKey');

  if (actor == null || typeof actor !== 'object') {
    invalid('actor is required', 'LOGISTICS_PROVIDER_ACTOR_REQUIRED');
  }

  const result = await executeLogisticsProviderExecutionBridge({
    handoff,
    currentStatus,
    processedCallbackIds,
    invokeProvider,
    timeoutMs,
    canonicalApplicationContext: Object.freeze({
      chatId,
      serverOrderId,
      actor,
      locationId,
      idempotencyKey,
    }),
    applyCanonicalResult: async (canonicalResult, bridgeContext) => {
      const context = bridgeContext?.context;
      if (!context) invalid('canonical application context is required');

      return applyLogisticsProviderCanonicalResult({
        chatId: context.chatId,
        serverOrderId: context.serverOrderId,
        actor: context.actor,
        locationId: context.locationId,
        idempotencyKey: context.idempotencyKey,
        canonicalResult: canonicalResult.canonical_result,
        operation: bridgeContext.operation,
        tracking: bridgeContext.provider_result?.tracking || null,
        proof: bridgeContext.provider_result?.proof || null,
      });
    },
  });

  return Object.freeze({
    ...result,
    server_execution: 'sellify_backend_composition_boundary',
    canonical_application_authority: 'backend/lib/store-sqlite.js',
    external_provider_transport: invokeProvider ? 'injected_delegate' : 'platform_adapter_execution_delegate',
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    payment_mutation: false,
    settlement_mutation: false,
  });
}

export function logisticsProviderExecutionServiceContract() {
  return Object.freeze({
    version: '1.0',
    phase: '16.13.14',
    flow: 'authorized_handoff -> existing_adapter -> external_provider_delegate -> reliable_result -> existing_domain_transaction',
    server_boundary: 'backend',
    provider_transport: 'injected_external_provider_or_platform_adapter_delegate',
    canonical_application: 'backend/lib/logistics/provider-execution-application.js',
    fulfillment_authority: 'backend/lib/store-sqlite.js',
    inventory_authority: 'existing_core_fulfillment_inventory_consequence',
    authorization: 'handoff_must_carry_existing_authorization_evidence',
    persistence: 'existing_domain_state_and_outbox_only',
    credential_storage: false,
    provider_registry: false,
    callback_store: false,
    retry_engine: false,
    routing_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    payment_mutation: false,
    settlement_mutation: false,
  });
}
