import assert from 'node:assert/strict';
const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const attempt = { id:'attempt-1', evidenceId:'e1', paymentIntentId:'i1', providerId:'mpesa', status:'PENDING' };
const evidence = { id:'e1', providerId:'mpesa', paymentIntentId:'i1', providerTransactionId:'TX-42' };
const payment = { id:'p1', state:'UNPAID' };
const calls = [];
const store = {
  getPaymentConfirmationAttemptByProviderTransaction: async (_chatId, q) => {
    calls.push(q);
    return q.providerTransactionId === 'TX-42' ? attempt : null;
  },
  getPaymentEvidence: async () => evidence,
  updatePaymentConfirmationAttempt: async (_chatId, id, input) => ({ ...attempt, id, ...input }),
  getPaymentForIntent: async () => payment,
};
const core = new PaymentCore({ store });
const result = await core.recordProviderConfirmationObservation({
  chatId:'chat-1',
  providerId:'mpesa',
  providerTransactionId:'TX-42',
  status:'PENDING',
});
assert.equal(result.pending, true);
assert.equal(calls[0].providerId, 'mpesa');
assert.equal(calls[0].providerTransactionId, 'TX-42');
assert.equal(payment.state, 'UNPAID');

await assert.rejects(
  core.recordProviderConfirmationObservation({
    chatId:'chat-1', providerId:'telebirr', providerTransactionId:'TX-42', status:'CONFIRMED'
  }),
  error => error.code === 'CONFIRMATION_ATTEMPT_NOT_FOUND'
);

console.log('GAP-1 provider transaction correlation regression: PASS');
