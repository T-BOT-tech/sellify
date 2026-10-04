// L11.11 — Logistics Scheduling Completion Boundary.
//
// Completing a scheduling activity records a temporal coordination fact only.
// It does not assert fulfillment/delivery completion, proof, inventory movement,
// payment settlement, or any other operational execution outcome.

export const LOGISTICS_SCHEDULING_COMPLETION_CONTRACT_VERSION = '1.0';

export function decideLogisticsSchedulingCompletion({ status } = {}) {
  const current = String(status ?? '').trim().toUpperCase();
  if (current !== 'IN_PROGRESS') {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_COMPLETION_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'NOT_IN_PROGRESS',
      execution: false,
      fulfillment_completion: false,
      delivery_completion: false,
      mutation: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_COMPLETION_CONTRACT_VERSION,
    decision: 'COMPLETE',
    reason: 'IN_PROGRESS',
    execution: false,
    fulfillment_completion: false,
    delivery_completion: false,
    mutation: false,
  });
}

export function logisticsSchedulingCompletionContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_COMPLETION_CONTRACT_VERSION,
    in_progress_allows_completion: true,
    not_in_progress_allows_completion: false,
    completion_is_execution: false,
    completion_is_fulfillment_completion: false,
    completion_is_delivery_completion: false,
    mutates_fulfillment: false,
    mutates_payment: false,
    mutates_inventory: false,
    records_delivery_proof: false,
  });
}
