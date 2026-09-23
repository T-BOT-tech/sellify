// Phase 21.7 — Derived Supply Gap / Alternative Sourcing.
// Pure composition over Phase 21 demand, deterministic matches, capacity evidence,
// and sourcing opportunities. A gap is a sourcing projection, never an Inventory fact.
// Alternative sourcing identifies additional derived opportunities; it does not award,
// reserve, order, pay, dispatch, or execute anything.

export const PHASE21_SUPPLY_GAP_CONTRACT_VERSION = '1.0';
export const PHASE21_SUPPLY_GAP_STATUSES = Object.freeze([
  'COVERED',
  'PARTIAL_GAP',
  'FULL_GAP',
  'UNKNOWN',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 supply gap: ${message}`);
  error.code = 'PHASE21_SUPPLY_GAP_INVALID';
  throw error;
}

function text(value, field) {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
}

function optionalText(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim() || null;
}

function positiveNumber(value, field) {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) invalid(`${field} must be a positive number`);
  return result;
}

function clone(value) {
  if (value === null || value === undefined || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(clone));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])));
}

function ref(value, field, authority, entity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  const id = text(value.id, `${field}.id`);
  const suppliedAuthority = optionalText(value.authority);
  if (suppliedAuthority && suppliedAuthority !== authority) invalid(`${field}.authority must be ${authority}`);
  return Object.freeze({ authority, entity, id });
}

function unitOf(item) {
  return String(item?.unit ?? item?.quantityContext?.unit ?? '').trim().toLowerCase();
}

function quantityOf(item) {
  const value = item?.quantityContext?.quantity ?? item?.quantity;
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : null;
}

function statusOf(item) {
  return String(item?.status ?? '').trim().toUpperCase();
}

function opportunityKey(item) {
  return String(item?.opportunityId ?? `${item?.supplierReference?.id ?? ''}:${item?.capabilityReference?.id ?? ''}`).trim();
}

/**
 * Derive remaining sourcing coverage from existing opportunities.
 * Only MATCH/ELIGIBLE opportunities with known quantities in the same unit
 * count as confirmed coverage. UNKNOWN evidence can never be treated as supply.
 */
export function deriveSupplyGap({ demand, opportunities = [], primaryOpportunityId = null } = {}) {
  if (!demand || typeof demand !== 'object' || Array.isArray(demand)) invalid('demand is required');
  if (!Array.isArray(opportunities)) invalid('opportunities must be an array');

  const demandReference = ref(demand.demandReference ?? demand.reference, 'demandReference', 'procurement', 'DemandRequirement');
  const commodityReference = ref(demand.commodityReference ?? demand.commodity, 'commodityReference', 'agriculture', 'Commodity');
  const requiredQuantity = positiveNumber(demand.quantity, 'demand.quantity');
  const requiredUnit = unitOf(demand);
  if (!requiredUnit) invalid('demand.unit must be a non-empty string');

  const valid = [];
  const unknown = [];
  for (const [index, opportunity] of opportunities.entries()) {
    if (!opportunity || typeof opportunity !== 'object' || Array.isArray(opportunity)) invalid(`opportunities[${index}] must be an object`);
    const commodity = opportunity.commodityReference;
    if (!commodity || commodity.id !== commodityReference.id || commodity.authority !== 'agriculture') continue;
    const status = statusOf(opportunity);
    const quantity = quantityOf(opportunity);
    const unit = unitOf(opportunity);
    if (status === 'ELIGIBLE' && quantity !== null && unit === requiredUnit) {
      valid.push(opportunity);
    } else if (status === 'UNKNOWN' || quantity === null || (unit && unit !== requiredUnit)) {
      unknown.push(opportunity);
    }
  }

  const confirmedQuantity = valid.reduce((sum, item) => sum + quantityOf(item), 0);
  const remainingQuantity = Math.max(0, requiredQuantity - confirmedQuantity);
  let status = 'COVERED';
  if (confirmedQuantity === 0) status = unknown.length > 0 ? 'UNKNOWN' : 'FULL_GAP';
  else if (remainingQuantity > 0) status = unknown.length > 0 ? 'UNKNOWN' : 'PARTIAL_GAP';

  const primary = optionalText(primaryOpportunityId);
  const alternatives = valid
    .filter(item => !primary || opportunityKey(item) !== primary)
    .map(item => Object.freeze({
      opportunityId: opportunityKey(item),
      supplierReference: clone(item.supplierReference),
      capabilityReference: clone(item.capabilityReference),
      origin: clone(item.origin),
      quantity: quantityOf(item),
      unit: requiredUnit,
      status: statusOf(item),
      derived: true,
    }));

  return Object.freeze({
    version: PHASE21_SUPPLY_GAP_CONTRACT_VERSION,
    status,
    derived: true,
    demandReference,
    commodityReference,
    requiredQuantity,
    requiredUnit,
    confirmedQuantity,
    remainingQuantity,
    confirmedOpportunityIds: Object.freeze(valid.map(opportunityKey)),
    unknownOpportunityIds: Object.freeze(unknown.map(opportunityKey)),
    alternativeSourcing: Object.freeze(alternatives),
    primaryOpportunityId: primary,
    persistence: 'none',
    mutation: false,
    inventoryFact: false,
    inventoryReservation: false,
    procurementAward: false,
    orderCreation: false,
    paymentExecution: false,
    providerExecution: false,
    authorization: false,
    procurementAuthority: 'existing procurement authority',
    inventoryAuthority: 'existing inventory authority',
    supplierAuthority: 'existing supplier-network authority',
    principle: 'derived sourcing gap and alternatives; inventory and acquisition remain with owning domains',
  });
}

export function phase21SupplyGapContract() {
  return Object.freeze({
    version: PHASE21_SUPPLY_GAP_CONTRACT_VERSION,
    statuses: [...PHASE21_SUPPLY_GAP_STATUSES],
    demandAuthority: 'existing procurement authority',
    capabilityAuthority: 'existing supplier-network authority',
    capacityAuthority: 'existing supplier-network authority',
    inventoryAuthority: 'existing inventory authority',
    persistence: 'none',
    mutation: false,
    inventoryFact: false,
    inventoryReservation: false,
    procurementAward: false,
    orderCreation: false,
    paymentExecution: false,
    providerExecution: false,
    authorization: false,
    principle: 'derive uncovered sourcing requirements and alternative opportunities without creating transaction authority',
  });
}
