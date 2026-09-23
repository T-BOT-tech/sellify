// Phase 20.11 — AI Cross-Border Intent Boundary.
// AI translates natural-language cross-border demand into structured intent.
// It never decides feasibility, compliance, authorization, provenance, or execution.
// Discovery-compatible fields are delegated to the existing Phase 19 AI boundary.

import { translateDiscoveryIntent } from '../../backend/lib/discovery/ai-intent-translation.js';

export const CROSS_BORDER_AI_INTENT_VERSION = '1.0';

const ALLOWED_CROSS_BORDER_FIELDS = Object.freeze([
  'originCountryCode', 'origin_country_code', 'originCountry', 'origin_country',
  'destinationCountryCode', 'destination_country_code', 'destinationCountry', 'destination_country',
  'object', 'category', 'productId', 'product_id', 'capabilityCode', 'capability_code',
  'quantity', 'unit', 'minimumQuantity', 'minimum_quantity',
  'currency', 'settlementCurrency', 'settlement_currency', 'displayCurrency', 'display_currency',
  'commercialMode', 'commercial_mode', 'wholesale', 'bulkOrder', 'bulk_order',
  'qualificationType', 'qualification_type', 'availabilityFrom', 'availability_from',
  'availabilityTo', 'availability_to', 'search', 'q', 'seller', 'limit',
]);

const FORBIDDEN_FIELDS = new Set([
  'candidates', 'candidate', 'results', 'rank', 'ranking', 'score', 'matchScore', 'trustScore',
  'trust', 'evidence', 'provenance', 'actions', 'action', 'execute', 'execution', 'transaction',
  'paymentAuthorization', 'authorizationGrant', 'authorize', 'order', 'createOrder', 'inventory',
  'stock', 'ledger', 'database', 'store', 'persistence', 'credentials', 'secrets', 'token',
  'providerCredentials', 'providerId', 'providers', 'complianceDecision', 'legalDecision',
  'feasibility', 'feasibilityResult', 'customsDecision', 'taxDecision', 'rawCommand',
]);

const DISCOVERY_FIELDS = new Set([
  'search', 'q', 'object', 'category', 'productId', 'product_id', 'capabilityCode', 'capability_code',
  'countryCode', 'country', 'geoCode', 'geo_code', 'currency', 'quantity', 'unit',
  'minimumQuantity', 'minimum_quantity', 'commercialMode', 'commercial_mode', 'wholesale',
  'bulkOrder', 'bulk_order', 'qualificationType', 'qualification_type', 'availabilityFrom',
  'availability_from', 'availabilityTo', 'availability_to', 'seller', 'limit',
]);

function invalid(message, code = 'CROSS_BORDER_AI_INTENT_INVALID') {
  throw Object.assign(new Error(`Invalid Cross-Border AI intent: ${message}`), { code, statusCode: 400 });
}

function assertText(value, field, max = 2000) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  if (value.trim().length > max) invalid(`${field} exceeds maximum length`);
  return value.trim();
}

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
}

function scanForbidden(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS.has(key)) invalid(`AI intent cannot contain ${key}`);
    scanForbidden(nested);
  }
}

function validateShape(intent) {
  assertObject(intent, 'intent');
  scanForbidden(intent);
  for (const key of Object.keys(intent)) {
    if (!ALLOWED_CROSS_BORDER_FIELDS.includes(key)) invalid(`unsupported cross-border AI intent field: ${key}`);
  }
  const origin = intent.originCountryCode ?? intent.origin_country_code ?? intent.originCountry ?? intent.origin_country;
  const destination = intent.destinationCountryCode ?? intent.destination_country_code ?? intent.destinationCountry ?? intent.destination_country;
  if (!origin || !destination) invalid('origin and destination country are required');
  if (String(origin).trim().toUpperCase() === String(destination).trim().toUpperCase()) invalid('origin and destination countries must differ');
  return intent;
}

function discoveryProjection(intent) {
  const projected = {};
  for (const [key, value] of Object.entries(intent)) {
    if (DISCOVERY_FIELDS.has(key)) projected[key] = value;
  }
  const origin = intent.originCountryCode ?? intent.origin_country_code ?? intent.originCountry ?? intent.origin_country;
  const destination = intent.destinationCountryCode ?? intent.destination_country_code ?? intent.destinationCountry ?? intent.destination_country;
  // Discovery receives the destination as its canonical country filter only when one
  // exists; the full origin/destination pair remains Phase 20 intent context.
  if (destination && projected.countryCode == null && projected.country == null) projected.countryCode = String(destination).trim().toUpperCase();
  return projected;
}

export async function translateCrossBorderIntent({ text, translator } = {}) {
  const sourceText = assertText(text, 'text');
  if (typeof translator !== 'function') invalid('translator adapter is required');

  const translated = await translator(sourceText);
  const rawIntent = translated && typeof translated === 'object' && translated.intent !== undefined
    ? translated.intent : translated;
  const intent = validateShape(rawIntent);

  // Reuse the existing Phase 19 AI boundary for all discovery-facing fields.
  const discoveryTranslation = await translateDiscoveryIntent({
    text: sourceText,
    translator: async () => discoveryProjection(intent),
  });

  const origin = intent.originCountryCode ?? intent.origin_country_code ?? intent.originCountry ?? intent.origin_country;
  const destination = intent.destinationCountryCode ?? intent.destination_country_code ?? intent.destinationCountry ?? intent.destination_country;

  return Object.freeze({
    version: CROSS_BORDER_AI_INTENT_VERSION,
    source: 'ai_translation',
    sourceText,
    intent: Object.freeze({ ...intent }),
    discoveryIntent: discoveryTranslation.intent,
    originCountryCode: String(origin).trim().toUpperCase(),
    destinationCountryCode: String(destination).trim().toUpperCase(),
    deterministic: false,
    ai: true,
    feasibility: 'none',
    authorization: false,
    execution: false,
    persistence: false,
    ranking: 'none',
    candidateSelection: 'none',
    authority: 'cross_border_ai_intent_boundary',
    nextStage: 'deterministic_cross_border_evaluation',
  });
}

export function crossBorderAiIntentContract() {
  return Object.freeze({
    version: CROSS_BORDER_AI_INTENT_VERSION,
    authority: 'cross_border_ai_intent_boundary',
    input: 'natural_language',
    output: 'structured_cross_border_intent',
    translator: 'injected_adapter',
    discoveryTranslation: 'existing_phase19_ai_boundary',
    candidateGeneration: false,
    ranking: false,
    trustScoring: false,
    provenanceGeneration: false,
    feasibilityDecision: false,
    complianceDecision: false,
    authorization: false,
    execution: false,
    persistence: 'none',
    directDatabaseAccess: false,
    directCredentialsAccess: false,
    flow: 'Natural Language → AI → Structured Cross-Border Intent → Deterministic Phase 20 Evaluation',
    allowedIntentFields: [...ALLOWED_CROSS_BORDER_FIELDS],
    forbiddenFields: [...FORBIDDEN_FIELDS],
  });
}

export const CROSS_BORDER_AI_INTENT_CONTRACT = crossBorderAiIntentContract();
