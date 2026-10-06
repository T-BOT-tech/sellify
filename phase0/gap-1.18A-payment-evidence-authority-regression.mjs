import assert from 'node:assert/strict';
import { assertUntrustedPaymentEvidenceShape, normalizePaymentEvidenceSource } from '../backend/lib/payments/payment-evidence-authority.js';
import { readFile } from 'node:fs/promises';

const base = { paymentIntentId: 'intent-1', evidenceType: 'MANUAL_CONFIRMATION', providerId: 'manual' };
assert.equal(assertUntrustedPaymentEvidenceShape(base), true);
assert.equal(normalizePaymentEvidenceSource(), 'caller.submitted');
assert.equal(normalizePaymentEvidenceSource(' provider.getStatus '), 'provider.getStatus');

for (const field of [
  'verification', 'verificationResult', 'decision', 'targetState',
  'certification', 'liveExternalCertification', 'ledgerMutated',
  'financialEffect', 'paymentState', 'authoritative', 'verifier', 'verifierVersion',
]) {
  assert.throws(
    () => assertUntrustedPaymentEvidenceShape({ ...base, [field]: field === 'verification' ? { result: 'MATCH' } : 'MATCH' }),
    error => error?.code === 'EVIDENCE_AUTHORITY_FIELD_FORBIDDEN' && error.field === field,
    'caller-controlled ' + field + ' must be rejected',
  );
}

const paymentCoreSource = await readFile(new URL('../backend/lib/payments/payment-core.js', import.meta.url), 'utf8');
assert.match(paymentCoreSource, /assertUntrustedPaymentEvidenceShape\(command\)/);
assert.match(paymentCoreSource, /source: 'caller\.submitted'/);

console.log('GAP-1.18A evidence authority regression passed');
