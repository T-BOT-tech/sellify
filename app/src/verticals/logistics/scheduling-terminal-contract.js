// L11.13 — Logistics Scheduling Terminal-State Boundary.
//
// Terminal scheduling states are coordination facts only. They do not assert
// fulfillment, delivery, inventory, payment, settlement, provider, or dispatch
// outcomes.

export const LOGISTICS_SCHEDULING_TERMINAL_CONTRACT_VERSION = '1.0';

const ORIGINS = Object.freeze({
  CANCELLED: new Set(['REQUESTED', 'SCHEDULED', 'CONFIRMED']),
  MISSED: new Set(['SCHEDULED', 'CONFIRMED']),
  EXPIRED: new Set(['REQUESTED', 'SCHEDULED']),
});

export function decideLogisticsSchedulingTerminal({ status, target, reason } = {}) {
  const current = String(status ?? '').trim().toUpperCase();
  const next = String(target ?? '').trim().toUpperCase();
  const terminalReason = String(reason ?? '').trim();

  if (!Object.prototype.hasOwnProperty.call(ORIGINS, next)) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_TERMINAL_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'UNSUPPORTED_TERMINAL_STATE',
      terminal_reason: terminalReason || null,
      mutation: false,
      operational_failure: false,
    });
  }

  if (!ORIGINS[next].has(current)) {
    return Object.freeze({
      contract_version: LOGISTICS_SCHEDULING_TERMINAL_CONTRACT_VERSION,
      decision: 'BLOCK',
      reason: 'INVALID_TERMINAL_TRANSITION',
      terminal_reason: terminalReason || null,
      mutation: false,
      operational_failure: false,
    });
  }

  return Object.freeze({
    contract_version: LOGISTICS_SCHEDULING_TERMINAL_CONTRACT_VERSION,
    decision: 'TERMINATE',
    reason: next,
    terminal_reason: terminalReason || null,
    mutation: false,
    operational_failure: false,
  });
}

export function logisticsSchedulingTerminalContract() {
  return Object.freeze({
    version: LOGISTICS_SCHEDULING_TERMINAL_CONTRACT_VERSION,
    cancelled_from: [...ORIGINS.CANCELLED],
    missed_from: [...ORIGINS.MISSED],
    expired_from: [...ORIGINS.EXPIRED],
    terminal_states_are_final: true,
    mutates_fulfillment: false,
    mutates_delivery: false,
    mutates_payment: false,
    mutates_inventory: false,
    selects_provider: false,
    dispatches: false,
    asserts_operational_failure: false,
  });
}
