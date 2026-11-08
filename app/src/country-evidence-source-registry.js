// Country Intelligence evidence-source registry contract.
// Research metadata only: this registry records provenance and review state; it
// does not determine whether a law applies or whether a country/provider is launch-ready.
export const COUNTRY_EVIDENCE_SOURCE_REGISTRY_VERSION = '1.0';

export const COUNTRY_EVIDENCE_SOURCE_TYPES = Object.freeze([
  'legislation',
  'government_guidance',
  'regulator_guidance',
  'official_statistics',
  'international_standard',
  'provider_documentation',
  'technical_documentation',
  'secondary_reference',
]);

export const COUNTRY_EVIDENCE_SOURCE_STATES = Object.freeze([
  'UNVERIFIED',
  'VERIFIED',
  'STALE',
  'CONFLICTING',
  'REJECTED',
]);

const text = (value, field) => {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
};

const optionalText = value => value == null ? null : String(value).trim() || null;
const freeze = value => Object.freeze(value);

function dateValue(value, field, { optional = true } = {}) {
  if (value == null || value === '') {
    if (optional) return null;
    throw new TypeError(`${field} is required`);
  }
  const normalized = text(value, field);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(normalized)
    || !Number.isFinite(Date.parse(normalized))) {
    throw new TypeError(`${field} must be an ISO date or timestamp`);
  }
  return normalized;
}

function freezeDeep(value) {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freezeDeep));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeDeep(item)])));
}

export function defineCountryEvidenceSource(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('source must be an object');
  }

  const sourceId = text(input.sourceId, 'sourceId').toLowerCase();
  if (!/^[a-z0-9][a-z0-9._:-]*$/.test(sourceId)) {
    throw new TypeError('sourceId must use a stable lowercase identifier');
  }
  const sourceType = text(input.sourceType, 'sourceType').toLowerCase();
  if (!COUNTRY_EVIDENCE_SOURCE_TYPES.includes(sourceType)) {
    throw new TypeError(`unsupported sourceType: ${sourceType}`);
  }
  const state = text(input.state ?? 'UNVERIFIED', 'state').toUpperCase();
  if (!COUNTRY_EVIDENCE_SOURCE_STATES.includes(state)) {
    throw new TypeError(`unsupported source state: ${state}`);
  }

  const url = text(input.url, 'url');
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new TypeError('url must be an absolute URL'); }
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new TypeError('url must use HTTP or HTTPS');
  }

  const verifiedAt = dateValue(input.verifiedAt, 'verifiedAt');
  const verificationBasis = optionalText(input.verificationBasis);
  if (state === 'VERIFIED' && (!verifiedAt || !verificationBasis)) {
    throw new TypeError('VERIFIED sources require verifiedAt and verificationBasis');
  }

  const effectiveFrom = dateValue(input.effectiveFrom, 'effectiveFrom');
  const effectiveUntil = dateValue(input.effectiveUntil, 'effectiveUntil');
  if (effectiveFrom && effectiveUntil && Date.parse(effectiveUntil) < Date.parse(effectiveFrom)) {
    throw new TypeError('effectiveUntil must not precede effectiveFrom');
  }

  return freezeDeep({
    sourceId,
    title: text(input.title, 'title'),
    authority: text(input.authority, 'authority'),
    jurisdiction: text(input.jurisdiction, 'jurisdiction'),
    scope: text(input.scope, 'scope'),
    sourceType,
    url: parsedUrl.href,
    state,
    publishedAt: dateValue(input.publishedAt, 'publishedAt'),
    effectiveFrom,
    effectiveUntil,
    accessedAt: dateValue(input.accessedAt, 'accessedAt'),
    verifiedAt,
    verificationBasis,
    supersedes: input.supersedes == null ? null : text(input.supersedes, 'supersedes').toLowerCase(),
    notes: optionalText(input.notes),
    provenance: freezeDeep(input.provenance ?? {}),
    authorityBoundary: 'research_metadata_only',
    persistent: false,
    legalDecision: false,
    launchReadinessDecision: false,
  });
}

export function createCountryEvidenceSourceRegistry(initialSources = []) {
  if (!Array.isArray(initialSources)) throw new TypeError('initialSources must be an array');
  const sources = new Map();

  function register(input) {
    const source = defineCountryEvidenceSource(input);
    if (sources.has(source.sourceId)) {
      throw Object.assign(new Error(`Country evidence source already registered: ${source.sourceId}`), {
        code: 'COUNTRY_EVIDENCE_SOURCE_EXISTS',
      });
    }
    sources.set(source.sourceId, source);
    return source;
  }

  for (const source of initialSources) register(source);

  return Object.freeze({
    register,
    get(sourceId) {
      return sources.get(text(sourceId, 'sourceId').toLowerCase()) ?? null;
    },
    list({ jurisdiction = null, sourceType = null, state = null } = {}) {
      const normalizedJurisdiction = optionalText(jurisdiction)?.toLowerCase() ?? null;
      const normalizedType = optionalText(sourceType)?.toLowerCase() ?? null;
      const normalizedState = optionalText(state)?.toUpperCase() ?? null;
      return Object.freeze([...sources.values()].filter(source =>
        (!normalizedJurisdiction || source.jurisdiction.toLowerCase() === normalizedJurisdiction)
        && (!normalizedType || source.sourceType === normalizedType)
        && (!normalizedState || source.state === normalizedState)
      ));
    },
    size() { return sources.size; },
    contract: countryEvidenceSourceRegistryContract(),
  });
}

export function countryEvidenceSourceRegistryContract() {
  return freeze({
    version: COUNTRY_EVIDENCE_SOURCE_REGISTRY_VERSION,
    authority: 'country_intelligence_source_provenance',
    persistence: 'none',
    ownsCountryRules: false,
    ownsLegalInterpretation: false,
    ownsTaxDecisions: false,
    ownsPaymentExecution: false,
    ownsProviderCertification: false,
    ownsCommercialReadiness: false,
    verificationRequiresTimestampAndBasis: true,
    sourceClassificationProvesOfficialness: false,
    evidenceFreshnessMustBeEvaluatedSeparately: true,
  });
}
