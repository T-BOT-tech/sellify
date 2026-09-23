// Phase 16.13.5 — Logistics Provider Capability Verification / Trust Boundary.
//
// This boundary evaluates explicit capability evidence. It is NOT a global
// provider trust authority, provider marketplace, credential store, selector,
// or execution engine. Verification is scoped to the submitted evidence and
// never mutates Logistics, Fulfillment, authorization, or provider state.
//
// Flow:
// capability claim → evidence provenance → verification result → feasibility
// → existing authorization → existing domain transaction → adapter/provider.

import { defineLogisticsProviderCapability } from './provider-capability-contract.js';

export const LOGISTICS_PROVIDER_VERIFICATION_CONTRACT_VERSION = '1.0';

const VERIFICATION_RESULTS = new Set(['UNVERIFIED', 'OBSERVED', 'VERIFIED', 'INVALID', 'EXPIRED']);
const FORBIDDEN_FIELDS = Object.freeze([
  'credentials', 'credential', 'secret', 'token', 'apiKey', 'password',
  'selection', 'selectedProvider', 'provider_selection',
  'database', 'store', 'persistence', 'ledger',
  'ownsAuthorization', 'ownsIdentityStore', 'ownsTransactionEngine', 'ownsEventStore',
]);

function invalid(message, code = 'LOGISTICS_PROVIDER_VERIFICATION_INVALID') {
  const error = new Error(`Invalid logistics provider verification: ${message}`);
  error.code = code;
  throw error;
}
function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
  return value.trim();
}
function rejectForbidden(input) {
  for (const field of FORBIDDEN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) invalid(`verification cannot contain ${field}`);
  }
}
function parseTime(value, field) {
  if (value == null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) invalid(`${field} must be a valid date-time`);
  return parsed.toISOString();
}

export function verifyLogisticsProviderCapability(input, { now = new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('verification must be an object');
  rejectForbidden(input);

  const capability = defineLogisticsProviderCapability(input);
  const evidenceReference = input.evidence_reference == null ? null : text(input.evidence_reference, 'evidence_reference');
  const verifiedBy = input.verified_by == null ? null : text(input.verified_by, 'verified_by');
  const verifiedAt = parseTime(input.verified_at, 'verified_at');
  const validUntil = parseTime(input.valid_until, 'valid_until');
  const observedAt = parseTime(input.observed_at, 'observed_at');
  const nowDate = new Date(now);
  if (Number.isNaN(nowDate.getTime())) invalid('now must be a valid date-time');

  let result = 'UNVERIFIED';
  if (capability.status === 'BLOCKED') result = 'INVALID';
  else if (validUntil && new Date(validUntil).getTime() < nowDate.getTime()) result = 'EXPIRED';
  else if (capability.evidence_mode === 'verified') result = 'VERIFIED';
  else if (capability.evidence_mode === 'observed') result = 'OBSERVED';

  if (result === 'VERIFIED') {
    if (!verifiedBy) invalid('verified_by is required for VERIFIED evidence', 'LOGISTICS_PROVIDER_VERIFIER_REQUIRED');
    if (!verifiedAt) invalid('verified_at is required for VERIFIED evidence', 'LOGISTICS_PROVIDER_VERIFIED_AT_REQUIRED');
    if (!evidenceReference) invalid('evidence_reference is required for VERIFIED evidence', 'LOGISTICS_PROVIDER_EVIDENCE_REFERENCE_REQUIRED');
  }

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_VERIFICATION_CONTRACT_VERSION,
    provider_id: capability.provider_id,
    capabilities: capability.capabilities,
    verification_result: result,
    evidence_status: capability.status,
    evidence_source: capability.source,
    evidence_mode: capability.evidence_mode,
    evidence_reference: evidenceReference,
    observed_at: observedAt,
    verified_by: verifiedBy,
    verified_at: verifiedAt,
    valid_until: validUntil,
    scoped_claim: true,
    provider_trust_authority: false,
    provider_selection: false,
    credential_storage: false,
    persistence: 'none',
    authorization: 'existing_authorization',
    execution: 'none',
    fulfillment_mutation: false,
  });
}

export function evaluateLogisticsProviderTrustBoundary(requirements = {}, verification) {
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) invalid('requirements must be an object');
  const result = verifyLogisticsProviderCapability(verification);
  const required = Array.isArray(requirements.capabilities) ? requirements.capabilities.map(String) : [];
  const missing = required.filter((capability) => !result.capabilities.includes(capability));
  const evidenceAcceptable = result.verification_result === 'VERIFIED' || result.verification_result === 'OBSERVED';
  const feasible = evidenceAcceptable && missing.length === 0 && result.evidence_status === 'AVAILABLE';

  return Object.freeze({
    contract_version: LOGISTICS_PROVIDER_VERIFICATION_CONTRACT_VERSION,
    provider_id: result.provider_id,
    result: feasible ? 'EVIDENCE_SUFFICIENT' : result.verification_result === 'EXPIRED' ? 'EXPIRED' : 'EVIDENCE_INSUFFICIENT',
    required_capabilities: Object.freeze(required),
    missing_capabilities: Object.freeze(missing),
    verification_result: result.verification_result,
    evidence_sufficient: feasible,
    authorization_required: true,
    provider_selection: false,
    execution: false,
    persistence: 'none',
    principle: 'verified evidence supports a scoped feasibility decision; it does not grant trust, authorization, provider selection, or execution rights',
  });
}

export function logisticsProviderVerificationContract() {
  return Object.freeze({
    version: LOGISTICS_PROVIDER_VERIFICATION_CONTRACT_VERSION,
    results: Object.freeze([...VERIFICATION_RESULTS]),
    verification_authority: 'explicit verification action outside this metadata contract',
    evidence_authority: 'app/src/verticals/logistics/provider-capability-contract.js',
    authorization_authority: 'backend/lib/authorization.js',
    fulfillment_authority: 'app/src/logistics/fulfillment.js',
    persistence: 'none',
    provider_selection: false,
    credential_storage: false,
    provider_trust_authority: false,
    execution: 'deferred',
  });
}
