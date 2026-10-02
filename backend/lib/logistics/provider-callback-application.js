// Phase 16.13.19 — server-side inbound provider callback composition.
//
// This consumes an already-authenticated/normalized callback. It reuses the
// existing provider execution reliability evaluator and canonical application.
// It does not create an HTTP route, callback store, provider registry,
// credential store, or alternate fulfillment lifecycle.

import { toLogisticsProviderExecutionResult } from '../../../app/src/verticals/logistics/provider-callback-contract.js';
import { evaluateLogisticsProviderExecutionReliability } from '../../../app/src/verticals/logistics/provider-execution-reliability-contract.js';
import { applyLogisticsProviderCanonicalResult, resolveLogisticsProviderCanonicalApplicationPath } from './provider-execution-application.js';

function invalid(message, code = 'LOGISTICS_PROVIDER_CALLBACK_APPLICATION_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} is required`);
  return value.trim();
}

export async function applyLogisticsProviderCallback({
  callback,
  chatId,
  serverOrderId,
  actor,
  locationId,
  idempotencyKey,
  currentStatus = null,
  processedCallbackIds = [],
} = {}) {
  requiredText(chatId, 'chatId');
  requiredText(serverOrderId, 'serverOrderId');
  requiredText(locationId, 'locationId');
  requiredText(idempotencyKey, 'idempotencyKey');
  if (!actor || typeof actor !== 'object') invalid('actor is required', 'LOGISTICS_PROVIDER_CALLBACK_ACTOR_REQUIRED');

  const normalized = toLogisticsProviderExecutionResult(callback);
  const reliability = evaluateLogisticsProviderExecutionReliability({
    providerId: normalized.provider_id,
    callbackId: normalized.callback_id,
    resultStatus: normalized.result_status,
    currentStatus,
    processedCallbackIds,
  });

  const canonicalResult = ({
    accepted: 'execution_accepted',
    in_progress: 'execution_in_progress',
    tracking_update: 'tracking_update',
    proof: 'proof_captured',
    delivered: 'fulfillment_delivered',
    failed: 'execution_failed',
    returned: 'return_completed',
  })[normalized.result_status];

  const applicationPath = resolveLogisticsProviderCanonicalApplicationPath(canonicalResult);

  if (!reliability.apply) {
    return Object.freeze({
      normalized,
      reliability,
      application_path: applicationPath,
      canonical_application: 'not_applied',
      persistence: 'existing_domain_state_and_outbox_only',
    });
  }

  if (applicationPath !== 'existing_core_fulfillment_transition') {
    return Object.freeze({
      normalized,
      reliability,
      application_path: applicationPath,
      canonical_application: 'not_available_without_existing_domain_authority',
      persistence: 'existing_domain_state_and_outbox_only',
    });
  }

  const result = await applyLogisticsProviderCanonicalResult({
    chatId,
    serverOrderId,
    actor,
    locationId,
    idempotencyKey,
    canonicalResult,
    operation: normalized.operation,
    tracking: normalized.tracking,
    proof: normalized.proof,
  });

  return Object.freeze({
    normalized,
    reliability,
    application_path: applicationPath,
    canonical_application: result,
    persistence: 'existing_domain_state_and_outbox_only',
  });
}

export function logisticsProviderCallbackApplicationContract() {
  return Object.freeze({
    version: '1.0',
    phase: '16.13.19',
    flow: 'authenticated_callback -> existing_result_boundary -> existing_reliability -> existing_canonical_application',
    transport: 'deployment_supplied',
    authentication: 'deployment_supplied_existing_authorization_boundary',
    reliability: 'app/src/verticals/logistics/provider-execution-reliability-contract.js',
    canonical_application: 'backend/lib/logistics/provider-execution-application.js',
    fulfillment_authority: 'backend/lib/store-sqlite.js',
    persistence: 'existing_domain_state_and_outbox_only',
    callback_store: false,
    credential_storage: false,
    provider_registry: false,
    retry_engine: false,
    routing_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    payment_mutation: false,
    settlement_mutation: false,
  });
}
