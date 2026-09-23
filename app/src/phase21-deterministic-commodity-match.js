// Phase 21.5 — Deterministic Commodity Match.
//
// Pure composition/evaluation over existing Agriculture Commodity,
// Supplier Network capability/capacity, and Phase 21 Demand Requirement
// projections. No source authority is copied, persisted, mutated, ranked,
// authorized, or executed here.
//
// Commodity identity is matched through the canonical Agriculture Commodity
// reference. Product identity remains Product/Catalog authority. Capacity
// evidence is evidence only; it never becomes Inventory truth.

export const PHASE21_COMMODITY_MATCH_CONTRACT_VERSION = '1.0';
export const PHASE21_COMMODITY_MATCH_STATUSES = Object.freeze([
  'MATCH',
  'PARTIAL_MATCH',
  'CONDITIONAL_MATCH',
  'NO_MATCH',
  'UNKNOWN',
]);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 commodity match: ${message}`);
  error.code = 'PHASE21_COMMODITY_MATCH_INVALID';
  throw error;
}

const text = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
};

const optionalText = (value) => {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim() || null;
};

const norm = value => String(value ?? '').trim().toLowerCase();

function ref(value, field, authority, entity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${field} must be an object`);
  }
  const id = text(value.id, `${field}.id`);
  const suppliedAuthority = optionalText(value.authority);
  if (suppliedAuthority && suppliedAuthority !== authority) {
    invalid(`${field}.authority must be ${authority}`);
  }
  return Object.freeze({ authority, entity, id });
}

function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function compareSpec(demand, candidate) {
  if (demand == null) return { requested: false, satisfied: true, reason: null };
  if (candidate == null) return { requested: true, satisfied: false, reason: 'candidate_specification_missing' };
  const satisfied = stable(demand) === stable(candidate);
  return {
    requested: true,
    satisfied,
    reason: satisfied ? 'specification_exact_match' : 'specification_mismatch',
  };
}

function compareQuantityUnit(demand, candidate) {
  const demandUnit = norm(demand?.unit);
  const candidateUnit = norm(candidate?.unit);
  if (!demandUnit || !candidateUnit) {
    return { unitMatch: false, quantitySufficient: false, known: false, reason: 'quantity_or_unit_unknown' };
  }
  const unitMatch = demandUnit === candidateUnit;
  const candidateQuantity = Number(candidate?.quantity);
  const demandQuantity = Number(demand?.quantity);
  const knownQuantity = Number.isFinite(candidateQuantity) && candidateQuantity > 0;
  const knownDemand = Number.isFinite(demandQuantity) && demandQuantity > 0;
  const quantitySufficient = unitMatch && knownQuantity && knownDemand && candidateQuantity >= demandQuantity;
  return {
    unitMatch,
    quantitySufficient,
    known: knownQuantity && knownDemand,
    reason: !unitMatch ? 'unit_mismatch' : quantitySufficient ? 'capacity_meets_quantity' : 'capacity_insufficient_or_unknown',
  };
}

function commodityRef(value, field) {
  return ref(value, field, 'agriculture', 'Commodity');
}

/**
 * Evaluate one demand requirement against one supply candidate.
 *
 * Required commodity identity is an eligibility boundary. Other dimensions
 * can produce PARTIAL/CONDITIONAL results, but never silently authorize a
 * procurement or commerce action.
 */
export function evaluateCommodityMatch({ demand, supply } = {}) {
  if (!demand || typeof demand !== 'object') invalid('demand is required');
  if (!supply || typeof supply !== 'object') invalid('supply is required');

  const demandCommodity = commodityRef(demand.commodityReference ?? demand.commodity, 'demand.commodityReference');
  const supplyCommodity = commodityRef(supply.commodityReference ?? supply.commodity, 'supply.commodityReference');

  const commodityMatch = norm(demandCommodity.id) === norm(supplyCommodity.id);
  const specification = compareSpec(demand.specification, supply.specification);
  const quantity = compareQuantityUnit(demand, supply);

  const capabilityStatus = String(supply.status ?? 'UNKNOWN').trim().toUpperCase();
  const capabilityKnown = ['ACTIVE', 'INACTIVE'].includes(capabilityStatus);
  const capabilityActive = capabilityStatus === 'ACTIVE';

  const evidenceQuality = String(supply.capacityEvidence?.quality ?? supply.capacityQuality ?? 'UNKNOWN').trim().toUpperCase();
  const evidenceKnown = ['SELF_REPORTED', 'OBSERVED', 'VERIFIED'].includes(evidenceQuality);
  const evidenceUsable = evidenceQuality === 'VERIFIED' || evidenceQuality === 'OBSERVED' || evidenceQuality === 'SELF_REPORTED';

  const reasons = [];
  if (!commodityMatch) reasons.push('commodity_mismatch');
  if (commodityMatch) reasons.push('commodity_exact_match');
  if (specification.requested && !specification.satisfied) reasons.push(specification.reason);
  if (specification.satisfied && specification.requested) reasons.push(specification.reason);
  if (!quantity.unitMatch) reasons.push('unit_mismatch');
  if (quantity.quantitySufficient) reasons.push('quantity_sufficient');
  if (quantity.unitMatch && !quantity.quantitySufficient) reasons.push(quantity.reason);
  if (!capabilityKnown) reasons.push('capability_status_unknown');
  else if (!capabilityActive) reasons.push('capability_inactive');
  if (!evidenceKnown) reasons.push('capacity_evidence_unknown');
  else if (!evidenceUsable) reasons.push('capacity_evidence_not_usable');

  let status = 'UNKNOWN';
  if (!commodityMatch) {
    status = 'NO_MATCH';
  } else if (!capabilityKnown || !evidenceKnown || !quantity.known) {
    status = 'UNKNOWN';
  } else if (!capabilityActive || !quantity.unitMatch || !quantity.quantitySufficient) {
    status = 'CONDITIONAL_MATCH';
  } else if (!specification.satisfied) {
    status = 'PARTIAL_MATCH';
  } else {
    status = 'MATCH';
  }

  return Object.freeze({
    version: PHASE21_COMMODITY_MATCH_CONTRACT_VERSION,
    status,
    deterministic: true,
    ai: false,
    commodity: Object.freeze({ demand: demandCommodity, supply: supplyCommodity, match: commodityMatch }),
    specification: Object.freeze(specification),
    quantity: Object.freeze(quantity),
    capability: Object.freeze({ status: capabilityStatus, active: capabilityActive, known: capabilityKnown }),
    capacityEvidence: Object.freeze({ quality: evidenceQuality, known: evidenceKnown, usable: evidenceUsable }),
    reasons: Object.freeze([...new Set(reasons)]),
    persistence: 'none',
    mutation: false,
    authorization: false,
    transactionExecution: false,
    providerExecution: false,
    procurementAuthority: 'existing procurement authority',
    inventoryAuthority: 'existing inventory authority',
    productAuthority: 'existing product/catalog authority',
  });
}

export function phase21DeterministicCommodityMatchContract() {
  return Object.freeze({
    version: PHASE21_COMMODITY_MATCH_CONTRACT_VERSION,
    statuses: [...PHASE21_COMMODITY_MATCH_STATUSES],
    commodityAuthority: 'agriculture',
    capabilityAuthority: 'supplier_network',
    capacityAuthority: 'supplier_network',
    demandAuthority: 'procurement',
    productAuthority: 'existing product/catalog authority',
    inventoryAuthority: 'existing inventory authority',
    persistence: 'none',
    mutation: false,
    authorization: false,
    transactionExecution: false,
    providerExecution: false,
    ranking: false,
    principle: 'deterministic commodity eligibility before sourcing opportunity or execution',
  });
}
