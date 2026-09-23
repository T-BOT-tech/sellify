// Phase 16.13.2 — Logistics Provider Capability Contract.
//
// Provider capability is evidence/metadata at the canonical Logistics boundary.
// It does not authorize an actor, create a shipment, execute a route, mutate
// Fulfillment, persist provider state, or select a provider.
//
// Flow:
// Canonical requirement → capability evidence → existing authorization/domain
// authority → adapter → provider (execution only when explicitly enabled).

export const LOGISTICS_PROVIDER_CAPABILITY_CONTRACT_VERSION = '1.0';

const CAPABILITIES = new Set([
  'pickup',
  'delivery',
  'tracking',
  'proof_of_delivery',
  'returns',
  'route_planning',
  'dispatch',
  'cross_border',
]);
const STATUSES = new Set(['AVAILABLE', 'REVIEW_REQUIRED', 'BLOCKED', 'UNKNOWN']);
const SOURCES = new Set(['provider', 'adapter', 'network', 'manual', 'sellify']);
const EVIDENCE_MODES = new Set(['declared', 'observed', 'verified']);

function invalid(message, code = 'LOGISTICS_PROVIDER_CAPABILITY_INVALID') {
  const error = new Error(`Invalid logistics provider capability: ${message}`);
  error.code = code;
  throw error;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}
function normalized(value, field) { return text(value, field).toLowerCase(); }
function list(value, field, allowed = null) {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const out = value.map((v) => normalized(v, `${field} item`));
  if (new Set(out).size !== out.length) invalid(`${field} must not contain duplicates`);
  if (allowed) for (const item of out) if (!allowed.has(item)) invalid(`${field} contains unsupported value: ${item}`);
  return Object.freeze(out);
}

export function defineLogisticsProviderCapability(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('capability must be an object');
  const providerId = text(input.provider_id, 'provider_id');
  const capabilities = list(input.capabilities ?? [], 'capabilities', CAPABILITIES);
  const status = text(input.status ?? 'UNKNOWN', 'status').toUpperCase();
  if (!STATUSES.has(status)) invalid(`unsupported status: ${status}`);
  const source = normalized(input.source ?? 'provider', 'source');
  if (!SOURCES.has(source)) invalid(`unsupported source: ${source}`);
  const evidenceMode = normalized(input.evidence_mode ?? 'declared', 'evidence_mode');
  if (!EVIDENCE_MODES.has(evidenceMode)) invalid(`unsupported evidence_mode: ${evidenceMode}`);
  const geography = input.geography == null ? null : text(input.geography, 'geography');

  for (const forbidden of ['credentials', 'secret', 'token', 'apiKey', 'password']) {
    if (Object.prototype.hasOwnProperty.call(input, forbidden)) invalid(`capability contract cannot contain ${forbidden}`);
  }

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_CAPABILITY_CONTRACT_VERSION,
    provider_id: providerId,
    capabilities,
    status,
    source,
    evidence_mode: evidenceMode,
    geography,
    authority: 'logistics-capability-contract',
    persistence: 'none',
    authorization: 'existing_authorization',
    execution: 'none',
    provider_selection: false,
    route_creation: false,
    shipment_creation: false,
    fulfillment_mutation: false,
  });
}

export function evaluateLogisticsProviderCapability(requirements = {}, evidence = {}) {
  if (!requirements || typeof requirements !== 'object') invalid('requirements must be an object');
  const required = list(requirements.capabilities ?? [], 'requirements.capabilities', CAPABILITIES);
  const observed = defineLogisticsProviderCapability({ ...evidence, capabilities: evidence.capabilities ?? [] });
  const missing = required.filter((capability) => !observed.capabilities.includes(capability));
  const result = observed.status === 'BLOCKED'
    ? 'NOT_FEASIBLE'
    : observed.status === 'UNKNOWN'
      ? 'UNKNOWN'
      : missing.length
        ? 'NOT_FEASIBLE'
        : observed.status === 'REVIEW_REQUIRED'
          ? 'CONDITIONALLY_FEASIBLE'
          : 'FEASIBLE';

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_CAPABILITY_CONTRACT_VERSION,
    provider_id: observed.provider_id,
    result,
    required_capabilities: required,
    observed_capabilities: observed.capabilities,
    missing_capabilities: Object.freeze(missing),
    evidence_status: observed.status,
    evidence_source: observed.source,
    execution: false,
    persistence: 'none',
    provider_selection: false,
    principle: 'capability evidence informs feasibility; it does not authorize or execute logistics',
  });
}

export function logisticsProviderCapabilityContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_CAPABILITY_CONTRACT_VERSION,
    capability_vocabulary: Object.freeze([...CAPABILITIES]),
    statuses: Object.freeze([...STATUSES]),
    evidence_modes: Object.freeze([...EVIDENCE_MODES]),
    authorization_authority: 'backend/lib/authorization.js',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    provider_adapter_boundary: 'canonical_contract_to_adapter_to_provider',
    persistence: 'none',
    execution: 'deferred',
    provider_selection: false,
    duplicate_authority: false,
  });
}
