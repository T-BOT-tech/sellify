// Phase 19.7 — Deterministic Discovery Matching Contract.
// Matching is a pure evaluation layer: it owns neither entities nor source
// truth. Hard constraints determine eligibility before any soft score exists.

export const DISCOVERY_MATCHING_VERSION = '1.0';

export const DISCOVERY_MATCH_WEIGHTS = Object.freeze({
  product: 30,
  capability: 20,
  geographyExact: 15,
  geographyCountry: 10,
  capacityRequested: 10,
  capacityObserved: 5,
  commercial: 10,
  qualificationRequested: 10,
  qualificationObserved: 5,
  relationship: 5,
});

const norm = value => String(value == null ? '' : value).trim().toLowerCase();
const upper = value => String(value == null ? '' : value).trim().toUpperCase();

function bool(value) {
  return value === true || value === 1 || String(value ?? '').toLowerCase() === 'true';
}

function asArray(value) { return Array.isArray(value) ? value : []; }

function productMatches(candidate, context) {
  if (!context.productId) return false;
  const refs = [];
  if (candidate.productReference) refs.push(candidate.productReference.productId, candidate.productReference.id);
  for (const item of asArray(candidate.catalog)) refs.push(item.productId, item.id);
  return refs.some(v => norm(v) === norm(context.productId));
}

function capabilityMatches(candidate, context) {
  if (!context.capabilityCode) return false;
  const code = upper(context.capabilityCode);
  const refs = [];
  if (candidate.capabilityCode) refs.push(candidate.capabilityCode);
  for (const item of asArray(candidate.capabilities)) refs.push(item.code, item.id);
  return refs.some(v => upper(v) === code);
}

function geographyMatches(candidate, context) {
  if (!context.countryCode && !context.geoCode) return { exact: false, country: false, eligible: true };
  const country = upper(context.countryCode);
  const geo = norm(context.geoCode);
  const countries = [candidate.country, candidate.organization?.country, candidate.geography?.countryCode];
  const areas = asArray(candidate.serviceAreas);
  const countryMatch = countries.some(v => country && upper(v) === country) || areas.some(a => country && upper(a.countryCode) === country);
  const exactMatch = areas.some(a => geo && norm(a.geoCode) === geo) || norm(candidate.geography?.geoCode) === geo;
  return { exact: exactMatch, country: countryMatch, eligible: context.geoCode ? exactMatch : countryMatch };
}

function capacityMatches(candidate, context) {
  if (context.minimumQuantity == null) return { requested: false, observed: asArray(candidate.capacitySignals).length > 0, eligible: true };
  const requested = Number(context.minimumQuantity);
  if (!Number.isFinite(requested) || requested <= 0) return { requested: false, observed: false, eligible: false };
  const signals = asArray(candidate.capacitySignals);
  const productId = norm(context.productId);
  const unit = norm(context.unit);
  const relevant = signals.filter(s => {
    if (productId && norm(s.subjectId) !== productId) return false;
    if (unit && norm(s.unit) !== unit) return false;
    return true;
  });
  return { requested: relevant.some(s => Number(s.quantity) >= requested), observed: signals.length > 0, eligible: relevant.some(s => Number(s.quantity) >= requested) };
}

function commercialMatches(candidate, context) {
  const requires = Boolean(context.currency || context.wholesale || context.bulkOrder || context.commercialMode);
  if (!requires) return { match: false, eligible: true };
  const signals = candidate.commercialSignals || {};
  const terms = asArray(candidate.commercialTerms);
  const currencies = [signals.currency, ...terms.flatMap(t => asArray(t.supportedCurrencies))].map(upper).filter(Boolean);
  const currencyMatch = !context.currency || currencies.includes(upper(context.currency));
  const wholesale = bool(signals.wholesaleCapable) || terms.some(t => bool(t.wholesaleCapable));
  const bulk = bool(signals.bulkOrderCapable) || terms.some(t => bool(t.bulkOrderCapable));
  const mode = upper(context.commercialMode);
  const modeMatch = !mode || (mode === 'WHOLESALE' && wholesale) || (mode === 'BULK' && bulk) || (mode === 'B2B' && (wholesale || bulk)) || (mode === 'PROCUREMENT' && (wholesale || bulk));
  const match = currencyMatch && (!context.wholesale || wholesale) && (!context.bulkOrder || bulk) && modeMatch;
  return { match, eligible: match };
}

function qualificationMatches(candidate, context) {
  const qualifications = asArray(candidate.qualifications || candidate.qualificationEvidence);
  const valid = qualifications.filter(q => ['VERIFIED', 'DOCUMENTED'].includes(upper(q.status)) && (!q.validUntil || new Date(q.validUntil).getTime() >= Date.now()));
  if (context.qualificationType) return { requested: valid.some(q => upper(q.qualificationType) === upper(context.qualificationType)), observed: valid.some(q => upper(q.status) === 'VERIFIED'), eligible: valid.some(q => upper(q.qualificationType) === upper(context.qualificationType)) };
  return { requested: false, observed: valid.some(q => upper(q.status) === 'VERIFIED'), eligible: true };
}

export function evaluateDiscoveryMatch(candidate = {}, context = {}) {
  const geography = geographyMatches(candidate, context);
  const capacity = capacityMatches(candidate, context);
  const commercial = commercialMatches(candidate, context);
  const qualification = qualificationMatches(candidate, context);

  const hardConstraints = [
    { dimension: 'PRODUCT', requested: Boolean(context.productId), satisfied: !context.productId || productMatches(candidate, context) },
    { dimension: 'CAPABILITY', requested: Boolean(context.capabilityCode), satisfied: !context.capabilityCode || capabilityMatches(candidate, context) },
    { dimension: 'GEOGRAPHY', requested: Boolean(context.countryCode || context.geoCode), satisfied: geography.eligible },
    { dimension: 'CAPACITY', requested: context.minimumQuantity != null, satisfied: capacity.eligible },
    { dimension: 'COMMERCIAL', requested: Boolean(context.currency || context.wholesale || context.bulkOrder || context.commercialMode), satisfied: commercial.eligible },
    { dimension: 'QUALIFICATION', requested: Boolean(context.qualificationType), satisfied: qualification.eligible },
  ];
  const eligible = hardConstraints.every(c => !c.requested || c.satisfied);

  const factors = [];
  if (productMatches(candidate, context)) factors.push({ dimension: 'PRODUCT', points: DISCOVERY_MATCH_WEIGHTS.product, reason: 'Canonical product match' });
  if (capabilityMatches(candidate, context)) factors.push({ dimension: 'CAPABILITY', points: DISCOVERY_MATCH_WEIGHTS.capability, reason: 'Capability match' });
  if (geography.exact) factors.push({ dimension: 'GEOGRAPHY', points: DISCOVERY_MATCH_WEIGHTS.geographyExact, reason: 'Exact service geography match' });
  else if (geography.country) factors.push({ dimension: 'COUNTRY', points: DISCOVERY_MATCH_WEIGHTS.geographyCountry, reason: 'Country match' });
  if (capacity.requested) factors.push({ dimension: 'CAPACITY', points: DISCOVERY_MATCH_WEIGHTS.capacityRequested, reason: 'Declared capacity meets requested minimum' });
  else if (capacity.observed) factors.push({ dimension: 'CAPACITY', points: DISCOVERY_MATCH_WEIGHTS.capacityObserved, reason: 'Capacity signal available' });
  if (commercial.match) factors.push({ dimension: 'COMMERCIAL', points: DISCOVERY_MATCH_WEIGHTS.commercial, reason: 'Commercial capability match' });
  if (qualification.requested) factors.push({ dimension: 'QUALIFICATION', points: DISCOVERY_MATCH_WEIGHTS.qualificationRequested, reason: 'Requested qualification available' });
  else if (qualification.observed) factors.push({ dimension: 'QUALIFICATION', points: DISCOVERY_MATCH_WEIGHTS.qualificationObserved, reason: 'Verified qualification evidence available' });
  if (bool(candidate.relationshipActive)) factors.push({ dimension: 'RELATIONSHIP', points: DISCOVERY_MATCH_WEIGHTS.relationship, reason: 'Active procurement relationship exists' });

  const matchScore = eligible ? factors.reduce((sum, f) => sum + f.points, 0) : null;
  return Object.freeze({
    version: DISCOVERY_MATCHING_VERSION,
    eligible,
    matchScore,
    factors: Object.freeze(factors.map(Object.freeze)),
    hardConstraints: Object.freeze(hardConstraints.map(Object.freeze)),
    trustScore: null,
    deterministic: true,
    ai: false,
  });
}

export function matchDiscoveryCandidates(candidates = [], context = {}) {
  const evaluated = candidates.map((candidate, index) => ({
    candidate,
    index,
    match: evaluateDiscoveryMatch(candidate, context),
  }));
  return evaluated
    .filter(x => x.match.eligible)
    .sort((a, b) => (b.match.matchScore - a.match.matchScore)
      || norm(a.candidate.organization?.name || a.candidate.organizationName || a.candidate.seller?.name || a.candidate.title).localeCompare(norm(b.candidate.organization?.name || b.candidate.organizationName || b.candidate.seller?.name || b.candidate.title))
      || norm(a.candidate.organizationId || a.candidate.sourceEntityId || a.candidate.productReference?.productId).localeCompare(norm(b.candidate.organizationId || b.candidate.sourceEntityId || b.candidate.productReference?.productId))
      || (a.index - b.index));
}

export function discoveryMatchingContract() {
  return Object.freeze({
    version: DISCOVERY_MATCHING_VERSION,
    authority: 'discovery_matching',
    persistence: 'none',
    eligibilityBeforeRanking: true,
    matchScoreDistinctFromTrustScore: true,
    aiRanking: false,
    transactionExecution: false,
    opportunityPersistence: false,
    weights: { ...DISCOVERY_MATCH_WEIGHTS },
  });
}
