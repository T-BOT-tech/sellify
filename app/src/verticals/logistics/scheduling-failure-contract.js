// L11.12 — Logistics Scheduling Failure / Exception Boundary.
//
// A scheduling failure records why the scheduling activity could not proceed.
// It is a coordination exception only; it does not assert fulfillment,
// delivery, inventory, payment, settlement, provider, or dispatch failure.

export const LOGISTICS_SCHEDULING_FAILURE_CONTRACT_VERSION = '1.0';

export function decideLogisticsSchedulingFailure({ status, reason } = {}) {
  const current = String(status ?? '').trim().toUpperCase();
  const failureReason = String(reason ?? '').trim();

  if (!['CONFIRMED', 'IN_PROGRESS'].includes(current)) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FAILURE_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'NOT_ACTIVE',
      failure_reason: failureReason || null,
      execution: false,
      fulfillment_failure: false,
      delivery_failure: false,
      mutation: false,
    });
  }

  if (!failureReason) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_FAILURE_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'FAILURE_REASON_REQUIRED',
      failure_reason: null,
      execution: false,
      fulfillment_failure: false,
      delivery_failure: false,
      mutation: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_FAILURE_CONTRACT_VERSION,
    decision: 'FAIL',
    reason: 'ACTIVE_SCHEDULING_EXCEPTION',
    failure_reason: failureReason,
    execution: false,
    fulfillment_failure: false,
    delivery_failure: false,
    mutation: false,
  });
}

export function logisticsSchedulingFailureContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_FAILURE_CONTRACT_VERSION,
    confirmed_allows_failure: true,
    in_progress_allows_failure: true,
    inactive_allows_failure: false,
    failure_reason_required: true,
    failure_is_execution: false,
    failure_is_fulfillment_failure: false,
    failure_is_delivery_failure: false,
    mutates_fulfillment: false,
    mutates_payment: false,
    mutates_inventory: false,
    selects_provider: false,
    dispatches: false,
  });
}
