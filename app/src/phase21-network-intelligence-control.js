// Phase 21.12 — Network Intelligence / Control Projection.
// Derived, read-only network visibility over existing Phase 21 sourcing
// projections and canonical domain signals. This module owns no supplier,
// trust, ranking, inventory, procurement, transaction, event, or ledger authority.

export const PHASE21_NETWORK_INTELLIGENCE_VERSION = '1.0';
export const PHASE21_NETWORK_GAP_STATES = Object.freeze(['COVERED','PARTIAL_GAP','FULL_GAP','UNKNOWN']);

function invalid(message) {
  const error = new TypeError(`Invalid Phase 21 network intelligence projection: ${message}`);
  error.code = 'PHASE21_NETWORK_INTELLIGENCE_INVALID';
  throw error;
}
const text = (value, field) => { const v = String(value ?? '').trim(); if (!v) invalid(`${field} must be a non-empty string`); return v; };
const clone = value => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(clone));
  if (typeof value !== 'object') return value;
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([k,v]) => [k, clone(v)])));
};
function array(value, field) { if (!Array.isArray(value)) invalid(`${field} must be an array`); return value; }
function opportunity(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`sourcingOpportunities[${index}] must be an object`);
  if (value.derived !== true || value.persistence !== 'none' || value.mutation !== false) invalid(`sourcingOpportunities[${index}] must be a non-persistent derived projection`);
  text(value.opportunityId, `sourcingOpportunities[${index}].opportunityId`);
  if (!value.commodityReference?.id || value.commodityReference.authority !== 'agriculture') invalid(`sourcingOpportunities[${index}].commodityReference must remain agriculture authority`);
  if (!value.supplierReference?.id || value.supplierReference.authority !== 'supplier_network') invalid(`sourcingOpportunities[${index}].supplierReference must remain supplier-network authority`);
  return value;
}

function summarize(opportunities) {
  const counts = Object.fromEntries(PHASE21_NETWORK_GAP_STATES.map(s => [s, 0]));
  const suppliers = new Set();
  const commodities = new Set();
  for (const o of opportunities) {
    const state = o.gapState ?? null;
    if (state && Object.hasOwn(counts, state)) counts[state] += 1;
    suppliers.add(o.supplierReference.id);
    commodities.add(o.commodityReference.id);
  }
  return Object.freeze({ opportunityCount: opportunities.length, supplierCount: suppliers.size, commodityCount: commodities.size, gapStateCounts: Object.freeze(counts) });
}

/** Build a read-only network control projection. It exposes coverage/gap and
 * provenance context; it never selects suppliers, ranks them, mutates source
 * authorities, or creates execution actions. */
export function buildNetworkIntelligenceControlProjection({
  sourcingOpportunities = [],
  supplyGaps = [],
  discoveryProjections = [],
  crossBorderProjections = [],
  performanceEvidence = [],
  trustEvidence = [],
  provenance = null,
  projectionId = null,
} = {}) {
  const opportunities = array(sourcingOpportunities, 'sourcingOpportunities').map(opportunity);
  const gaps = array(supplyGaps, 'supplyGaps').map((g, i) => clone(g ?? invalid(`supplyGaps[${i}] must be an object`)));
  const discovery = array(discoveryProjections, 'discoveryProjections').map(clone);
  const crossBorder = array(crossBorderProjections, 'crossBorderProjections').map(clone);
  const performance = array(performanceEvidence, 'performanceEvidence').map(clone);
  const trust = array(trustEvidence, 'trustEvidence').map(clone);
  const id = text(projectionId ?? `network:${opportunities.length}:${gaps.length}`, 'projectionId');
  const summary = summarize(opportunities);

  return Object.freeze({
    version: PHASE21_NETWORK_INTELLIGENCE_VERSION,
    projectionId: id,
    derived: true,
    summary,
    sourcingOpportunities: Object.freeze(opportunities.map(clone)),
    supplyGaps: Object.freeze(gaps),
    discovery: Object.freeze(discovery),
    crossBorder: Object.freeze(crossBorder),
    performanceEvidence: Object.freeze(performance),
    trustEvidence: Object.freeze(trust),
    controls: Object.freeze({
      supplierSelection: false,
      supplierAward: false,
      ranking: false,
      trustScoring: false,
      inventoryMutation: false,
      procurementMutation: false,
      commerceMutation: false,
      paymentMutation: false,
      logisticsExecution: false,
      authorization: false,
      execution: false,
    }),
    persistence: 'none',
    mutation: false,
    provenance: clone(provenance),
    authorities: Object.freeze({
      commodity: 'agriculture',
      supplier: 'supplier_network',
      capability: 'supplier_network',
      capacity: 'supplier_network',
      performance: 'supplier_network',
      trust: 'supplier_network',
      discovery: 'phase19.discovery_fabric',
      crossBorder: 'phase20.cross_border_coordination',
      procurement: 'existing procurement authority',
      inventory: 'existing inventory authority',
      commerce: 'existing commerce authority',
      payment: 'existing payment authority',
      logistics: 'existing logistics/fulfillment authority',
    }),
    principle: 'network intelligence is derived visibility and control projection; owning domains remain authoritative',
  });
}

export function phase21NetworkIntelligenceControlContract() {
  return Object.freeze({
    version: PHASE21_NETWORK_INTELLIGENCE_VERSION,
    role: 'derived_network_visibility_and_control_projection',
    gapStates: [...PHASE21_NETWORK_GAP_STATES],
    persistence: 'none',
    mutation: false,
    createsSupplierAuthority: false,
    createsRankingAuthority: false,
    createsTrustScore: false,
    createsInventoryAuthority: false,
    createsProcurementAuthority: false,
    createsTransactionAuthority: false,
    executesProviders: false,
    principle: 'aggregate and expose canonical signals without becoming an authority',
  });
}
