import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const accountA = {
  id: 'account-a',
  organizationId: 'org-a',
  chatId: 'chat-a',
  providerId: 'mpesa',
  accountIdentifier: '600001',
};

const accountB = {
  id: 'account-b',
  organizationId: 'org-b',
  chatId: 'chat-b',
  providerId: 'mpesa',
  accountIdentifier: '600002',
};

const attemptA = {
  id: 'attempt-a',
  evidenceId: 'evidence-a',
  paymentIntentId: 'intent-a',
  paymentAccountId: 'account-a',
  providerId: 'mpesa',
  providerTransactionId: 'TX-COLLIDE-001',
  status: 'PENDING',
};

const attemptB = {
  id: 'attempt-b',
  evidenceId: 'evidence-b',
  paymentIntentId: 'intent-b',
  paymentAccountId: 'account-b',
  providerId: 'mpesa',
  providerTransactionId: 'TX-COLLIDE-001',
  status: 'PENDING',
};

const evidenceA = {
  id: 'evidence-a',
  providerId: 'mpesa',
  paymentIntentId: 'intent-a',
  paymentAccountId: 'account-a',
  providerTransactionId: 'TX-COLLIDE-001',
};

const evidenceB = {
  id: 'evidence-b',
  providerId: 'mpesa',
  paymentIntentId: 'intent-b',
  paymentAccountId: 'account-b',
  providerTransactionId: 'TX-COLLIDE-001',
};

const updated = [];

const store = {
  getPaymentAccountForProviderNotification: async (providerId, accountIdentifier) => {
    assert.equal(providerId, 'mpesa');
    if (accountIdentifier === '600001') return accountA;
    if (accountIdentifier === '600002') return accountB;
    throw Object.assign(new Error('No matching account'), {
      statusCode: 404,
      code: 'UNMATCHED_PROVIDER_NOTIFICATION',
    });
  },

  getPaymentConfirmationAttemptByProviderTransaction: async (chatId, query) => {
    assert.equal(query.providerId, 'mpesa');
    assert.equal(query.providerTransactionId, 'TX-COLLIDE-001');

    if (chatId === 'chat-a' && query.paymentAccountId === 'account-a') return attemptA;
    if (chatId === 'chat-b' && query.paymentAccountId === 'account-b') return attemptB;
    return null;
  },

  getPaymentConfirmationAttempt: async () => null,

  getPaymentAccountById: async (chatId, accountId) => {
    assert.equal(chatId, accountId === 'account-a' ? 'chat-a' : 'chat-b');
    if (accountId === 'account-a') return accountA;
    if (accountId === 'account-b') return accountB;
    return null;
  },

  getPaymentEvidence: async (_chatId, evidenceId) => {
    if (evidenceId === 'evidence-a') return evidenceA;
    if (evidenceId === 'evidence-b') return evidenceB;
    return null;
  },

  updatePaymentConfirmationAttempt: async (_chatId, id, input) => {
    updated.push({ id, input });
    return { ...(id === 'attempt-a' ? attemptA : attemptB), ...input };
  },

  getPaymentForIntent: async (_chatId, intentId) => ({
    id: intentId === 'intent-a' ? 'payment-a' : 'payment-b',
    paymentIntentId: intentId,
    state: 'UNPAID',
  }),
};

const core = new PaymentCore({ store });

const resultA = await core.recordProviderConfirmationObservation({
  chatId: 'attacker-chat',
  providerId: 'mpesa',
  providerAccountReference: '600001',
  providerTransactionId: 'TX-COLLIDE-001',
  status: 'PENDING',
});

assert.equal(resultA.confirmationAttempt.id, 'attempt-a');
assert.equal(resultA.confirmationAttempt.paymentAccountId, 'account-a');

const resultB = await core.recordProviderConfirmationObservation({
  chatId: 'attacker-chat',
  providerId: 'mpesa',
  providerAccountReference: '600002',
  providerTransactionId: 'TX-COLLIDE-001',
  status: 'PENDING',
});

assert.equal(resultB.confirmationAttempt.id, 'attempt-b');
assert.equal(resultB.confirmationAttempt.paymentAccountId, 'account-b');
assert.equal(updated.length, 2);

await assert.rejects(
  core.recordProviderConfirmationObservation({
    chatId: 'attacker-chat',
    providerId: 'mpesa',
    providerTransactionId: 'TX-COLLIDE-001',
    status: 'PENDING',
  }),
  error => error?.code === 'PAYMENT_ACCOUNT_REFERENCE_REQUIRED' && error?.statusCode === 400
);

console.log('GAP-1 account-bound provider transaction correlation regression: PASS');
