import assert from 'node:assert/strict';
import {
  getLogisticsEvidenceProfile,
  normalizeLogisticsEvidence,
  validateLogisticsEvidenceProfile,
  assertLogisticsEvidenceProfileBoundary,
  logisticsEvidenceProfileContract,
} from '../app/src/verticals/logistics/logistics-evidence-profile-contract.js';

const contract = logisticsEvidenceProfileContract();
assert.equal(contract.version, '1.0');
assert.deepEqual(contract.service_profiles, [
  'REGIONAL_FREIGHT', 'B2B_DISTRIBUTION', 'B2C_DELIVERY', 'P2P_DELIVERY',
]);
assert.equal(contract.persistence, 'existing_evidence_and_core_state_only');
assert.equal(contract.duplicate_evidence_store, false);
assert.equal(contract.duplicate_proof_authority, false);
assert.equal(contract.identity_authority, 'identity_compliance');
assert.equal(contract.fulfillment_authority, 'existing_core_fulfillment');
assert.equal(contract.payment_mutation, false);
assert.equal(contract.inventory_mutation, false);
assert.equal(contract.settlement_mutation, false);

assert.deepEqual(
  getLogisticsEvidenceProfile('regional_freight').requirements.map(item => item.kind),
  ['waybill', 'checkpoint', 'weigh', 'delivery'],
);
assert.deepEqual(
  getLogisticsEvidenceProfile('b2b_distribution').requirements.map(item => item.kind),
  ['invoice', 'receiver_confirmation'],
);
assert.deepEqual(
  getLogisticsEvidenceProfile('b2c_delivery').requirements.map(item => item.kind),
  ['otp', 'photo', 'recipient_confirmation'],
);
assert.deepEqual(
  getLogisticsEvidenceProfile('p2p_delivery').requirements.map(item => item.kind),
  ['pickup_otp', 'delivery_otp', 'identity'],
);

const normalized = normalizeLogisticsEvidence({
  kind: 'PHOTO',
  ref: 'photo-1',
  captured_at: '2026-10-04T10:00:00Z',
  actor_ref: 'courier-1',
  context_ref: 'delivery-1',
});
assert.deepEqual(normalized, {
  kind: 'photo',
  ref: 'photo-1',
  captured_at: '2026-10-04T10:00:00Z',
  actor_ref: 'courier-1',
  context_ref: 'delivery-1',
});

assert.throws(() => normalizeLogisticsEvidence({ kind: 'gps', ref: 'gps-1' }), /Unsupported logistics evidence kind/);
assert.throws(() => normalizeLogisticsEvidence({ kind: 'photo' }), /evidence.ref/);

const completeB2B = validateLogisticsEvidenceProfile({
  serviceProfile: 'b2b_distribution',
  evidence: [
    { kind: 'invoice', ref: 'invoice-1' },
    { kind: 'receiver_confirmation', ref: 'receiver-1' },
  ],
});
assert.equal(completeB2B.valid, true);
assert.equal(completeB2B.reason, 'EVIDENCE_PROFILE_SATISFIED');

const missingB2B = validateLogisticsEvidenceProfile({
  serviceProfile: 'B2B_DISTRIBUTION',
  evidence: [{ kind: 'invoice', ref: 'invoice-1' }],
});
assert.equal(missingB2B.valid, false);
assert.equal(missingB2B.reason, 'MANDATORY_EVIDENCE_MISSING');
assert.deepEqual(missingB2B.missing_evidence, ['receiver_confirmation']);

const wrongProfileEvidence = validateLogisticsEvidenceProfile({
  serviceProfile: 'B2C_DELIVERY',
  evidence: [
    { kind: 'invoice', ref: 'invoice-1' },
    { kind: 'otp', ref: 'otp-1' },
    { kind: 'photo', ref: 'photo-1' },
    { kind: 'recipient_confirmation', ref: 'recipient-1' },
  ],
});
assert.equal(wrongProfileEvidence.valid, false);
assert.equal(wrongProfileEvidence.reason, 'EVIDENCE_NOT_ALLOWED_FOR_PROFILE');

const conflicting = validateLogisticsEvidenceProfile({
  serviceProfile: 'P2P_DELIVERY',
  evidence: [
    { kind: 'pickup_otp', ref: 'pickup-1' },
    { kind: 'pickup_otp', ref: 'pickup-2' },
    { kind: 'delivery_otp', ref: 'delivery-1' },
    { kind: 'identity', ref: 'identity-1' },
  ],
});
assert.equal(conflicting.valid, false);
assert.equal(conflicting.reason, 'CONFLICTING_EVIDENCE_REFERENCE');

const completeP2P = validateLogisticsEvidenceProfile({
  serviceProfile: 'P2P_DELIVERY',
  evidence: [
    { kind: 'pickup_otp', ref: 'pickup-1' },
    { kind: 'delivery_otp', ref: 'delivery-1' },
    { kind: 'identity', ref: 'identity-1' },
  ],
});
assert.equal(completeP2P.valid, true);

for (const serviceProfile of contract.service_profiles) {
  assert.equal(
    validateLogisticsEvidenceProfile({ serviceProfile, evidence: getLogisticsEvidenceProfile(serviceProfile).requirements.map(item => ({ kind: item.kind, ref: `${item.kind}-1` })) }).valid,
    true,
  );
}

assert.deepEqual(
  assertLogisticsEvidenceProfileBoundary(),
  { valid: true, reason: 'EVIDENCE_BOUNDARY_VALID' },
);
assert.deepEqual(
  assertLogisticsEvidenceProfileBoundary({ organizationScoped: false }),
  { valid: false, reason: 'EVIDENCE_ORGANIZATION_SCOPE_REQUIRED' },
);
assert.deepEqual(
  assertLogisticsEvidenceProfileBoundary({ authorized: false }),
  { valid: false, reason: 'EVIDENCE_AUTHORIZATION_REQUIRED' },
);
assert.deepEqual(
  assertLogisticsEvidenceProfileBoundary({ downstreamMutation: true }),
  { valid: false, reason: 'EVIDENCE_MUST_NOT_MUTATE_DOWNSTREAM_AUTHORITY' },
);

console.log('L12 Logistics Evidence Profiles Regression: PASS');
