import assert from 'node:assert/strict';
import {
  normalizeProviderVerificationResult,
  providerVerificationResult,
  PROVIDER_VERIFICATION_STATUSES,
} from '../backend/lib/payments/provider-verification-result.js';

assert.deepEqual(PROVIDER_VERIFICATION_STATUSES, [
  'VERIFIED', 'NOT_FOUND', 'FAILED', 'UNAVAILABLE', 'UNSUPPORTED',
]);

const verified = providerVerificationResult('VERIFIED', {
  providerId: 'TeleBirr',
  reference: 'txn-118d',
  transactionId: 'tx-1',
  evidence: {
    amountMinor: 12500,
    authorization: 'Bearer secret',
    decision: 'MARK_PAID',
    targetState: 'VERIFIED',
    nested: { api_key: 'secret', useful: 'kept' },
  },
});
assert.equal(verified.status, 'VERIFIED');
assert.equal(verified.providerId, 'telebirr');
assert.equal(verified.providerReference, 'txn-118d');
assert.equal(verified.providerTransactionId, 'tx-1');
assert.equal(verified.evidence.authorization, undefined);
assert.equal(verified.evidence.decision, undefined);
assert.equal(verified.evidence.targetState, undefined);
assert.equal(verified.evidence.nested.api_key, undefined);
assert.equal(verified.evidence.nested.useful, 'kept');

for (const status of PROVIDER_VERIFICATION_STATUSES) {
  assert.equal(normalizeProviderVerificationResult({ status }).status, status);
}
assert.equal(normalizeProviderVerificationResult({ status: 'PAID' }).status, 'FAILED');
assert.equal(normalizeProviderVerificationResult({
  status: 'NOT_FOUND',
  evidence: { responseText: 'x'.repeat(5000) },
}).evidence.responseText.length, 4096);

console.log('GAP-1.18D provider verification result regression passed');
