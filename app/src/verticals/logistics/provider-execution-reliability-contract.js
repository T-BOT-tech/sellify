// Phase 16.13.9 — provider execution result reliability boundary.
//
// This module evaluates duplicate, stale, out-of-order, and conflicting
// provider callbacks before an existing Logistics/Fulfillment transaction.
// It is deliberately persistence-neutral: the canonical domain transaction
// remains responsible for durable idempotency and state mutation.

const RESULT_STATUSES = new Set([
  'accepted',
  'in_progress',
  'tracking_update',
  'proof',
  'delivered',
  'failed',
  'returned',
]);

const TERMINAL = new Set(['delivered', 'failed', 'returned']);
const TERMINAL_ORDER = new Map([
  ['delivered', 3],
  ['failed', 3],
  ['returned', 3],
]);
const PROGRESS_ORDER = new Map([
  [null, -1],
  ['accepted', 0],
  ['in_progress', 1],
  ['tracking_update', 2],
  ['proof', 2],
  ['delivered', 3],
  ['failed', 3],
  ['returned', 3],
]);

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`Provider execution reliability ${field} must be a non-empty string`);
  return result;
}

function list(value, field) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`Provider execution reliability ${field} must be an array`);
  const result = value.map((item) => text(item, `${field} item`));
  if (new Set(result).size !== result.length) throw new TypeError(`Provider execution reliability ${field} must not contain duplicates`);
  return result;
}

function normalizeStatus(value, field) {
  const status = text(value, field).toLowerCase();
  if (!RESULT_STATUSES.has(status)) throw new TypeError(`Unsupported provider result status: ${status}`);
  return status;
}

function progressOf(status) {
  return PROGRESS_ORDER.get(status ?? null) ?? -1;
}

/**
 * Evaluate a normalized provider result against the canonical state already
 * known by the domain transaction. The caller supplies processed callback IDs
 * from the existing domain/event idempotency mechanism; this module never
 * creates a callback store.
 */
export function evaluateLogisticsProviderExecutionReliability({
  providerId,
  callbackId,
  resultStatus,
  currentStatus = null,
  processedCallbackIds = [],
} = {}) {
  const provider_id = text(providerId, 'provider_id');
  const callback_id = text(callbackId, 'callback_id');
  const result_status = normalizeStatus(resultStatus, 'result_status');
  const current_status = currentStatus == null || String(currentStatus).trim() === ''
    ? null
    : normalizeStatus(currentStatus, 'current_status');
  const processed = list(processedCallbackIds, 'processed_callback_ids');

  if (processed.includes(callback_id)) {
    return Object.freeze({
      disposition: 'DUPLICATE',
      apply: false,
      idempotent: true,
      stale: false,
      conflict: false,
      provider_id,
      callback_id,
      result_status,
      current_status,
      reason: 'callback_id_already_processed',
    });
  }

  if (current_status && TERMINAL.has(current_status)) {
    if (result_status === current_status) {
      return Object.freeze({
        disposition: 'STALE',
        apply: false,
        idempotent: true,
        stale: true,
        conflict: false,
        provider_id,
        callback_id,
        result_status,
        current_status,
        reason: 'new_callback_repeats_terminal_state',
      });
    }
    return Object.freeze({
      disposition: 'CONFLICT',
      apply: false,
      idempotent: false,
      stale: true,
      conflict: true,
      provider_id,
      callback_id,
      result_status,
      current_status,
      reason: 'terminal_state_cannot_be_reopened_by_provider_callback',
    });
  }

  if (current_status && progressOf(result_status) < progressOf(current_status)) {
    return Object.freeze({
      disposition: 'STALE',
      apply: false,
      idempotent: false,
      stale: true,
      conflict: false,
      provider_id,
      callback_id,
      result_status,
      current_status,
      reason: 'callback_is_behind_canonical_execution_state',
    });
  }

  return Object.freeze({
    disposition: 'APPLY',
    apply: true,
    idempotent: false,
    stale: false,
    conflict: false,
    provider_id,
    callback_id,
    result_status,
    current_status,
    reason: 'result_may_enter_existing_domain_transaction',
  });
}

export function projectReliableProviderResult({ result, currentStatus = null, processedCallbackIds = [] } = {}) {
  if (!result || typeof result !== 'object') throw new TypeError('Provider execution result is required');
  const decision = evaluateLogisticsProviderExecutionReliability({
    providerId: result.provider_id,
    callbackId: result.callback_id,
    resultStatus: result.result_status,
    currentStatus,
    processedCallbackIds,
  });

  return Object.freeze({
    ...decision,
    canonical_authority: 'logistics',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    transaction_authority: 'existing_domain_transaction',
    persistence: 'existing_domain_state_and_outbox_only',
    callback_store: false,
    provider_state_authority: false,
  });
}

export function logisticsProviderExecutionReliabilityContract() {
  return Object.freeze({
    duplicate_detection: 'existing domain/event idempotency state supplied to evaluator',
    out_of_order_policy: 'STALE; do not reopen canonical state',
    duplicate_policy: 'DUPLICATE; no second mutation',
    terminal_replay_policy: 'STALE; no second mutation',
    terminal_conflict_policy: 'CONFLICT; reject provider attempt to reopen/change terminal state',
    mutation_authority: 'existing_domain_transaction',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    persistence: 'existing_domain_state_and_outbox_only',
    duplicate_callback_store: false,
    provider_state_authority: false,
    new_retry_engine: false,
  });
}

export const LOGISTICS_PROVIDER_EXECUTION_RELIABILITY_CONTRACT = logisticsProviderExecutionReliabilityContract();
