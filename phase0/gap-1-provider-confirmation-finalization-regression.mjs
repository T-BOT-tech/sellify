import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const calls = [];
const payment = {
  id: 'payment-1',
  state: 'UNPAID',
  providerId: 'mpesa',
  paymentIntentId: 'intent-1',
  paymentAccountId: 'account-1',
  amountMinor: 12500,
  currency: 'ETB',
};

const attempt = {
  id: 'attempt-1',
  evidenceId: 'evidence-1',
  paymentId: 'payment-1',
  paymentIntentId: 'intent-1',
  paymentAccountId: 'account-1',
  providerId: 'mpesa',
  providerTransactionId: 'TX-42',
  status: 'CONFIRMED',
  observation: {
    providerTransactionId: 'TX-42',
    amountMinor: 12500,
    currency: 'ETB',
    receiverAccount: '600001',
    observedAt: '2026-10-07T08:00:00.000Z',
  },
  reasonCodes: ['PROVIDER_NOTIFICATION_CONFIRMED'],
  observedAt: '2026-10-07T08:00:00.000Z',
};

const store = {
  getPaymentConfirmationAttempt: async (chatId, attemptId) => {
    calls.push(['attempt', chatId, attemptId]);
    return attemptId === attempt.id ? attempt : null;
  },
  getPayment: async (chatId, paymentId) => {
    calls.push(['payment', chatId, paymentId]);
    return paymentId === payment.id ? payment : null;
  },
  getPaymentIntent: async (chatId, intentId) => {
    calls.push(['intent', chatId, intentId]);
    return intentId === 'intent-1' ? { id: 'intent-1', amountMinor: 12500, currency: 'ETB' } : null;
  },
  listPaymentAccounts: async chatId => {
    calls.push(['accounts', chatId]);
    return [{ id: 'account-1', accountIdentifier: '600001', providerId: 'mpesa' }];
  },
  insertPaymentVerification: async () => {
    calls.push(['verification']);
    return { verification: { id: 'verification-1' } };
  },
  insertPaymentDecision: async () => {
    calls.push(['decision']);
    return { id: 'decision-1' };
  },
  commitPaymentDecision: async (chatId, input) => {
    calls.push(['commit', chatId, input]);
    return { ...payment, state: input.targetState };
  },
};

const invariantGate = {
  evaluate: input => {
    calls.push(['invariants', input]);
    return { passed: true, checks: ['amount', 'currency', 'account'], reasonCodes: [], hardFailures: [] };
  },
};

const decisionEngine = {
  decide: input => {
    calls.push(['decision-engine', input]);
    return { decision: 'ACCEPT', targetState: 'VERIFIED', reasonCodes: [] };
  },
};

const core = new PaymentCore({ store, invariantGate, decisionEngine });

const result = await core.finalizeProviderConfirmation({
  chatId: 'canonical-chat',
  confirmationAttemptId: 'attempt-1',
});

assert.equal(result.finalized, true);
assert.equal(result.paymentStateMutated, true);
assert.equal(result.financialEffect, true);
assert.equal(result.payment.state, 'VERIFIED');
assert.equal(calls.some(call => call[0] === 'commit'), true);

const commit = calls.find(call => call[0] === 'commit');
assert.equal(commit[2].targetState, 'VERIFIED');
assert.equal(commit[2].verification.providerTransactionId, 'TX-42');
assert.equal(commit[2].decision.decisionSource, 'PAYMENT_CORE');
assert.equal(commit[2].decision.metadata.confirmationAttemptId, 'attempt-1');

const pendingCore = new PaymentCore({
  store: {
    getPaymentConfirmationAttempt: async () => ({ ...attempt, status: 'PENDING' }),
  },
});

const pending = await pendingCore.finalizeProviderConfirmation({
  chatId: 'canonical-chat',
  confirmationAttemptId: 'attempt-1',
});

assert.equal(pending.finalized, false);
assert.equal(pending.paymentStateMutated, false);

await assert.rejects(
  core.finalizeProviderConfirmation({
    chatId: 'canonical-chat',
    confirmationAttemptId: 'missing',
  }),
  error => error?.code === 'CONFIRMATION_ATTEMPT_NOT_FOUND'
);

const mismatchedCore = new PaymentCore({
  store: {
    getPaymentConfirmationAttempt: async () => ({ ...attempt, providerId: 'telebirr' }),
    getPayment: async () => payment,
  },
});

await assert.rejects(
  mismatchedCore.finalizeProviderConfirmation({
    chatId: 'canonical-chat',
    confirmationAttemptId: 'attempt-1',
  }),
  error => error?.code === 'PROVIDER_MISMATCH'
);

console.log('GAP-1 provider confirmation finalization regression: PASS');
