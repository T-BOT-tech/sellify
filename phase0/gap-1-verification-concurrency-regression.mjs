import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

let providerCalls = 0;
const payment = { id: 'pay-1', organizationId: 'org-1', providerId: 'manual', state: 'RECEIVED', paymentIntentId: 'intent-1' };
const intent = { id: 'intent-1', providerId: 'manual', paymentAccountId: 'acct-1' };
const evidence = { id: 'ev-1', paymentId: 'pay-1', paymentIntentId: 'intent-1', providerId: 'manual', status: 'PROCESSING' };

const store = {
  async claimPaymentEvidenceProcessing() { return { claimed: false, evidence }; },
  async getPayment() { return payment; },
  async getPaymentIntent() { return intent; },
  async listPaymentEvidence() { return [evidence]; },
  async listPaymentAccounts() { return [{ id: 'acct-1', providerId: 'manual' }]; },
};

const core = new PaymentCore({
  store,
  providerRegistry: {
    getPaymentProvider() {
      return {
        capabilities: { verify: true, reconcile: false },
        async verify() { providerCalls += 1; return { providerId: 'manual', result: 'MATCH', amountMinor: 10000, currency: 'ETB' }; },
      };
    },
  },
});

await assert.rejects(
  () => core.verifyPayment({ chatId: 'tenant-1', paymentId: 'pay-1', evidenceId: 'ev-1' }),
  error => error.code === 'EVIDENCE_PROCESSING'
);
assert.equal(providerCalls, 0);

console.log('Verification concurrency regression passed');
