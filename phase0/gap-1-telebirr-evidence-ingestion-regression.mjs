import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const calls = [];
const store = {
  async getPaymentIntent(_chatId, id) {
    assert.equal(id, 'intent-1');
    return { id: 'intent-1', organizationId: 'org-1', providerId: 'telebirr' };
  },
  async insertPaymentEvidence(_chatId, input) {
    calls.push(input);
    return { evidence: { id: 'evidence-1', ...input }, duplicate: false };
  },
};

const provider = {
  capabilities: { parseEvidence: true },
  async parseEvidence({ payload }) {
    return {
      providerId: 'telebirr',
      reference: 'TB-REF-42',
      providerTransactionId: 'TB-TX-42',
      amountMinor: 2500,
      currency: 'ETB',
      receiverAccount: '100001',
      observedAt: '2026-09-30T12:00:00Z',
      providerPayload: payload,
      parser: 'telebirr',
      parserVersion: '1',
    };
  },
};

const core = new PaymentCore({
  store,
  providerRegistry: { getPaymentProvider: () => provider },
});

const result = await core.submitEvidence({
  chatId: 'chat-1',
  organizationId: 'org-1',
  paymentIntentId: 'intent-1',
  rawPayload: { receiptNo: 'TB-REF-42', transactionId: 'TB-TX-42', amount: 2500, currency: 'ETB' },
  evidenceType: 'RECEIPT',
  channel: 'image',
});

assert.equal(result.duplicate, false);
assert.equal(calls.length, 1);
assert.equal(calls[0].providerId, 'telebirr');
assert.equal(calls[0].externalReference, 'TB-REF-42');
assert.equal(calls[0].providerTransactionId, 'TB-TX-42');
assert.equal(calls[0].observedAt, '2026-09-30T12:00:00Z');
assert.equal(calls[0].normalizedPayload.parser, 'telebirr');
assert.match(calls[0].fingerprint, /^[a-f0-9]{64}$/);

await assert.rejects(
  () => core.submitEvidence({
    chatId: 'chat-1',
    organizationId: 'org-1',
    paymentIntentId: 'intent-1',
    providerId: 'cbe',
    rawPayload: { reference: 'CBE-1' },
    evidenceType: 'RECEIPT',
  }),
  error => error.code === 'PROVIDER_MISMATCH'
);

console.log('GAP-1 Telebirr evidence ingestion regression: PASS');
