// Phase 16.13.6 — Logistics Provider Selection Boundary.
//
// This contract turns verified capability evidence into an explicit provider
// selection decision. It does NOT rank providers, authorize execution, store
// credentials, persist selection state, mutate Fulfillment, or execute calls.
//
// Flow:
// requirement → verified feasibility → candidate set → explicit selection →
// existing authorization → execution handoff → existing domain transaction.

import { evaluateLogisticsProviderCapability } from './provider-capability-contract.js';
import { evaluateLogisticsProviderTrustBoundary } from './provider-verification-contract.js';

export const LOGISTICS_PROVIDER_SELECTION_CONTRACT_VERSION = '1.0';

const FORBIDDEN_FIELDS = Object.freeze([
  'credentials', 'credential', 'secret', 'token', 'apiKey', 'password',
  'authorization', 'authorized', 'authorizationReference',
  'execute', 'executeNow', 'networkCall', 'httpRequest',
  'database', 'store', 'persistence', 'ledger', 'eventStore',
  'shipment', 'route', 'delivery', 'proof', 'return',
  'pricing', 'commission', 'settlement',
  'ownsAuthorization', 'ownsIdentityStore', 'ownsTransactionEngine', 'ownsEventStore',
]);

function invalid(message, code = 'LOGISTICS_PROVIDER_SELECTION_INVALID') {
  const error = new Error(`Invalid logistics provider selection: ${message}`);
  error.code = code;
  throw error;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}
function normalized(value, field) { return text(value, field).toLowerCase(); }
function rejectForbidden(input) {
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) invalid(`selection cannot contain ${field}`);
  }
}

function normalizeRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) invalid('requirements must be an object');
  const capabilities = requirements.capabilities ?? [];
  if (!Array.isArray(capabilities)) invalid('requirements.capabilities must be an array');
  return Object.freeze({ ...requirements, capabilities: [...new Set(capabilities.map((v) => normalized(v, 'capability')))] });
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates)) invalid('candidates must be an array');
  const seen = new Set();
  return candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) invalid(`candidate ${index} must be an object`);
    const providerId = normalized(candidate.provider_id, `candidates[${index}].provider_id`);
    if (seen.has(providerId)) invalid(`duplicate provider_id: ${providerId}`);
    seen.add(providerId);
    if (!candidate.evidence || typeof candidate.evidence !== 'object' || Array.isArray(candidate.evidence)) {
      invalid(`candidate ${index} evidence is required`);
    }
    const evidence = { ...candidate.evidence, provider_id: providerId };
    return Object.freeze({ provider_id: providerId, evidence });
  });
}

export function evaluateLogisticsProviderSelection(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('selection input must be an object');
  rejectForbidden(input);
  const { requirements = {}, candidates = [], selected_provider_id = null } = input;
  const normalizedRequirements = normalizeRequirements(requirements);
  const normalizedCandidates = normalizeCandidates(candidates);
  const evaluated = normalizedCandidates.map(({ provider_id, evidence }) => {
    const capability = evaluateLogisticsProviderCapability(normalizedRequirements, evidence);
    const trust = evaluateLogisticsProviderTrustBoundary(normalizedRequirements, evidence);
    const feasible = capability.result === 'FEASIBLE' && trust.result === 'EVIDENCE_SUFFICIENT';
    return Object.freeze({
      provider_id,
      capability_result: capability.result,
      verification_result: trust.verification_result,
      feasible,
      missing_capabilities: Object.freeze([...capability.missing_capabilities]),
    });
  });

  const feasibleProviderIds = Object.freeze(evaluated.filter((item) => item.feasible).map((item) => item.provider_id));
  const selected = selected_provider_id == null ? null : normalized(selected_provider_id, 'selected_provider_id');
  if (selected && !feasibleProviderIds.includes(selected)) {
    invalid(`selected provider is not a verified feasible candidate: ${selected}`, 'LOGISTICS_PROVIDER_NOT_FEASIBLE');
  }

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_SELECTION_CONTRACT_VERSION,
    required_capabilities: Object.freeze([...normalizedRequirements.capabilities]),
    candidates: Object.freeze(evaluated),
    feasible_provider_ids: feasibleProviderIds,
    selected_provider_id: selected,
    selection: selected ? 'EXPLICIT' : 'NOT_SELECTED',
    authorization_required: true,
    authorization_granted: false,
    execution: false,
    persistence: 'none',
    provider_ranking: false,
    provider_selection_authority: 'explicit_selection_input',
    principle: 'feasibility identifies eligible candidates; explicit selection does not grant authorization or execute logistics',
  });
}

export function defineLogisticsProviderSelection(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('selection must be an object');
  rejectForbidden(input);
  const result = evaluateLogisticsProviderSelection(input);
  if (!result.selected_provider_id) invalid('selected_provider_id is required for an execution-ready selection', 'LOGISTICS_PROVIDER_SELECTION_REQUIRED');
  return Object.freeze({
    contract_version: result.contract_version,
    selected_provider_id: result.selected_provider_id,
    required_capabilities: result.required_capabilities,
    feasible_provider_ids: result.feasible_provider_ids,
    selection: 'EXPLICIT',
    authorization_required: true,
    authorization_granted: false,
    execution: false,
    persistence: 'none',
    provider_ranking: false,
    provider_selection_authority: result.provider_selection_authority,
  });
}

export function logisticsProviderSelectionContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_SELECTION_CONTRACT_VERSION,
    purpose: 'identify verified-feasible providers and record an explicit selection decision',
    feasibility_authority: 'app/src/verticals/logistics/provider-capability-contract.js + provider-verification-contract.js',
    selection_authority: 'explicit selection input',
    authorization_authority: 'backend/lib/authorization.js',
    persistence: 'none',
    provider_ranking: false,
    credential_storage: false,
    execution: false,
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    next_boundary: 'app/src/verticals/logistics/provider-execution-handoff-contract.js',
  });
}
