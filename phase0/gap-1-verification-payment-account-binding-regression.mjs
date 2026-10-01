import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');
const { InvariantGate } = await import('../backend/lib/payments/invariant-gate.js');

let verifyCalls = 0;

const invariantGate = new InvariantGate();
const invariantInput = {
  payment: {
    id: 'payment-001',
    paymentIntentId: 'intent-001',
    organizationId: 'org-001',
    providerId: 'mpesa',
    amountMinor: 1000,
    currency: 'ETB',
  },
  paymentIntent: canonicalIntent,
  paymentAccount: canonicalAccount,
  evidence: baseEvidence(),
  verification: {
    providerId: 'mpesa',
    observedAmountMinor: 1000,
    observedCurrency: 'ETB',
    observedReceiverAccount: '600001',
    observedReference: null,
  },
};
assert.equal(invariantGate.evaluate(invariantInput).passed, true);

for (const [label, mutate] of [
  ['account mismatch', value => ({ paymentAccount: { ...canonicalAccount, id: value } })],
  ['intent account mismatch', value => ({ paymentIntent: { ...canonicalIntent, paymentAccountId: value } })],
  ['evidence account mismatch', value => ({ evidence: baseEvidence({ paymentAccountId: value }) })],
  ['evidence intent mismatch', value => ({ evidence: baseEvidence({ paymentIntentId: value }) })],
  ['account provider mismatch', value => ({ paymentAccount: { ...canonicalAccount, providerId: value } })],
]) {
  const input = { ...invariantInput, ...mutate('attacker-value') };
  const result = invariantGate.evaluate(input);
  assert.equal(result.passed, false, label);
}

const canonicalIntent = {
  id: 'intent-001',
  organizationId: 'org-001',
  paymentAccountId: 'account-001',
  providerId: 'mpesa',
};

const canonicalPayment = {
  id: 'payment-001',
  organizationId: 'org-001',
  state: 'RECEIVED',
};

const canonicalAccount = {
  id: 'account-001',
  organizationId: 'org-001',
  chatId: 'chat-001',
  providerId: 'mpesa',
  accountIdentifier: '600001',
  metadata: {},
};

const provider = {
  verify: async () => {
    verifyCalls += 1;
    throw Object.assign(new Error('verification should only run after binding passes'), {
      code: 'TEST_PROVIDER_VERIFICATION_REACHED',
    });
  },
};

function makeStore(evidence) {
  return {
    getPaymentEvidence: async () => evidence,
    getPaymentIntent: async () => canonicalIntent,
    getPaymentForIntent: async () => canonicalPayment,
    getPaymentAccountById: async () => canonicalAccount,
    listPaymentVerifications: async () => [],
  };
}

function makeCore(evidence) {
  return new PaymentCore({
    store: makeStore(evidence),
    providerRegistry: {
      requirePaymentProvider: provider,
    },
  });
}

function baseEvidence(overrides = {}) {
  return {
    id: 'evidence-001',
    organizationId: 'org-001',
    locationId: 'location-001',
    paymentIntentId: 'intent-001',
    paymentAccountId: 'account-001',
    providerId: 'mpesa',
    source: 'provider-notification',
    providerNotificationId: 'notification-001',
    authenticationReference: 'auth-001',
    providerTransactionId: 'TX-001',
    normalizedPayload: {},
    ...overrides,
  };
}

verifyCalls = 0;
await assert.rejects(
  makeCore(baseEvidence({ paymentAccountId: 'account-attacker' })).verifyEvidence({
    chatId: 'chat-001',
    evidenceId: 'evidence-001',
  }),
  error =>
    error?.code === 'PAYMENT_EVIDENCE_ACCOUNT_BINDING_MISMATCH' &&
    error?.statusCode === 409,
);
assert.equal(verifyCalls, 0, 'provider verification must not run for an account mismatch');

verifyCalls = 0;
await assert.rejects(
  makeCore(baseEvidence({ providerId: 'telebirr' })).verifyEvidence({
    chatId: 'chat-001',
    evidenceId: 'evidence-001',
  }),
  error =>
    error?.code === 'PAYMENT_EVIDENCE_ACCOUNT_BINDING_MISMATCH' &&
    error?.statusCode === 409,
);
assert.equal(verifyCalls, 0, 'provider verification must not run for a provider mismatch');

verifyCalls = 0;
await assert.rejects(
  makeCore(baseEvidence({ organizationId: 'org-attacker' })).verifyEvidence({
    chatId: 'chat-001',
    evidenceId: 'evidence-001',
  }),
  error =>
    error?.code === 'PAYMENT_EVIDENCE_ACCOUNT_BINDING_MISMATCH' &&
    error?.statusCode === 409,
);
assert.equal(verifyCalls, 0, 'provider verification must not run for an organization mismatch');

verifyCalls = 0;
await assert.rejects(
  makeCore(baseEvidence({ authenticationReference: null })).verifyEvidence({
    chatId: 'chat-001',
    evidenceId: 'evidence-001',
  }),
  error =>
    error?.code === 'PAYMENT_EVIDENCE_AUTHENTICATION_CONTEXT_MISSING' &&
    error?.statusCode === 409,
);
assert.equal(verifyCalls, 0, 'provider verification must not run without durable authentication context');

verifyCalls = 0;
await assert.rejects(
  makeCore(baseEvidence()).verifyEvidence({
    chatId: 'chat-001',
    evidenceId: 'evidence-001',
  }),
  error => error?.code === 'TEST_PROVIDER_VERIFICATION_REACHED',
);
assert.equal(verifyCalls, 1, 'valid canonical binding must reach provider verification');


verifyCalls = 0;
const mismatchedEvidence = baseEvidence({ paymentAccountId: 'account-attacker' });
const observationCore = new PaymentCore({
  store: {
    ...makeStore(mismatchedEvidence),
    getPaymentConfirmationAttempt: async () => ({
      id: 'attempt-001',
      evidenceId: 'evidence-001',
      paymentIntentId: 'intent-001',
      paymentAccountId: 'account-001',
      providerId: 'mpesa',
    }),
    updatePaymentConfirmationAttempt: async () => {
      throw new Error('confirmation attempt must not be updated after binding failure');
    },
  },
  providerRegistry: { requirePaymentProvider: provider },
});
await assert.rejects(
  observationCore.recordProviderConfirmationObservation({
    chatId: 'chat-001',
    confirmationAttemptId: 'attempt-001',
    providerId: 'mpesa',
    status: 'CONFIRMED',
  }),
  error =>
    error?.code === 'PAYMENT_EVIDENCE_ACCOUNT_BINDING_MISMATCH' &&
    error?.statusCode === 409,
);
assert.equal(verifyCalls, 0, 'confirmation binding failure must not reach provider verification');


const finalizationCore = new PaymentCore({
  store: {
    ...makeStore(baseEvidence({ paymentAccountId: 'account-attacker' })),
    getPaymentConfirmationAttempt: async () => ({
      id: 'attempt-002',
      evidenceId: 'evidence-001',
      paymentIntentId: 'intent-001',
      paymentAccountId: 'account-001',
      providerId: 'mpesa',
      status: 'CONFIRMED',
      observation: { providerId: 'mpesa' },
    }),
    commitPaymentDecision: async () => {
      throw new Error('financial decision must not be committed after binding failure');
    },
  },
  providerRegistry: { requirePaymentProvider: provider },
});
await assert.rejects(
  finalizationCore.finalizeProviderConfirmation({
    chatId: 'chat-001',
    confirmationAttemptId: 'attempt-002',
  }),
  error =>
    error?.code === 'PAYMENT_EVIDENCE_ACCOUNT_BINDING_MISMATCH' &&
    error?.statusCode === 409,
);

console.log('GAP-1 verification/confirmation/finalization payment-account binding regression: PASS');
