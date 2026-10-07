import assert from 'node:assert/strict';

const { PaymentCore } = await import('../backend/lib/payments/payment-core.js');

const store = {
  insertProviderNotificationEvidence: async input => ({
    duplicate: false,
    evidence: {
      id: 'evidence-1',
      paymentId: null,
      paymentIntentId: 'intent-1',
      providerId: input.authenticatedContext.providerId,
      paymentAccountId: 'account-1',
      providerNotificationId: input.authenticatedContext.notificationId,
    },
  }),
};

const provider = {
  id: 'mpesa',
  capabilities: { authenticateNotification: true },
  authenticateNotification: async raw => ({
    authenticated: true,
    providerId: 'mpesa',
    accountIdentifier: '600001',
    notificationId: raw.body.notificationId,
    signatureVersion: 'v1',
    receivedAt: '2026-10-07T00:00:00.000Z',
  }),
  parseEvidence: async ({ notification }) => ({
    providerId: 'mpesa',
    accountIdentifier: notification.body.accountIdentifier,
    evidenceType: 'PROVIDER_NOTIFICATION',
    status: 'VERIFIED',
    providerTransactionId: notification.body.transactionId,
    externalReference: notification.body.reference,
  }),
};

let attempt = {
  id: 'attempt-1',
  paymentIntentId: 'intent-1',
  paymentId: 'payment-1',
  paymentAccountId: 'account-1',
  providerId: 'mpesa',
  status: 'REQUESTED',
  providerTransactionId: null,
  reasonCodes: [],
  observation: {},
};

Object.assign(store, {
  resolvePaymentIntentForProviderEvidence: async () => ({
    resolutionStatus: 'MATCHED',
    chatId: 'chat-1',
    organizationId: 'org-1',
    paymentIntent: { id: 'intent-1' },
  }),
  createPaymentConfirmationAttempt: async () => attempt,
  getPaymentConfirmationAttempt: async () => attempt,
  updatePaymentConfirmationAttempt: async (chatId, id, input) => {
    attempt = { ...attempt, ...input, id };
    return attempt;
  },
  getPayment: async () => ({
    id: 'payment-1',
    state: 'UNPAID',
    providerId: 'mpesa',
    paymentIntentId: 'intent-1',
    paymentAccountId: 'account-1',
  }),
  getPaymentIntent: async () => ({ id: 'intent-1' }),
  listPaymentAccounts: async () => [{ id: 'account-1', accountIdentifier: '600001', providerId: 'mpesa' }],
  commitPaymentDecision: async (chatId, input) => ({ id: 'payment-1', state: input.targetState }),
});

const core = new PaymentCore({
  store,
  providerRegistry: {
    requirePaymentProvider: id => {
      assert.equal(id, 'mpesa');
      return provider;
    },
  },
  invariantGate: {
    evaluate: () => ({ passed: true, checks: [], reasonCodes: [], hardFailures: [] }),
  },
  decisionEngine: {
    decide: () => ({ decision: 'ACCEPT', targetState: 'VERIFIED', reasonCodes: [] }),
  },
});

const result = await core.ingestProviderNotification({
  providerId: 'mpesa',
  rawRequest: {
    body: {
      notificationId: 'notif-1',
      accountIdentifier: '600001',
      transactionId: 'TX-42',
      reference: 'ORDER-42',
    },
    rawBody: Buffer.from('raw'),
    headers: {},
  },
});

assert.equal(result.accepted, true);
assert.equal(result.evidence.paymentId, null);
assert.equal(result.evidence.paymentIntentId, 'intent-1');
assert.equal(result.evidence.providerId, 'mpesa');
assert.equal(result.evidence.providerNotificationId, 'notif-1');
assert.equal(result.confirmationAttempt.status, 'CONFIRMED');
assert.equal(result.finalization.finalized, true);
assert.equal(result.finalization.payment.state, 'VERIFIED');

const maliciousProvider = {
  ...provider,
  parseEvidence: async () => ({
    providerId: 'mpesa',
    accountIdentifier: '600001',
    evidenceType: 'PROVIDER_NOTIFICATION',
    paymentId: 'attacker-payment',
  }),
};

const maliciousCore = new PaymentCore({
  store,
  providerRegistry: { requirePaymentProvider: () => maliciousProvider },
});

await assert.rejects(
  maliciousCore.ingestProviderNotification({
    providerId: 'mpesa',
    rawRequest: { body: {} },
  }),
  error => error?.code === 'PAYMENT_NOTIFICATION_AUTHORITY_FIELD_FORBIDDEN'
);

console.log('GAP-1 provider notification Payment Core ingestion regression: PASS');
