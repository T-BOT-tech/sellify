import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const attempt = {
  id: 'attempt-1',
  evidenceId: 'evidence-1',
  paymentIntentId: 'intent-1',
  paymentAccountId: 'account-1',
  providerId: 'mpesa',
  status: 'PENDING',
  providerTransactionId: null,
};

const calls = [];
const store = {
  getPaymentAccountForProviderNotification: async (providerId, accountIdentifier) => {
    calls.push(['account', providerId, accountIdentifier]);
    return {
      id: 'account-1',
      chatId: 'canonical-chat',
      providerId: 'mpesa',
      accountIdentifier: '600001',
    };
  },
  getPaymentConfirmationAttemptByProviderTransaction: async (chatId, query) => {
    calls.push(['attempt', chatId, query]);
    return query.providerTransactionId === 'TX-42' ? attempt : null;
  },
  updatePaymentConfirmationAttempt: async (chatId, attemptId, input) => {
    calls.push(['update', chatId, attemptId, input]);
    return { ...attempt, ...input };
  },
};

const core = new PaymentCore({ store });

const result = await core.recordProviderConfirmationObservation({
  chatId: 'attacker-chat',
  providerId: 'mpesa',
  providerAccountReference: '600001',
  providerTransactionId: 'TX-42',
  status: 'PENDING',
});

assert.equal(result.pending, true);
assert.equal(result.confirmationAttempt.providerTransactionId, 'TX-42');
assert.equal(calls[0][0], 'account');
assert.equal(calls[0][1], 'mpesa');
assert.equal(calls[0][2], '600001');
assert.equal(calls[1][0], 'attempt');
assert.equal(calls[1][1], 'canonical-chat');
assert.equal(calls[1][2].providerId, 'mpesa');
assert.equal(calls[1][2].providerTransactionId, 'TX-42');

await assert.rejects(
  core.recordProviderConfirmationObservation({
    chatId: 'attacker-chat',
    providerId: 'telebirr',
    providerAccountReference: '600001',
    providerTransactionId: 'TX-42',
    status: 'CONFIRMED',
  }),
  error => error?.code === 'PROVIDER_MISMATCH'
);

await assert.rejects(
  core.recordProviderConfirmationObservation({
    chatId: 'attacker-chat',
    providerId: 'mpesa',
    providerAccountReference: '600001',
    providerTransactionId: 'TX-404',
    status: 'PENDING',
  }),
  error => error?.code === 'CONFIRMATION_ATTEMPT_NOT_FOUND'
);

console.log('GAP-1 provider transaction confirmation correlation regression: PASS');
