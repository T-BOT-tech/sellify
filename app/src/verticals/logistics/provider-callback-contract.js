// Phase 16.13.18 — inbound Logistics provider callback boundary.
//
// This contract normalizes an already-authenticated provider callback into the
// existing provider execution result boundary. It does not expose HTTP,
// authenticate secrets, persist callbacks, or mutate Logistics/Fulfillment.
// Deployment transport/authentication remains outside this contract.

const VERSION = '1.1';

import { normalizeLogisticsProviderExecutionResult } from './provider-execution-result-contract.js';
const RESULT_STATUSES = new Set([
  'accepted', 'in_progress', 'tracking_update', 'proof',
  'delivered', 'failed', 'returned',
]);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Logistics provider callback ${field} is required`);
  return result;
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Logistics provider callback ${field} must be an object`);
  }
  return value;
}

/**
 * Normalize deployment/provider callback data after the deployment boundary
 * has authenticated the callback. The returned result is still non-mutating;
 * provider execution reliability and canonical application remain separate.
 */
export function normalizeLogisticsProviderCallback({
  providerId,
  callbackId,
  operation,
  resultStatus,
  transactionReference,
  tracking = null,
  proof = null,
  rawMetadata = {},
} = {}) {
  const provider_id = text(providerId, 'provider_id');
  const callback_id = text(callbackId, 'callback_id');
  const operation_value = text(operation, 'operation').toLowerCase();
  const result_status = text(resultStatus, 'result_status').toLowerCase();
  const transaction_reference = text(transactionReference, 'transaction_reference');

  if (!RESULT_STATUSES.has(result_status)) {
    throw new TypeError(`Unsupported Logistics provider callback result status: ${result_status}`);
  }

  if (tracking != null) object(tracking, 'tracking');
  if (proof != null) object(proof, 'proof');
  object(rawMetadata, 'raw_metadata');

  return Object.freeze({
    contract_version: VERSION,
    provider_id,
    callback_id,
    operation: operation_value,
    result_status,
    transaction_reference,
    tracking: tracking == null ? null : Object.freeze({ ...tracking }),
    proof: proof == null ? null : Object.freeze({ ...proof }),
    raw_metadata: Object.freeze({ ...rawMetadata }),
    execution_authority: 'existing_provider_execution_bridge',
    reliability_authority: 'existing_provider_execution_reliability_contract',
    canonical_mutation_authority: 'existing_domain_transaction',
    persistence: 'none',
  });
}

export function toLogisticsProviderExecutionResult(callback) {
  const normalized = normalizeLogisticsProviderCallback(callback);
  return normalizeLogisticsProviderExecutionResult({
    provider_id: normalized.provider_id,
    operation: normalized.operation,
    result_status: normalized.result_status,
    callback_id: normalized.callback_id,
    tracking: normalized.tracking,
    proof: normalized.proof,
    error: normalized.raw_metadata?.error ?? null,
  });
}

export function logisticsProviderCallbackContract() {
  return Object.freeze({
    version: VERSION,
    phase: '16.13.18',
    result_projection: 'app/src/verticals/logistics/provider-execution-result-contract.js',
    purpose: 'normalize authenticated inbound provider callbacks into the existing execution result boundary',
    authentication: 'deployment_supplied_existing_authorization_boundary',
    transport: 'deployment_supplied',
    normalization: 'this_contract',
    reliability: 'app/src/verticals/logistics/provider-execution-reliability-contract.js',
    canonical_application: 'backend/lib/logistics/provider-execution-application.js',
    persistence: 'none',
    callback_store: false,
    credential_storage: false,
    provider_registry: false,
    routing_authority: false,
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    payment_mutation: false,
    settlement_mutation: false,
  });
}

export const LOGISTICS_PROVIDER_CALLBACK_CONTRACT = logisticsProviderCallbackContract();
