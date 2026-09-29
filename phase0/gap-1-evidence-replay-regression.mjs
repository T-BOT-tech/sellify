import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const captured = [];
const store = {
  async getPaymentIntent() {
    return { id: 'intent-1', providerId: 'telebirr', paymentAccountId: 'acct-1' };
  },
  async insertPaymentEvidence(chatId, input) {
    captured.push({ chatId, input });
    return { id: 'evidence-1', ...input };
  },
};
const core = new PaymentCore({ store, providerRegistry: { getPaymentProvider: () => ({
  capabilities: { parseEvidence: false },
}) } });

await assert.rejects(
  () => core.submitEvidence({
    chatId: 'tenant-1',
    paymentIntentId: 'intent-1',
    providerId: 'telebirr',
    amountMinor: 10000,
    currency: 'ETB',
  }),
  error => error.code === 'EVIDENCE_IDENTIFIER_REQUIRED'
);

const result = await core.submitEvidence({
  chatId: 'tenant-1',
  paymentIntentId: 'intent-1',
  providerId: 'telebirr',
  externalReference: 'TB-123',
  amountMinor: 10000,
  currency: 'ETB',
});
assert.equal(result.externalReference, 'TB-123');
assert.equal(typeof result.fingerprint, 'string');
assert.equal(result.fingerprint.length, 64);
assert.equal(captured.length, 1);

console.log('Evidence replay boundary regression passed');
