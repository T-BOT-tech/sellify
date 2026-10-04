// L12 — Logistics Evidence Profiles.
// Formalizes service-specific evidence requirements over existing evidence/proof
// authorities. This module does not create an evidence store or mutate Core state.

export const LOGISTICS_EVIDENCE_PROFILE_CONTRACT_VERSION = '1.0';

const SERVICE_PROFILES = Object.freeze([
  'REGIONAL_FREIGHT',
  'B2B_DISTRIBUTION',
  'B2C_DELIVERY',
  'P2P_DELIVERY',
]);

const EVIDENCE_PROFILES = Object.freeze({
  REGIONAL_FREIGHT: Object.freeze({
    service_profile: 'REGIONAL_FREIGHT',
    relationship_profile: 'b2b',
    physical_scale: 'regional',
    requirements: Object.freeze([
      Object.freeze({ kind: 'waybill', required: true, authority: 'commerce_or_document', capture_stage: 'dispatch' }),
      Object.freeze({ kind: 'checkpoint', required: true, authority: 'logistics_tracking', capture_stage: 'movement' }),
      Object.freeze({ kind: 'weigh', required: true, authority: 'logistics_operational_evidence', capture_stage: 'loading' }),
      Object.freeze({ kind: 'delivery', required: true, authority: 'existing_delivery_proof', capture_stage: 'delivery' }),
    ]),
  }),
  B2B_DISTRIBUTION: Object.freeze({
    service_profile: 'B2B_DISTRIBUTION',
    relationship_profile: 'b2b',
    physical_scale: 'local_distribution',
    requirements: Object.freeze([
      Object.freeze({ kind: 'invoice', required: true, authority: 'commerce', capture_stage: 'order' }),
      Object.freeze({ kind: 'receiver_confirmation', required: true, authority: 'existing_delivery_proof', capture_stage: 'delivery' }),
    ]),
  }),
  B2C_DELIVERY: Object.freeze({
    service_profile: 'B2C_DELIVERY',
    relationship_profile: 'b2c',
    physical_scale: 'doorstep',
    requirements: Object.freeze([
      Object.freeze({ kind: 'otp', required: true, authority: 'existing_delivery_proof', capture_stage: 'delivery' }),
      Object.freeze({ kind: 'photo', required: true, authority: 'existing_delivery_proof', capture_stage: 'delivery' }),
      Object.freeze({ kind: 'recipient_confirmation', required: true, authority: 'existing_delivery_proof', capture_stage: 'delivery' }),
    ]),
  }),
  P2P_DELIVERY: Object.freeze({
    service_profile: 'P2P_DELIVERY',
    relationship_profile: 'p2p',
    physical_scale: 'doorstep',
    requirements: Object.freeze([
      Object.freeze({ kind: 'pickup_otp', required: true, authority: 'existing_delivery_proof', capture_stage: 'pickup' }),
      Object.freeze({ kind: 'delivery_otp', required: true, authority: 'existing_delivery_proof', capture_stage: 'delivery' }),
      Object.freeze({ kind: 'identity', required: true, authority: 'identity_compliance', capture_stage: 'pickup_or_delivery' }),
    ]),
  }),
});

const EVIDENCE_KINDS = new Set(
  Object.values(EVIDENCE_PROFILES).flatMap(profile => profile.requirements.map(item => item.kind)),
);

function requiredText(value, field) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${field} must be a non-empty string`);
  return result;
}

function normalizeProfile(value) {
  return requiredText(value, 'service_profile').toUpperCase();
}

function normalizeEvidence(value) {
  if (!value || typeof value !== 'object') throw new TypeError('Evidence is required');
  const kind = requiredText(value.kind, 'evidence.kind').toLowerCase();
  if (!EVIDENCE_KINDS.has(kind)) throw new TypeError(`Unsupported logistics evidence kind: ${kind}`);
  return Object.freeze({
    kind,
    ref: requiredText(value.ref, 'evidence.ref'),
    captured_at: value.captured_at ?? null,
    actor_ref: value.actor_ref ? String(value.actor_ref) : null,
    context_ref: value.context_ref ? String(value.context_ref) : null,
  });
}

export function getLogisticsEvidenceProfile(serviceProfile) {
  const profile = EVIDENCE_PROFILES[normalizeProfile(serviceProfile)];
  if (!profile) throw new TypeError(`Unsupported logistics service profile: ${serviceProfile}`);
  return profile;
}

export function normalizeLogisticsEvidence(evidence) {
  return normalizeEvidence(evidence);
}

export function validateLogisticsEvidenceProfile({ serviceProfile, evidence = [] } = {}) {
  const profile = getLogisticsEvidenceProfile(serviceProfile);
  if (!Array.isArray(evidence)) throw new TypeError('evidence must be an array');

  const normalized = evidence.map(normalizeEvidence);
  const allowed = new Set(profile.requirements.map(item => item.kind));
  const present = new Map();

  for (const item of normalized) {
    if (!allowed.has(item.kind)) {
      return Object.freeze({
        valid: false,
        reason: 'EVIDENCE_NOT_ALLOWED_FOR_PROFILE',
        service_profile: profile.service_profile,
        evidence_kind: item.kind,
      });
    }
    const existing = present.get(item.kind);
    if (existing && existing.ref !== item.ref) {
      return Object.freeze({
        valid: false,
        reason: 'CONFLICTING_EVIDENCE_REFERENCE',
        service_profile: profile.service_profile,
        evidence_kind: item.kind,
      });
    }
    present.set(item.kind, item);
  }

  const missing = profile.requirements
    .filter(item => item.required && !present.has(item.kind))
    .map(item => item.kind);

  if (missing.length) {
    return Object.freeze({
      valid: false,
      reason: 'MANDATORY_EVIDENCE_MISSING',
      service_profile: profile.service_profile,
      missing_evidence: Object.freeze(missing),
    });
  }

  return Object.freeze({
    valid: true,
    reason: 'EVIDENCE_PROFILE_SATISFIED',
    service_profile: profile.service_profile,
    evidence: Object.freeze([...present.values()]),
  });
}

export function assertLogisticsEvidenceProfileBoundary({ organizationScoped = true, authorized = true, downstreamMutation = false } = {}) {
  if (!organizationScoped) return Object.freeze({ valid: false, reason: 'EVIDENCE_ORGANIZATION_SCOPE_REQUIRED' });
  if (!authorized) return Object.freeze({ valid: false, reason: 'EVIDENCE_AUTHORIZATION_REQUIRED' });
  if (downstreamMutation) return Object.freeze({ valid: false, reason: 'EVIDENCE_MUST_NOT_MUTATE_DOWNSTREAM_AUTHORITY' });
  return Object.freeze({ valid: true, reason: 'EVIDENCE_BOUNDARY_VALID' });
}

export function logisticsEvidenceProfileContract() {
  return Object.freeze({
    version: LOGISTICS_EVIDENCE_PROFILE_CONTRACT_VERSION,
    service_profiles: SERVICE_PROFILES,
    evidence_profiles: EVIDENCE_PROFILES,
    persistence: 'existing_evidence_and_core_state_only',
    duplicate_evidence_store: false,
    duplicate_proof_authority: false,
    identity_authority: 'identity_compliance',
    fulfillment_authority: 'existing_core_fulfillment',
    payment_mutation: false,
    inventory_mutation: false,
    settlement_mutation: false,
    provider_selection: false,
    dispatch_execution: false,
  });
}
