import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

let renewals = 0;
let released = null;
const payment = { id: 'pay-1', organizationId: 'org-1', providerId: 'manual', state: 'RECEIVED', paymentIntentId: 'intent-1' };
const intent = { id: 'intent-1', providerId: 'manual', paymentAccountId: 'acct-1' };
const evidence = { id: 'ev-1', paymentId: 'pay-1', paymentIntentId: 'intent-1', providerId: 'manual', status: 'RECEIVED', processingAttempt: 1 };

const store = {
  async claimPaymentEvidenceProcessing() { return { claimed: true, evidence: { ...evidence, processingAttempt: 1 } }; },
  async renewPaymentEvidenceProcessing() { renewals += 1; },
  async getPayment() { return payment; },
  async getPaymentIntent() { return intent; },
  async listPaymentEvidence() { return [evidence]; },
  async listPaymentAccounts() { return [{ id: 'acct-1', providerId: 'manual' }]; },
  async transitionPaymentEvidence(_chatId, input) { released = input; return evidence; },
};

const core = new PaymentCore({
  store,
  verificationTimeoutMs: 1500,
  evidenceLeaseSeconds: 2,
  providerRegistry: {
    getPaymentProvider() {
      return {
        capabilities: { verify: true, reconcile: false },
        async verify() {
          await new Promise(resolve => setTimeout(resolve, 1100));
          return { providerId: 'manual', result: 'UNVERIFIABLE', amountMinor: 10000, currency: 'ETB' };
        },
      };
    },
  },
});

await core.verifyPayment({ chatId: 'tenant-1', paymentId: 'pay-1', evidenceId: 'ev-1' });
assert.ok(renewals >= 1);
assert.deepEqual(released, { evidenceId: 'ev-1', status: 'UNVERIFIABLE', processingAttempt: 1 });

console.log('GAP-1 payment lease renewal regression: PASS');
