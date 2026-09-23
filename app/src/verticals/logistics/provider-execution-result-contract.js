// Phase 16.13.8 — Logistics provider execution result / callback boundary.
// External provider results are normalized here before reaching existing
// Logistics/Fulfillment authority. This module does not mutate orders,
// publish events, persist callbacks, or become a provider execution store.

const RESULT_STATUSES = new Set([
  'accepted',
  'in_progress',
  'tracking_update',
  'proof',
  'delivered',
  'failed',
  'returned',
]);

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

const TERMINAL = new Set(['delivered', 'failed', 'returned']);

function text(value, field, required = true) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new TypeError(`Provider execution result ${field} must be a non-empty string`);
  return result || null;
}

function object(value, field, required = false) {
  if (value == null && !required) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Provider execution result ${field} must be an object`);
  }
  return value;
}

export function normalizeLogisticsProviderExecutionResult(input = {}) {
  const providerId = text(input.provider_id, 'provider_id');
  const operation = text(input.operation, 'operation').toLowerCase();
  const resultStatus = text(input.result_status, 'result_status').toLowerCase();
  const callbackId = text(input.callback_id, 'callback_id');
  const occurredAt = text(input.occurred_at, 'occurred_at', false);

  if (!OPERATIONS.has(operation)) throw new TypeError(`Unsupported provider operation: ${operation}`);
  if (!RESULT_STATUSES.has(resultStatus)) throw new TypeError(`Unsupported provider result status: ${resultStatus}`);

  const tracking = object(input.tracking, 'tracking');
  const proof = object(input.proof, 'proof');
  const error = object(input.error, 'error');

  if (resultStatus === 'tracking_update' && !tracking) {
    throw new TypeError('Tracking update requires tracking data');
  }
  if (resultStatus === 'proof' && !proof) {
    throw new TypeError('Proof result requires proof data');
  }
  if (resultStatus === 'failed' && !error) {
    throw new TypeError('Failed result requires error data');
  }

  return Object.freeze({
    provider_id: providerId,
    operation,
    result_status: resultStatus,
    callback_id: callbackId,
    occurred_at: occurredAt,
    tracking,
    proof,
    error,
    terminal: TERMINAL.has(resultStatus),
    source: 'external_provider_via_adapter',
    execution_authority: 'existing_domain_transaction',
    mutation_authority: 'existing_logistics_fulfillment_authority',
    persistence: 'existing_domain_state_and_outbox_only',
  });
}

export function projectProviderExecutionResult(result) {
  const normalized = normalizeLogisticsProviderExecutionResult(result);
  const statusMap = Object.freeze({
    accepted: 'execution_accepted',
    in_progress: 'execution_in_progress',
    tracking_update: 'tracking_update',
    proof: 'proof_captured',
    delivered: 'fulfillment_delivered',
    failed: 'execution_failed',
    returned: 'return_completed',
  });

  return Object.freeze({
    provider_id: normalized.provider_id,
    operation: normalized.operation,
    callback_id: normalized.callback_id,
    canonical_result: statusMap[normalized.result_status],
    terminal: normalized.terminal,
    tracking: normalized.tracking,
    proof: normalized.proof,
    error: normalized.error,
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    event_boundary: 'app/src/events/event-boundary.js',
    mutation_required: true,
    external_provider_authority: false,
    persistence: 'existing_domain_state_and_outbox_only',
  });
}

export function isLogisticsProviderExecutionResult(value) {
  return Boolean(value && typeof value === 'object' &&
    typeof value.provider_id === 'string' &&
    OPERATIONS.has(value.operation) &&
    RESULT_STATUSES.has(value.result_status) &&
    typeof value.callback_id === 'string' &&
    value.source === 'external_provider_via_adapter' &&
    value.execution_authority === 'existing_domain_transaction' &&
    value.mutation_authority === 'existing_logistics_fulfillment_authority' &&
    value.persistence === 'existing_domain_state_and_outbox_only');
}

export function logisticsProviderExecutionResultContract() {
  return Object.freeze({
    input: 'provider/adapter callback result',
    flow: 'Provider → Adapter → Result Boundary → Existing Domain Transaction → Canonical State → Existing Outbox/Event Boundary',
    result_statuses: Object.freeze([...RESULT_STATUSES]),
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    event_boundary: 'app/src/events/event-boundary.js',
    callback_persistence: 'none',
    duplicate_event_store: false,
    duplicate_fulfillment_authority: false,
    provider_mutation_authority: false,
    credential_authority: 'external provider/existing secret boundary',
  });
}
