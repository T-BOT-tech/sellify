import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const attempts = new Map([['a1', {
  id: 'a1', evidenceId: 'e1', paymentIntentId: 'i1',
  providerId: 'mpesa', status: 'PENDING',
}]]);
const evidence = { id: 'e1', providerId: 'mpesa', paymentIntentId: 'i1' };
const payment = { id: 'p1', state: 'UNPAID' };
const calls = [];
const store = {
  getPaymentConfirmationAttempt: async (_chatId, id) => attempts.get(id) || null,
  getPaymentEvidence: async () => evidence,
  updatePaymentConfirmationAttempt: async (_chatId, id, input) => {
    attempts.set(id, { ...attempts.get(id), ...input });
    return attempts.get(id);
  },
  getPaymentForIntent: async () => payment,
};
const core = new PaymentCore({ store, authorization: null });

const pending = await core.recordProviderConfirmationObservation({
  chatId: 'chat-1', confirmationAttemptId: 'a1', providerId: 'mpesa',
  status: 'PENDING', observation: { providerTransactionId: 'TX-1' },
});
assert.equal(pending.pending, true);
assert.equal(payment.state, 'UNPAID');

await assert.rejects(
  core.recordProviderConfirmationObservation({
    chatId: 'chat-1', confirmationAttemptId: 'a1', providerId: 'telebirr',
    status: 'CONFIRMED',
  }),
  error => error.code === 'PROVIDER_MISMATCH',
);

console.log('GAP-1 provider confirmation ingestion regression: PASS');
