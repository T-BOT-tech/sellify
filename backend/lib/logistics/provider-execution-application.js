// Logistics provider execution -> canonical application boundary.
// This module is server-side only. It does not create a fulfillment authority;
// it translates an already-normalized provider result into the existing
// canonical transaction owned by backend/lib/store-sqlite.js.

import { transitionOrderFulfillment } from '../store-sqlite.js';

const STATUS_TO_FULFILLMENT = Object.freeze({
  fulfillment_delivered: 'delivered',
});

// Provider results are deliberately classified before they can reach a
// canonical mutation. Only a result with an existing, compatible Core
// Fulfillment transition is executable here. The other results may carry
// useful evidence, but this boundary does not invent a tracking/proof/
// exception/return mutation path that the canonical domains do not expose.
const PROVIDER_RESULT_APPLICATION_PATHS = Object.freeze({
  fulfillment_delivered: 'existing_core_fulfillment_transition',
  execution_accepted: 'evidence_only_external_execution_state',
  execution_in_progress: 'evidence_only_external_execution_state',
  tracking_update: 'requires_existing_tracking_mutation_authority',
  proof_captured: 'requires_existing_proof_mutation_authority',
  execution_failed: 'requires_existing_delivery_exception_authority',
  return_completed: 'requires_existing_return_authority',
});

function invalid(message, code = 'LOGISTICS_PROVIDER_CANONICAL_APPLICATION_INVALID') {
  const error = new Error(message);
  error.code = code;
  throw error;
}

export async function applyLogisticsProviderCanonicalResult({
  chatId,
  serverOrderId,
  actor = null,
  locationId = null,
  idempotencyKey,
  canonicalResult,
  operation,
  tracking = null,
  proof = null,
} = {}) {
  if (!chatId) invalid('chatId is required');
  if (!serverOrderId) invalid('serverOrderId is required');
  if (!idempotencyKey) invalid('idempotencyKey is required', 'IDEMPOTENCY_KEY_REQUIRED');
  if (!canonicalResult) invalid('canonicalResult is required');
  if (!STATUS_TO_FULFILLMENT[canonicalResult]) {
    invalid(
      `Provider canonical result ${canonicalResult} is not an executable Core Fulfillment transition`,
      'LOGISTICS_PROVIDER_CANONICAL_RESULT_UNSUPPORTED',
    );
  }
  if (operation !== 'delivery') {
    invalid(
      `Provider operation ${operation || '(missing)'} cannot apply ${canonicalResult} to Core Fulfillment`,
      'LOGISTICS_PROVIDER_OPERATION_UNSUPPORTED',
    );
  }

  const fulfillment = await transitionOrderFulfillment(
    chatId,
    serverOrderId,
    STATUS_TO_FULFILLMENT[canonicalResult],
    actor,
    {
      locationId,
      idempotencyKey,
      trackingReference: tracking?.tracking_reference || tracking?.trackingReference || null,
      proof,
    },
  );

  return Object.freeze({
    applied: true,
    canonical_result: canonicalResult,
    fulfillment,
    authority: 'backend/lib/store-sqlite.js',
    mutation_authority: 'existing_domain_transaction',
    inventory_consequence: 'existing_core_fulfillment_inventory_consequence',
    audit: 'existing_audit_authority',
    payment_mutation: false,
    settlement_mutation: false,
  });
}

export function resolveLogisticsProviderCanonicalApplicationPath(canonicalResult) {
  const result = String(canonicalResult || '').trim();
  return PROVIDER_RESULT_APPLICATION_PATHS[result] || 'unsupported_provider_result';
}

export function logisticsProviderCanonicalApplicationContract() {
  return Object.freeze({
    flow: 'provider_result -> existing_domain_transaction -> canonical_fulfillment -> inventory_consequence -> audit',
    fulfillment_authority: 'backend/lib/store-sqlite.js',
    inventory_authority: 'existing_core_fulfillment_inventory_consequence',
    audit_authority: 'existing_audit_authority',
    supported_provider_result: ['fulfillment_delivered'],
    provider_result_application_paths: { ...PROVIDER_RESULT_APPLICATION_PATHS },
    unsupported_provider_results: ['execution_accepted', 'execution_in_progress', 'tracking_update', 'proof_captured', 'execution_failed', 'return_completed'],
    duplicate_fulfillment_authority: false,
    duplicate_inventory_authority: false,
    payment_mutation: false,
    settlement_mutation: false,
  });
}
