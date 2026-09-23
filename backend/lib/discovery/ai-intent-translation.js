// Phase 19.11 — AI Intent Translation Boundary.
// AI is allowed to translate natural-language demand into the existing
// structured Discovery Market Context. It never supplies candidates, scores,
// trust, provenance, actions, authorization, persistence, or execution data.
//
// Flow:
// Natural Language → AI Translator → Structured Intent → Deterministic Discovery
// The translator is an injected adapter; no model/provider is owned here.

import { normalizeDiscoveryMarketContext } from './market-context.js';
import { discoverUnified } from './unified-discovery.js';

export const DISCOVERY_AI_INTENT_VERSION = '1.0';

const ALLOWED_INTENT_FIELDS = Object.freeze([
  'search', 'q', 'object', 'category', 'productId', 'product_id',
  'capabilityCode', 'capability_code', 'countryCode', 'country',
  'geoCode', 'geo_code', 'currency', 'quantity', 'unit',
  'minimumQuantity', 'minimum_quantity', 'commercialMode', 'commercial_mode',
  'wholesale', 'bulkOrder', 'bulk_order', 'qualificationType',
  'qualification_type', 'availabilityFrom', 'availability_from',
  'availabilityTo', 'availability_to', 'seller', 'limit',
]);

const FORBIDDEN_FIELDS = new Set([
  'candidate', 'candidates', 'results', 'rank', 'ranking', 'matchScore',
  'score', 'trustScore', 'trust', 'evidence', 'provenance', 'actions',
  'action', 'execute', 'execution', 'transaction', 'payment', 'order',
  'procurementAward', 'supplierOrganizationId', 'organizationId',
  'inventory', 'stock', 'sql', 'query', 'database', 'store', 'persistence',
  'credentials', 'secrets', 'token', 'authorizationGrant', 'rawCommand',
  'directExecution', 'providerCredentials', 'providers', 'providerId',
]);

function invalid(message) {
  throw Object.assign(new Error(`Invalid Discovery AI intent: ${message}`), {
    code: 'DISCOVERY_AI_INTENT_INVALID',
    statusCode: 400,
  });
}

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`);
}

function assertNaturalLanguage(text) {
  if (typeof text !== 'string' || !text.trim()) invalid('text must be a non-empty string');
  if (text.trim().length > 2000) invalid('text exceeds maximum length');
  return text.trim();
}

function validateAiIntentShape(intent) {
  assertObject(intent, 'intent');
  for (const key of Object.keys(intent)) {
    if (FORBIDDEN_FIELDS.has(key)) invalid(`AI intent cannot contain ${key}`);
    if (!ALLOWED_INTENT_FIELDS.includes(key)) invalid(`unsupported AI intent field: ${key}`);
  }
  return intent;
}

export function validateTranslatedDiscoveryIntent(intent) {
  const shaped = validateAiIntentShape(intent);
  const normalized = normalizeDiscoveryMarketContext(shaped);
  return Object.freeze({ ...normalized });
}

export async function translateDiscoveryIntent({ text, translator } = {}) {
  const sourceText = assertNaturalLanguage(text);
  if (typeof translator !== 'function') invalid('translator adapter is required');

  const translated = await translator(sourceText);
  const rawIntent = translated && typeof translated === 'object' && translated.intent !== undefined
    ? translated.intent
    : translated;
  const intent = validateTranslatedDiscoveryIntent(rawIntent);

  return Object.freeze({
    version: DISCOVERY_AI_INTENT_VERSION,
    source: 'ai_translation',
    sourceText,
    intent,
    deterministic: false,
    ai: true,
    ranking: 'none',
    candidateSelection: 'none',
    authority: 'discovery_ai_intent_boundary',
    execution: false,
    persistence: false,
  });
}

export async function discoverFromNaturalLanguage({ text, translator, providerIds, chatId, actor } = {}) {
  const translation = await translateDiscoveryIntent({ text, translator });
  const intent = { ...translation.intent };
  if (chatId) intent.chatId = String(chatId);
  if (actor) intent.actor = actor;

  const result = await discoverUnified({ intent, providerIds });
  return Object.freeze({
    ...result,
    ai: true,
    deterministic: true,
    aiStage: Object.freeze({
      version: translation.version,
      source: translation.source,
      translated: true,
      ranking: false,
      candidateSelection: false,
      execution: false,
      persistence: false,
    }),
  });
}

export function discoveryAiIntentTranslationContract() {
  return Object.freeze({
    version: DISCOVERY_AI_INTENT_VERSION,
    authority: 'discovery_ai_intent_boundary',
    input: 'natural_language',
    output: 'structured_discovery_intent',
    translator: 'injected_adapter',
    candidateAuthority: 'deterministic_discovery_providers',
    matchingAuthority: 'discovery_matching',
    rankingAuthority: 'discovery_ranking',
    trustAuthority: 'source_domain',
    provenanceAuthority: 'source_domain',
    execution: false,
    persistence: 'none',
    directDatabaseAccess: false,
    directCredentialsAccess: false,
    candidateGeneration: false,
    ranking: false,
    trustScoring: false,
    actionAuthorization: false,
    allowedIntentFields: [...ALLOWED_INTENT_FIELDS],
    forbiddenFields: [...FORBIDDEN_FIELDS],
    flow: 'Natural Language → AI → Structured Intent → Deterministic Discovery',
  });
}
