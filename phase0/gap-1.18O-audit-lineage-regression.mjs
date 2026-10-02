import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../backend/lib/store-sqlite.js', import.meta.url), 'utf8');

assert.match(source, /GAP-1\.18O — immutable payment audit lineage/);
assert.match(source, /if \(!applied\.includes\(58\)\)/);
assert.match(source, /payment_evidence_id TEXT REFERENCES payment_evidence/);
assert.match(source, /payment_verification_id TEXT REFERENCES payment_verifications/);
assert.match(source, /payment_decision_id TEXT REFERENCES payment_decisions/);
assert.match(source, /payment_transition_id TEXT REFERENCES payment_ledger_entries/);
assert.match(source, /idx_audit_payment_lineage/);

assert.match(source, /const paymentEvidenceId = context\.paymentEvidenceId/);
assert.match(source, /const paymentVerificationId = context\.paymentVerificationId/);
assert.match(source, /const paymentDecisionId = context\.paymentDecisionId/);
assert.match(source, /const paymentTransitionId = context\.paymentTransitionId/);
assert.match(source, /lineageType === 'payment_transition'/);
assert.match(source, /PAYMENT_AUDIT_LINEAGE_INCOMPLETE/);
assert.match(source, /PAYMENT_AUDIT_LINEAGE_INVALID/);
assert.match(source, /SELECT id, organization_id, evidence_id FROM payment_verifications/);
assert.match(source, /SELECT id, organization_id, payment_id, evidence_id, verification_id FROM payment_decisions/);
assert.match(source, /SELECT id, organization_id, payment_id FROM payment_ledger_entries/);

assert.match(source, /const paymentTransitionId = crypto\.randomUUID\(\)/);
assert.match(source, /lineageType: \['VERIFIED', 'RECONCILED'\]\.includes\(target\) \? 'payment_transition' : 'payment_decision'/);
assert.match(source, /paymentEvidenceId: \['VERIFIED', 'RECONCILED'\]\.includes\(target\)/);
assert.match(source, /paymentVerificationId: \['VERIFIED', 'RECONCILED'\]\.includes\(target\)/);
assert.match(source, /paymentDecisionId: \['VERIFIED', 'RECONCILED'\]\.includes\(target\)/);
assert.match(source, /paymentTransitionId: \['VERIFIED', 'RECONCILED'\]\.includes\(target\)/);

console.log('GAP-1.18O audit lineage regression passed');

assert.match(source, /PERSISTED_VERIFICATION_REQUIRED/);
assert.match(source, /PERSISTED_VERIFICATION_NOT_FOUND/);
assert.match(source, /VERIFICATION_PROVENANCE_NOT_PERSISTED/);
assert.match(source, /const authoritativeTarget = \['VERIFIED', 'RECONCILED'\]\.includes\(target\)/);
assert.match(source, /const persistedVerification = db\.prepare\('SELECT \* FROM payment_verifications/);
assert.match(source, /if \(authoritativeTarget\) \{/);
assert.match(source, /v = \{/);

assert.match(source, /GAP-1\.18Q — immutable payment decision identity and verification binding/);
assert.match(source, /if \(!applied\.includes\(59\)\)/);
assert.match(source, /decision_fingerprint TEXT/);
assert.match(source, /uq_payment_decisions_verification/);
assert.match(source, /uq_payment_decisions_fingerprint/);
assert.match(source, /PAYMENT_DECISION_VERIFICATION_DUPLICATES_EXIST/);
assert.match(source, /function paymentDecisionFingerprint/);
assert.match(source, /const decisionFingerprint = paymentDecisionFingerprint/);
assert.match(source, /const existingDecision = decisionVerificationId/);
assert.match(source, /PAYMENT_DECISION_CONFLICT/);
assert.match(source, /return paymentFromRow\(currentPayment\)/);
assert.match(source, /decision_fingerprint\) VALUES/);
