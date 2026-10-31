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
  insertPaymentVerification: async (_chatId, input) => {
    calls.push(['verification', input]);
    return { verification: { id: 'verification-1', ...input } };
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
assert.equal(commit[2].verification.observedTransactionId, 'TX-42');
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


const manualCalls = [];
const manualEvidence = {
  id: 'evidence-manual-1',
  paymentId: payment.id,
  paymentIntentId: 'intent-1',
  providerId: 'mpesa',
  evidenceType: 'SMS_TEXT',
  rawPayload: { text: 'untrusted SMS must not be copied into verification rawResult' },
};
const manualStore = {
  getPayment: async () => payment,
  getPaymentIntent: async () => ({ id: 'intent-1', amountMinor: 12500, currency: 'ETB' }),
  listPaymentAccounts: async () => [{ id: 'account-1', providerId: 'mpesa', accountIdentifier: '600001' }],
  listPaymentEvidence: async () => [manualEvidence],
  insertPaymentVerification: async (_chatId, input) => {
    manualCalls.push(['verification', input]);
    return { verification: { id: 'manual-verification-1', ...input } };
  },
  insertPaymentDecision: async (_chatId, input) => {
    manualCalls.push(['decision', input]);
    return { id: 'manual-decision-1', ...input };
  },
  commitPaymentDecision: async (_chatId, input) => {
    manualCalls.push(['commit', input]);
    return { ...payment, state: input.targetState };
  },
};
const manualCore = new PaymentCore({
  store: manualStore,
  invariantGate: {
    evaluate: input => {
      manualCalls.push(['manual-invariants', input]);
      return { passed: true, reasonCodes: [], checks: ['amount', 'currency', 'receiver'] };
    },
  },
  decisionEngine: {
    decide: ({ verification, invariants }) => ({
      decision: verification.result === 'MATCH' && invariants.passed ? 'ACCEPT' : 'RETRY_VERIFICATION',
      targetState: verification.result === 'MATCH' && invariants.passed ? 'VERIFIED' : null,
      reasonCodes: [],
    }),
  },
});
const manualResult = await manualCore.reviewManualEvidence({
  chatId: 'canonical-chat',
  paymentId: payment.id,
  evidenceId: manualEvidence.id,
  idempotencyKey: 'manual-review-idempotency-1',
  outcome: 'CONFIRM',
  attestation: true,
  reason: 'Matched against the receiving account statement',
  observedAmountMinor: 12500,
  observedCurrency: 'ETB',
  observedReceiverAccount: '600001',
  observedReference: 'BANK-REF-42',
  observedAt: '2026-10-31T18:00:00.000Z',
  actor: { userId: 'reviewer-1' },
});
assert.equal(manualResult.finalized, true);
assert.equal(manualResult.payment.state, 'VERIFIED');
const manualVerificationCall = manualCalls.find(call => call[0] === 'verification');
assert.equal(manualVerificationCall[1].verifier, 'payment-core.manual-review');
assert.equal(manualVerificationCall[1].result, 'MATCH');
assert.equal(manualVerificationCall[1].rawResult.attested, true);
assert.equal(JSON.stringify(manualVerificationCall[1].rawResult).includes('untrusted SMS'), false);
const manualCommit = manualCalls.find(call => call[0] === 'commit');
assert.equal(manualCommit[1].targetState, 'VERIFIED');
assert.equal(manualCommit[1].idempotencyKey, 'manual-review-idempotency-1');
assert.equal(manualCommit[1].decision.decisionSource, 'PAYMENT_CORE');
assert.equal(manualCommit[1].decision.metadata.reviewerId, 'reviewer-1');

await assert.rejects(
  manualCore.reviewManualEvidence({
    chatId: 'canonical-chat',
    paymentId: payment.id,
    evidenceId: manualEvidence.id,
    idempotencyKey: 'manual-review-idempotency-2',
    outcome: 'CONFIRM',
    reason: 'Missing explicit attestation',
    observedAmountMinor: 12500,
    observedCurrency: 'ETB',
    observedReceiverAccount: '600001',
    observedReference: 'BANK-REF-42',
    observedAt: '2026-10-31T18:00:00.000Z',
  }),
  error => error?.code === 'MANUAL_PAYMENT_ATTESTATION_REQUIRED'
);

const inconclusiveCalls = [];
const inconclusiveCore = new PaymentCore({
  store: {
    ...manualStore,
    insertPaymentVerification: async (_chatId, input) => {
      inconclusiveCalls.push(['verification', input]);
      return { verification: { id: 'manual-inconclusive-verification', ...input } };
    },
    insertPaymentDecision: async (_chatId, input) => {
      inconclusiveCalls.push(['decision', input]);
      return { id: 'manual-inconclusive-decision', ...input };
    },
    commitPaymentDecision: async () => {
      inconclusiveCalls.push(['commit']);
      throw new Error('Inconclusive review must not commit a payment transition');
    },
  },
  invariantGate: { evaluate: () => ({ passed: false, reasonCodes: ['OBSERVATION_INCOMPLETE'] }) },
  decisionEngine: { decide: () => ({ decision: 'RETRY_VERIFICATION', targetState: null, reasonCodes: ['OBSERVATION_INCOMPLETE'] }) },
});
const inconclusive = await inconclusiveCore.reviewManualEvidence({
  chatId: 'canonical-chat',
  paymentId: payment.id,
  evidenceId: manualEvidence.id,
  idempotencyKey: 'manual-review-idempotency-3',
  outcome: 'INCONCLUSIVE',
  reason: 'Receiving account statement is not available',
});
assert.equal(inconclusive.finalized, false);
assert.equal(inconclusive.paymentStateMutated, false);
assert.equal(inconclusiveCalls.some(call => call[0] === 'commit'), false);

console.log('GAP-1 provider confirmation finalization regression: PASS');
