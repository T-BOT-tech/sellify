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

// Instant-valued evidence must carry an explicit UTC marker or numeric offset.
// Calendar period boundaries are handled separately because they may be date-only.
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
function parseInstant(value) {
  if (typeof value !== 'string') return NaN;
  const match = ISO_INSTANT.exec(value.trim());
  if (!match) return NaN;
  const [, year, month, day, , , , , zone] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (calendar.getUTCFullYear() !== Number(year)
    || calendar.getUTCMonth() !== Number(month) - 1
    || calendar.getUTCDate() !== Number(day)) return NaN;
  if (zone !== 'Z' && Number(zone.slice(1, 3)) === 14 && zone.slice(4) !== '00') return NaN;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

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
  const signals = asArray(candidate.capacitySignals);
  const temporalRequested = context.availabilityFrom != null || context.availabilityTo != null;
  const quantityRequested = context.minimumQuantity != null;
  if (!temporalRequested && !quantityRequested) {
    return { requested: false, observed: signals.length > 0, eligible: true };
  }
  const requested = quantityRequested ? Number(context.minimumQuantity) : null;
  if (quantityRequested && (!Number.isFinite(requested) || requested <= 0)) {
    return { requested: true, observed: signals.length > 0, eligible: false };
  }
  let from = null;
  let to = null;
  if (temporalRequested) {
    from = parseInstant(context.availabilityFrom);
    to = parseInstant(context.availabilityTo);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from > to || (!context.productId && !context.capabilityCode)) {
      return { requested: true, observed: signals.length > 0, eligible: false };
    }
  }
  const productId = norm(context.productId);
  const capabilityCode = upper(context.capabilityCode);
  const capabilityIds = asArray(candidate.capabilities)
    .filter(item => upper(item.code) === capabilityCode)
    .map(item => norm(item.id))
    .filter(Boolean);
  const unit = norm(context.unit);
  const relevant = signals.filter(signal => {
    if (temporalRequested && (productId || capabilityCode)) {
      const productSubjectMatch = productId && upper(signal.subjectType) === 'PRODUCT' && norm(signal.subjectId) === productId;
      const capabilitySubjectMatch = capabilityCode && upper(signal.subjectType) === 'CAPABILITY'
        && (upper(signal.subjectId) === capabilityCode || capabilityIds.includes(norm(signal.subjectId)));
      if (!productSubjectMatch && !capabilitySubjectMatch) return false;
    } else if (!temporalRequested && productId && norm(signal.subjectId) !== productId) {
      return false;
    }
    if (unit && norm(signal.unit) !== unit) return false;
    if (temporalRequested) {
      // Missing or unknown status is not evidence of an active declaration.
      if (upper(signal.status) !== 'ACTIVE') return false;
      // Time-bound eligibility requires evidence with an explicit quality.
      // Unknown, stale, or conflicting declarations remain visible but cannot
      // satisfy a hard availability constraint.
      if (!['SELF_REPORTED', 'OBSERVED', 'VERIFIED'].includes(upper(signal.quality))) return false;
      const evaluatedAt = parseInstant(context.evaluatedAt);
      const observedAt = parseInstant(signal.observedAt);
      const validUntil = parseInstant(signal.validUntil);
      if (!Number.isFinite(evaluatedAt) || !Number.isFinite(observedAt) || !Number.isFinite(validUntil)) return false;
      if (observedAt > evaluatedAt || validUntil < Math.max(evaluatedAt, to)) return false;
      const start = Date.parse(signal.periodStart || '');
      const end = Date.parse(signal.periodEnd || '');
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return false;
      if (start > to || end < from) return false;
      if (!['AVAILABLE', 'LIMITED'].includes(upper(signal.availability))) return false;
    }
    return !quantityRequested || Number(signal.quantity) >= requested;
  });
  return {
    requested: true,
    observed: signals.length > 0,
    eligible: relevant.length > 0,
  };
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
    { dimension: 'CAPACITY', requested: capacity.requested, satisfied: capacity.eligible },
    { dimension: 'COMMERCIAL', requested: Boolean(context.currency || context.wholesale || context.bulkOrder || context.commercialMode), satisfied: commercial.eligible },
    { dimension: 'QUALIFICATION', requested: Boolean(context.qualificationType), satisfied: qualification.eligible },
  ];
  const eligible = hardConstraints.every(c => !c.requested || c.satisfied);

  const factors = [];
  if (productMatches(candidate, context)) factors.push({ dimension: 'PRODUCT', points: DISCOVERY_MATCH_WEIGHTS.product, reason: 'Canonical product match' });
  if (capabilityMatches(candidate, context)) factors.push({ dimension: 'CAPABILITY', points: DISCOVERY_MATCH_WEIGHTS.capability, reason: 'Capability match' });
  if (geography.exact) factors.push({ dimension: 'GEOGRAPHY', points: DISCOVERY_MATCH_WEIGHTS.geographyExact, reason: 'Exact service geography match' });
  else if (geography.country) factors.push({ dimension: 'COUNTRY', points: DISCOVERY_MATCH_WEIGHTS.geographyCountry, reason: 'Country match' });
  if (capacity.requested) factors.push({ dimension: 'CAPACITY', points: DISCOVERY_MATCH_WEIGHTS.capacityRequested, reason: 'Declared capacity satisfies requested quantity and/or fresh availability window' });
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
