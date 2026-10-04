// L11.9 — Logistics Scheduling Confirmation Boundary.
//
// Confirmation is a lifecycle commitment over an already scheduled activity.
// It does not authorize execution, reserve capacity, select a provider,
// dispatch a courier, mutate fulfillment, or mutate payment/inventory.
//
// Preconditions:
// - current status must be SCHEDULED
// - a concrete scheduled time window must exist
//
// Confirmation remains scoped by the existing backend authorization and
// transaction authorities.

export const LOGISTICS_SCHEDULING_CONFIRMATION_CONTRACT_VERSION = '1.0';

export function decideLogisticsSchedulingConfirmation({ status, scheduledStart, scheduledEnd } = {}) {
  const current = String(status ?? '').trim().toUpperCase();
  if (current !== 'SCHEDULED') {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_CONFIRMATION_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'NOT_SCHEDULED',
      authorized: false,
      execution: false,
      mutation: false,
    });
  }

  if (!scheduledStart || !scheduledEnd) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_CONFIRMATION_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'SCHEDULED_WINDOW_REQUIRED',
      authorized: false,
      execution: false,
      mutation: false,
    });
  }

  const start = Date.parse(String(scheduledStart));
  const end = Date.parse(String(scheduledEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_CONFIRMATION_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'INVALID_SCHEDULED_WINDOW',
      authorized: false,
      execution: false,
      mutation: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_CONFIRMATION_CONTRACT_VERSION,
    decision: 'CONFIRM',
    reason: 'SCHEDULED',
    authorized: false,
    execution: false,
    mutation: false,
  });
}

export function logisticsSchedulingConfirmationContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_CONFIRMATION_CONTRACT_VERSION,
    scheduled_allows_confirmation: true,
    unscheduled_allows_confirmation: false,
    confirmation_is_authorization: false,
    confirmation_is_execution: false,
    reserves_capacity: false,
    selects_provider: false,
    dispatches: false,
    mutation: false,
  });
}
