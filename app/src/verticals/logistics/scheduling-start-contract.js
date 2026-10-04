// L11.10 — Logistics Scheduling Start Boundary.
//
// Starting a scheduled activity is a scheduling lifecycle transition only.
// It does not authorize fulfillment execution, reserve capacity, select a
// provider, dispatch a courier, or mutate fulfillment/payment/inventory.

export const LOGISTICS_SCHEDULING_START_CONTRACT_VERSION = '1.0';

export function decideLogisticsSchedulingStart({ status, scheduledStart, scheduledEnd, confirmedAt } = {}) {
  const current = String(status ?? '').trim().toUpperCase();
  if (current !== 'CONFIRMED') {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_START_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'NOT_CONFIRMED',
      authorized: false,
      execution: false,
      mutation: false,
    });
  }

  if (!confirmedAt) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_START_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'CONFIRMATION_REQUIRED',
      authorized: false,
      execution: false,
      mutation: false,
    });
  }

  const start = Date.parse(String(scheduledStart));
  const end = Date.parse(String(scheduledEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_START_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'INVALID_SCHEDULED_WINDOW',
      authorized: false,
      execution: false,
      mutation: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_START_CONTRACT_VERSION,
    decision: 'START',
    reason: 'CONFIRMED',
    authorized: false,
    execution: false,
    mutation: false,
  });
}

export function logisticsSchedulingStartContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_START_CONTRACT_VERSION,
    confirmed_allows_start: true,
    unconfirmed_allows_start: false,
    start_is_authorization: false,
    start_is_execution: false,
    reserves_capacity: false,
    selects_provider: false,
    dispatches: false,
    mutates_fulfillment: false,
    mutates_payment: false,
    mutates_inventory: false,
  });
}
