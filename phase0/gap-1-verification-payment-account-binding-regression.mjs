import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

let verifyCalls = 0;

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

console.log('GAP-1 verification-time payment-account binding regression: PASS');
