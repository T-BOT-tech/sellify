// Phase 17.1 — Procurement Demand contract.
// Declarative client/platform contract only. Persistence, authorization and
// lifecycle execution remain owned by the existing backend procurement domain.

export const PROCUREMENT_DEMAND_CONTRACT_VERSION = '1.0';

export const PROCUREMENT_DEMAND_STATES = Object.freeze([
  'DRAFT', 'SUBMITTED', 'SOURCING', 'AWARDED', 'EXPIRED', 'CANCELLED',
]);

const TRANSITIONS = Object.freeze({
  DRAFT: Object.freeze(['SUBMITTED', 'CANCELLED']),
  SUBMITTED: Object.freeze(['SOURCING', 'CANCELLED', 'EXPIRED']),
  SOURCING: Object.freeze(['AWARDED', 'CANCELLED', 'EXPIRED']),
  AWARDED: Object.freeze([]),
  EXPIRED: Object.freeze([]),
  CANCELLED: Object.freeze([]),
});

export const PROCUREMENT_DEMAND_EVENTS = Object.freeze([
  'procurement.demand.created',
  'procurement.demand.updated',
  'procurement.demand.submitted',
  'procurement.demand.cancelled',
  'procurement.demand.expired',
  'procurement.demand.sourcing_started',
]);

export const PROCUREMENT_DEMAND_CAPABILITY = Object.freeze({
  capability: 'procurement.demand',
  authority: 'procurement',
  resource: 'procurement_demand',
  actions: Object.freeze(['view', 'create', 'manage', 'submit', 'cancel', 'sourcing']),
  persistence: 'existing backend procurement authority only',
  authorization: 'backend/lib/authorization.js',
});

export function canTransitionProcurementDemand(from, to) {
  return Boolean(TRANSITIONS[String(from || '').toUpperCase()]?.includes(String(to || '').toUpperCase()));
}

export function getProcurementDemandTransitions(state) {
  const key = String(state || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TRANSITIONS, key)) {
    throw new Error(`Unknown procurement demand state: ${state}`);
  }
  return [...TRANSITIONS[key]];
}

export function procurementDemandContract() {
  return Object.freeze({
    version: PROCUREMENT_DEMAND_CONTRACT_VERSION,
    states: [...PROCUREMENT_DEMAND_STATES],
    transitions: Object.fromEntries(Object.entries(TRANSITIONS).map(([k, v]) => [k, [...v]])),
    events: [...PROCUREMENT_DEMAND_EVENTS],
    capability: PROCUREMENT_DEMAND_CAPABILITY,
    execution: 'backend_authority',
    persistence: 'none_in_contract',
    inventoryMutation: false,
    paymentLedgerMutation: false,
    supplierAuthority: false,
    b2bQuoteAuthority: false,
    b2bPurchaseOrderAuthority: false,
  });
}
