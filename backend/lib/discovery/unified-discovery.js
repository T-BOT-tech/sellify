// Phase 19.10 — Unified Discovery API composition contract.
// Composes existing federated providers into one read-only Discovery Fabric
// response. It owns no product, organization, supplier, inventory, order,
// procurement, payment, or trust truth.
import { getDiscoveryProvider } from './index.js';
import { normalizeDiscoveryMarketContext } from './market-context.js';
import { matchDiscoveryCandidates } from './matching-contract.js';
import { rankDiscoveryMatches } from './explainable-ranking.js';
import { buildDiscoveryOpportunities } from './opportunity-model.js';

export const UNIFIED_DISCOVERY_VERSION = '1.0';
export const DEFAULT_DISCOVERY_PROVIDERS = Object.freeze([
  'commerce.marketplace',
  'commerce.organization',
  'supplier-network',
]);

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(v => String(v || '').trim()).filter(Boolean))];
}

function candidateFromProvider(provider, row) {
  const candidate = provider.normalize(row);
  return {
    ...candidate,
    evidence: provider.evidence(row),
    actions: provider.actions(row),
  };
}

export async function discoverUnified({ intent = {}, providerIds = DEFAULT_DISCOVERY_PROVIDERS } = {}) {
  const context = normalizeDiscoveryMarketContext(intent);
  const providerContext = { ...context };
  if (intent.chatId) providerContext.chatId = String(intent.chatId);
  if (intent.actor) providerContext.actor = intent.actor;
  const selected = unique(providerIds);
  if (!selected.length) throw Object.assign(new Error('At least one discovery provider is required'), { code: 'DISCOVERY_PROVIDER_REQUIRED', statusCode: 400 });

  const providerResults = [];
  const candidates = [];
  for (const providerId of selected) {
    const provider = getDiscoveryProvider(providerId);
    if (!provider) throw Object.assign(new Error(`Unknown discovery provider: ${providerId}`), { code: 'DISCOVERY_PROVIDER_NOT_FOUND', statusCode: 400 });
    const rows = await provider.search(providerContext);
    const normalized = rows.map(row => candidateFromProvider(provider, row));
    providerResults.push({ providerId: provider.providerId, version: provider.version, candidateCount: normalized.length });
    candidates.push(...normalized);
  }

  const evaluated = matchDiscoveryCandidates(candidates, context);
  const ranked = rankDiscoveryMatches(evaluated);
  const opportunities = buildDiscoveryOpportunities(ranked, context);

  const limit = Number.isInteger(Number(context.limit)) && Number(context.limit) > 0 ? Number(context.limit) : 50;
  const limitedRanked = ranked.slice(0, limit);
  const limitedOpportunities = opportunities.slice(0, limit);

  return Object.freeze({
    discoveryVersion: UNIFIED_DISCOVERY_VERSION,
    deterministic: true,
    ai: false,
    persisted: false,
    context,
    providers: Object.freeze(providerResults.map(Object.freeze)),
    candidateCount: candidates.length,
    eligibleCount: ranked.length,
    returnedCount: limitedRanked.length,
    candidates: Object.freeze(limitedRanked.map(item => Object.freeze({
      ...item.candidate,
      match: item.explanation,
    }))),
    opportunities: Object.freeze(limitedOpportunities),
    excludedCandidateCount: candidates.length - ranked.length,
    actionExecution: false,
    owningDomainExecutesActions: true,
  });
}

export function unifiedDiscoveryContract() {
  return Object.freeze({
    version: UNIFIED_DISCOVERY_VERSION,
    authority: 'discovery_fabric',
    federatedProviders: [...DEFAULT_DISCOVERY_PROVIDERS],
    canonicalMarketContext: true,
    deterministicMatching: true,
    explainableRanking: true,
    derivedOpportunities: true,
    persistence: 'none',
    aiRanking: false,
    transactionExecution: false,
    productAuthorityOwnedElsewhere: true,
    organizationAuthorityOwnedElsewhere: true,
    supplierAuthorityOwnedElsewhere: true,
    inventoryMutation: false,
    orderMutation: false,
    procurementMutation: false,
    paymentMutation: false,
    trustScoreOwnedElsewhere: true,
  });
}
