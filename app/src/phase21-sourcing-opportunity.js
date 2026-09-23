// Phase 21.6 — Derived Sourcing Opportunity.
// Pure projection over existing Phase 21 demand/supply/match projections.
// This module owns no supplier, commodity, inventory, procurement, commerce,
// payment, fulfillment, logistics, ledger, event, or provider authority.

export const PHASE21_SOURCING_OPPORTUNITY_CONTRACT_VERSION = '1.0';
export const PHASE21_SOURCING_OPPORTUNITY_STATUSES = Object.freeze([
  'ELIGIBLE',
  'CONDITIONAL',
  'PARTIAL',
  'NOT_ELIGIBLE',
  'UNKNOWN',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 sourcing opportunity: ${message}`);
  error.code = 'PHASE21_SOURCING_OPPORTUNITY_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value) {
  if (value === undefined || value === null || value === '') return null;
  const result = String(value).trim();
  return result || null;
}

function ref(value, field, authority, entity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  const id = text(value.id, `${field}.id`);
  const suppliedAuthority = optionalText(value.authority);
  if (suppliedAuthority && suppliedAuthority !== authority) invalid(`${field}.authority must be ${authority}`);
  return Object.freeze({ authority, entity, id });
}

function clone(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(clone));
  if (typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])));
}

const MATCH_TO_OPPORTUNITY_STATUS = Object.freeze({
  MATCH: 'ELIGIBLE',
  CONDITIONAL_MATCH: 'CONDITIONAL',
  PARTIAL_MATCH: 'PARTIAL',
  NO_MATCH: 'NOT_ELIGIBLE',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Build a derived sourcing opportunity from an already evaluated deterministic
 * commodity match. The returned object is a projection only; it is not a
 * procurement award, order, reservation, or execution instruction.
 */
export function createSourcingOpportunity({
  demand,
  supply,
  match,
  opportunityId,
  origin = null,
  destination = null,
  quantityContext = null,
  commercialContext = null,
  logisticsContext = null,
  crossBorderContext = null,
  evidenceReferences = [],
  provenance = null,
} = {}) {
  if (!demand || typeof demand !== 'object') invalid('demand is required');
  if (!supply || typeof supply !== 'object') invalid('supply is required');
  if (!match || typeof match !== 'object') invalid('match is required');
  const status = MATCH_TO_OPPORTUNITY_STATUS[match.status];
  if (!status) invalid(`unsupported deterministic match status: ${match.status}`);

  const demandReference = ref(demand.demandReference ?? demand.reference, 'demandReference', 'procurement', 'DemandRequirement');
  const supplierReference = ref(supply.supplierReference ?? supply.supplier, 'supplierReference', 'supplier_network', 'Supplier');
  const capabilityReference = ref(supply.capabilityReference ?? supply.capability, 'capabilityReference', 'supplier_network', 'Capability');
  const commodityReference = ref(demand.commodityReference ?? demand.commodity, 'commodityReference', 'agriculture', 'Commodity');
  const matchReference = ref(match.matchReference ?? { id: text(opportunityId ?? `${demandReference.id}:${capabilityReference.id}`,'derivedMatchId') }, 'matchReference', 'phase21', 'CommodityMatch');

  const id = text(opportunityId ?? `${demandReference.id}:${supplierReference.id}:${capabilityReference.id}`, 'opportunityId');
  const references = Array.isArray(evidenceReferences) ? evidenceReferences.map((item, index) => {
    if (!item || typeof item !== 'object') invalid(`evidenceReferences[${index}] must be an object`);
    return clone(item);
  }) : invalid('evidenceReferences must be an array');

  return Object.freeze({
    version: PHASE21_SOURCING_OPPORTUNITY_CONTRACT_VERSION,
    opportunityId: id,
    status,
    derived: true,
    deterministicMatch: true,
    demandReference,
    commodityReference,
    supplierReference,
    capabilityReference,
    matchReference,
    origin: clone(origin),
    destination: clone(destination),
    quantityContext: clone(quantityContext),
    commercialContext: clone(commercialContext),
    logisticsContext: clone(logisticsContext),
    crossBorderContext: clone(crossBorderContext),
    evidenceReferences: Object.freeze(references),
    provenance: clone(provenance),
    persistence: 'none',
    mutation: false,
    ranking: false,
    authorization: false,
    procurementAward: false,
    inventoryReservation: false,
    orderCreation: false,
    paymentExecution: false,
    providerExecution: false,
    procurementAuthority: 'existing procurement authority',
    commerceAuthority: 'existing commerce authority',
    inventoryAuthority: 'existing inventory authority',
    supplierAuthority: 'existing supplier-network authority',
    commodityAuthority: 'agriculture',
    principle: 'derived sourcing opportunity; acquisition remains with the owning domain',
  });
}

export function phase21SourcingOpportunityContract() {
  return Object.freeze({
    version: PHASE21_SOURCING_OPPORTUNITY_CONTRACT_VERSION,
    statuses: [...PHASE21_SOURCING_OPPORTUNITY_STATUSES],
    sourceAuthorities: Object.freeze({
      demand: 'procurement',
      supplier: 'supplier_network',
      capability: 'supplier_network',
      commodity: 'agriculture',
      product: 'existing product/catalog authority',
      inventory: 'existing inventory authority',
      commerce: 'existing commerce authority',
      payment: 'existing payment authority',
      logistics: 'existing logistics/fulfillment authority',
    }),
    persistence: 'none',
    mutation: false,
    ranking: false,
    authorization: false,
    procurementAward: false,
    inventoryReservation: false,
    orderCreation: false,
    paymentExecution: false,
    providerExecution: false,
    principle: 'derive sourcing opportunities from deterministic matches without becoming an acquisition authority',
  });
}
