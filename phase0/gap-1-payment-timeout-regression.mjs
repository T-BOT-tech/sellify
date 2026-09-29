import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const payment = { id: 'pay-1', organizationId: 'org-1', providerId: 'manual', state: 'RECEIVED', paymentIntentId: 'intent-1' };
const intent = { id: 'intent-1', providerId: 'manual', paymentAccountId: 'acct-1' };
const evidence = { id: 'ev-1', paymentId: 'pay-1', paymentIntentId: 'intent-1', providerId: 'manual', status: 'RECEIVED', processingAttempt: 1 };
let released = null;

const store = {
  async claimPaymentEvidenceProcessing() { return { claimed: true, evidence }; },
  async getPayment() { return payment; },
  async getPaymentIntent() { return intent; },
  async listPaymentEvidence() { return [evidence]; },
  async listPaymentAccounts() { return [{ id: 'acct-1', providerId: 'manual' }]; },
  async transitionPaymentEvidence(_chatId, input) { released = input; return evidence; },
};

const core = new PaymentCore({
  store,
  verificationTimeoutMs: 10,
  providerRegistry: {
    getPaymentProvider() {
      return {
        capabilities: { verify: true, reconcile: false },
        async verify() { return new Promise(() => {}); },
      };
    },
  },
});

await assert.rejects(
  () => core.verifyPayment({ chatId: 'tenant-1', paymentId: 'pay-1', evidenceId: 'ev-1' }),
  error => error.code === 'PAYMENT_PROVIDER_TIMEOUT'
);
assert.deepEqual(released, { evidenceId: 'ev-1', status: 'RECEIVED', processingAttempt: 1 });

console.log('GAP-1 payment provider timeout regression: PASS');
