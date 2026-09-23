// Phase 20.7 — Trade Requirements & Evidence Boundary.
// Derived coordination only. Requirements and evidence describe what must be
// established for a cross-border flow; they do not create regulatory,
// compliance, customs, tax, identity, payment, or document authority.

export const CROSS_BORDER_TRADE_EVIDENCE_VERSION = '1.0';

export const TRADE_REQUIREMENT_STATUS = Object.freeze({
  REQUIRED: 'required',
  SATISFIED: 'satisfied',
  MISSING: 'missing',
  UNKNOWN: 'unknown',
  EXPIRED: 'expired',
  NOT_APPLICABLE: 'not_applicable',
});

export const TRADE_EVIDENCE_STATE = Object.freeze({
  OBSERVED: 'observed',
  VERIFIED: 'verified',
  UNVERIFIED: 'unverified',
  EXPIRED: 'expired',
});

const FAILURE = Object.freeze(['RETRYABLE_FAILURE', 'PERMANENT_FAILURE', 'REVIEW_REQUIRED', 'BLOCKED', 'UNKNOWN']);
const REQUIREMENT_TYPES = Object.freeze(['commerce', 'capacity', 'qualification', 'payment', 'currency', 'logistics', 'document', 'customs', 'tax', 'compliance']);
const text = (value, field) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new TypeError(`${field} must be non-empty`);
  return normalized;
};
const optionalText = value => value == null ? null : String(value).trim() || null;
const freeze = value => Object.freeze(value);

function validateStatus(status) {
  if (!Object.values(TRADE_REQUIREMENT_STATUS).includes(status)) throw new TypeError(`invalid requirement status: ${status}`);
  return status;
}

function validateEvidenceState(state) {
  if (!Object.values(TRADE_EVIDENCE_STATE).includes(state)) throw new TypeError(`invalid evidence state: ${state}`);
  return state;
}

export function buildTradeRequirement({
  requirementId,
  type,
  jurisdiction = null,
  scope = 'cross_border_flow',
  status = TRADE_REQUIREMENT_STATUS.REQUIRED,
  source = null,
  sourceReference = null,
  observedAt = null,
  validUntil = null,
  provenance = null,
} = {}) {
  const normalizedType = text(type, 'type').toLowerCase();
  if (!REQUIREMENT_TYPES.includes(normalizedType)) throw new TypeError(`unsupported requirement type: ${normalizedType}`);
  validateStatus(status);
  return freeze({
    requirementId: text(requirementId, 'requirementId'),
    type: normalizedType,
    jurisdiction: optionalText(jurisdiction),
    scope: text(scope, 'scope'),
    status,
    source: optionalText(source),
    sourceReference: optionalText(sourceReference),
    observedAt: optionalText(observedAt),
    validUntil: optionalText(validUntil),
    provenance: provenance == null ? null : freeze({ ...provenance }),
    derived: true,
    persistent: false,
    authoritative: false,
  });
}

export function buildTradeEvidence({
  evidenceId,
  requirementId = null,
  capability = null,
  source,
  sourceReference,
  state = TRADE_EVIDENCE_STATE.OBSERVED,
  observedAt = null,
  validUntil = null,
  provenance,
  details = null,
} = {}) {
  validateEvidenceState(state);
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) throw new TypeError('provenance is required for evidence');
  return freeze({
    evidenceId: text(evidenceId, 'evidenceId'),
    requirementId: optionalText(requirementId),
    capability: optionalText(capability),
    source: text(source, 'source'),
    sourceReference: text(sourceReference, 'sourceReference'),
    state,
    observedAt: optionalText(observedAt),
    validUntil: optionalText(validUntil),
    provenance: freeze({ ...provenance }),
    details: details == null ? null : freeze({ ...details }),
    derived: true,
    persistent: false,
    authoritative: false,
  });
}

export function evaluateEvidenceFreshness(evidence, now = new Date()) {
  if (!evidence || typeof evidence !== 'object') throw new TypeError('evidence must be an object');
  if (!evidence.validUntil) return 'current';
  const expires = new Date(evidence.validUntil).getTime();
  if (!Number.isFinite(expires)) return 'unknown';
  return expires >= new Date(now).getTime() ? 'current' : 'expired';
}

export function evaluateTradeRequirement({ requirement, evidence = [], now = new Date() } = {}) {
  if (!requirement || typeof requirement !== 'object') throw new TypeError('requirement is required');
  const matching = evidence.filter(item => item && item.requirementId === requirement.requirementId);
  const fresh = matching.filter(item => evaluateEvidenceFreshness(item, now) === 'current');
  const verified = fresh.some(item => item.state === TRADE_EVIDENCE_STATE.VERIFIED);

  if (requirement.status === TRADE_REQUIREMENT_STATUS.NOT_APPLICABLE) return TRADE_REQUIREMENT_STATUS.NOT_APPLICABLE;
  if (verified) return TRADE_REQUIREMENT_STATUS.SATISFIED;
  if (matching.some(item => evaluateEvidenceFreshness(item, now) === 'expired')) return TRADE_REQUIREMENT_STATUS.EXPIRED;
  if (matching.length) return TRADE_REQUIREMENT_STATUS.UNKNOWN;
  return requirement.status === TRADE_REQUIREMENT_STATUS.REQUIRED ? TRADE_REQUIREMENT_STATUS.MISSING : TRADE_REQUIREMENT_STATUS.UNKNOWN;
}

export function buildTradeRequirementAssessment({ requirements = [], evidence = [], now = new Date() } = {}) {
  if (!Array.isArray(requirements) || !Array.isArray(evidence)) throw new TypeError('requirements and evidence must be arrays');
  const assessments = requirements.map(requirement => freeze({
    requirementId: requirement.requirementId,
    type: requirement.type,
    status: evaluateTradeRequirement({ requirement, evidence, now }),
  }));
  const blocking = assessments.filter(item => [TRADE_REQUIREMENT_STATUS.MISSING, TRADE_REQUIREMENT_STATUS.EXPIRED].includes(item.status));
  const unknown = assessments.filter(item => item.status === TRADE_REQUIREMENT_STATUS.UNKNOWN);
  return freeze({
    assessments: freeze(assessments),
    blocking: freeze(blocking),
    unknown: freeze(unknown),
    overall: blocking.length ? 'BLOCKED' : unknown.length ? 'REVIEW_REQUIRED' : 'SATISFIED',
    deterministic: true,
    persistent: false,
    authoritative: false,
  });
}

export function tradeRequirementsEvidenceContract() {
  return freeze({
    version: CROSS_BORDER_TRADE_EVIDENCE_VERSION,
    authority: 'cross_border_coordination_only',
    requirementAuthority: 'owning country/domain/external authority',
    evidenceAuthority: 'source_authority_or_provider',
    persistence: 'none',
    mutation: false,
    execution: false,
    legalDecision: false,
    regulatoryRules: false,
    duplicateComplianceAuthority: false,
    duplicateCustomsAuthority: false,
    duplicateTaxAuthority: false,
    duplicatePaymentAuthority: false,
    duplicateDocumentAuthority: false,
    freshnessRequiredForVerification: true,
    provenanceRequiredForEvidence: true,
    unknownIsSuccess: false,
    failureStates: [...FAILURE],
    requirementTypes: [...REQUIREMENT_TYPES],
  });
}
