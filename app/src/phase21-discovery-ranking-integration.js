// Phase 21.8 — Discovery + Ranking Integration Boundary.
// Phase 19 Discovery remains the canonical discovery/matching/ranking authority.
// Phase 21 only supplies derived sourcing signals and never computes a second
// discovery score, rank, trust score, persistence record, or execution action.

export const PHASE21_DISCOVERY_INTEGRATION_VERSION = '1.0';

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 Discovery integration: ${message}`);
  error.code = 'PHASE21_DISCOVERY_INTEGRATION_INVALID';
  throw error;
}

const text = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) invalid(`${field} must be a non-empty string`);
  return result;
};

function clone(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(clone));
  if (typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)])));
}

function ref(value, field, authority, entity) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
  const id = text(value.id, `${field}.id`);
  if (value.authority && value.authority !== authority) invalid(`${field}.authority must be ${authority}`);
  return Object.freeze({ authority, entity, id });
}

/**
 * Convert an already-derived Phase 21 sourcing opportunity into a candidate
 * shape consumable by the existing Phase 19 Discovery evaluator/ranker.
 *
 * This function deliberately requires an externally supplied Discovery match.
 * It never invents a Discovery score or ranking from Phase 21 data.
 */
export function projectSourcingOpportunityForDiscovery({ opportunity, discoveryMatch } = {}) {
  if (!opportunity || typeof opportunity !== 'object') invalid('opportunity is required');
  if (!discoveryMatch || typeof discoveryMatch !== 'object') invalid('discoveryMatch is required');
  if (!opportunity.derived) invalid('opportunity must be derived');
  if (!opportunity.demandReference || opportunity.demandReference.authority !== 'procurement') invalid('demandReference must remain procurement authority');
  if (!opportunity.commodityReference || opportunity.commodityReference.authority !== 'agriculture') invalid('commodityReference must remain agriculture authority');
  if (!opportunity.supplierReference || opportunity.supplierReference.authority !== 'supplier_network') invalid('supplierReference must remain supplier-network authority');
  if (!opportunity.capabilityReference || opportunity.capabilityReference.authority !== 'supplier_network') invalid('capabilityReference must remain supplier-network authority');

  if (typeof discoveryMatch.eligible !== 'boolean') invalid('discoveryMatch.eligible must be boolean');
  if (discoveryMatch.eligible && !Number.isFinite(Number(discoveryMatch.matchScore))) {
    invalid('eligible discoveryMatch must provide the canonical Discovery matchScore');
  }

  const eligible = opportunity.status === 'ELIGIBLE' && discoveryMatch.eligible === true;
  const candidate = Object.freeze({
    source: 'phase21.sourcing-opportunity',
    sourceAuthority: 'phase21',
    sourceEntityId: text(opportunity.opportunityId, 'opportunity.opportunityId'),
    entityType: 'SourcingOpportunity',
    organizationId: opportunity.supplierReference.id,
    organization: Object.freeze({ id: opportunity.supplierReference.id }),
    commodityReference: clone(opportunity.commodityReference),
    supplierReference: clone(opportunity.supplierReference),
    capabilityReference: clone(opportunity.capabilityReference),
    demandReference: clone(opportunity.demandReference),
    productReference: null,
    evidence: clone(opportunity.evidenceReferences || []),
    actions: Object.freeze([]),
  });

  return Object.freeze({
    version: PHASE21_DISCOVERY_INTEGRATION_VERSION,
    candidate,
    discoveryMatch: clone(discoveryMatch),
    eligible,
    phase21Eligibility: opportunity.status,
    discoveryAuthority: 'phase19.discovery_fabric',
    rankingAuthority: 'phase19.discovery_ranking',
    rankingScore: eligible ? Number(discoveryMatch.matchScore) : null,
    rank: null,
    derived: true,
    persistence: 'none',
    mutation: false,
    trustScoreAuthority: 'existing supplier-network/discovery authority',
    rankingCreatedHere: false,
    execution: false,
  });
}

export function phase21DiscoveryRankingIntegrationContract() {
  return Object.freeze({
    version: PHASE21_DISCOVERY_INTEGRATION_VERSION,
    phase21Role: 'sourcing_signal_projection',
    discoveryAuthority: 'phase19.discovery_fabric',
    matchingAuthority: 'phase19.discovery_matching',
    rankingAuthority: 'phase19.discovery_ranking',
    consumesCanonicalDiscoveryMatch: true,
    createsMatchScore: false,
    createsRank: false,
    createsTrustScore: false,
    persistence: 'none',
    mutation: false,
    transactionExecution: false,
    procurementMutation: false,
    inventoryMutation: false,
    paymentExecution: false,
    providerExecution: false,
    principle: 'Phase 21 supplies derived sourcing signals; existing Discovery owns matching and ranking',
  });
}
