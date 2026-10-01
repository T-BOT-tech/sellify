import assert from 'node:assert/strict';
import { assertUntrustedPaymentEvidenceShape, normalizePaymentEvidenceSource } from '../backend/lib/payments/payment-evidence-authority.js';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

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

let received;
const core = new PaymentCore({
  store: { insertPaymentEvidence: async (_chatId, input) => { received = input; return { evidence: input, duplicate: false }; } },
});
await core.submitEvidence({
  chatId: 'chat-1',
  paymentIntentId: 'intent-1',
  evidenceType: 'MANUAL_CONFIRMATION',
  providerId: 'manual',
  actor: { userId: 'user-1' },
});
assert.equal(received.source, 'caller.submitted');
assert.equal(received.evidenceType, 'MANUAL_CONFIRMATION');

await assert.rejects(
  () => core.submitEvidence({ ...base, chatId: 'chat-1', verification: { result: 'MATCH' } }),
  error => error?.code === 'EVIDENCE_AUTHORITY_FIELD_FORBIDDEN',
);

console.log('GAP-1.18A evidence authority regression passed');
