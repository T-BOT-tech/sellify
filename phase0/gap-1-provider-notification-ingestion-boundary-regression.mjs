import assert from 'node:assert/strict';
import { ingestProviderNotification } from '../backend/lib/payments/provider-notification-ingestion.js';

let writes = 0;
const stored = [];

const provider = {
  id: 'mpesa',
  authenticateNotification: async () => ({
    authenticated: true,
    providerId: 'mpesa',
    accountIdentifier: '251900000000',
    notificationId: 'notif-1',
    signatureVersion: 'v1',
    receivedAt: '2026-10-07T00:00:00.000Z',
  }),
  parseEvidence: async ({ notification }) => ({
    evidenceType: 'PROVIDER_NOTIFICATION',
    providerTransactionId: notification.transactionId,
    externalReference: notification.reference,
    normalizedPayload: { transactionId: notification.transactionId },
  }),
};

const providerRegistry = {
  getPaymentProvider: id => id === 'mpesa' ? provider : null,
};

const store = {
  insertProviderNotificationEvidence: async input => {
    writes += 1;
    stored.push(input);
    return { evidence: { id: 'evidence-1' }, duplicate: false };
  },
};

const result = await ingestProviderNotification({
  providerRegistry,
  store,
  providerId: 'mpesa',
  rawNotification: { transactionId: 'tx-1', reference: 'ref-1', paymentId: 'attacker-controlled' },
});

assert.equal(result.evidence.id, 'evidence-1');
assert.equal(writes, 1);
assert.equal(stored[0].authenticatedContext.providerId, 'mpesa');
assert.equal(stored[0].evidence.paymentId, undefined);
assert.equal(stored[0].evidence.paymentIntentId, undefined);
assert.equal(stored[0].evidence.organizationId, undefined);
assert.equal(stored[0].evidence.tenantId, undefined);

const unauthenticatedProvider = {
  ...provider,
  authenticateNotification: async () => ({
    authenticated: false,
    providerId: 'mpesa',
    accountIdentifier: '251900000000',
    notificationId: 'notif-2',
  }),
};

await assert.rejects(
  () => ingestProviderNotification({
    providerRegistry: { getPaymentProvider: () => unauthenticatedProvider },
    store,
    providerId: 'mpesa',
    rawNotification: {},
  }),
  error => error.code === 'PAYMENT_NOTIFICATION_AUTH_FAILED'
);
assert.equal(writes, 1);

const maliciousProvider = {
  ...provider,
  authenticateNotification: async () => ({
    authenticated: true,
    providerId: 'mpesa',
    accountIdentifier: '251900000000',
    notificationId: 'notif-3',
  }),
  parseEvidence: async () => ({
    evidenceType: 'PROVIDER_NOTIFICATION',
    paymentId: 'forged-payment',
  }),
};

await assert.rejects(
  () => ingestProviderNotification({
    providerRegistry: { getPaymentProvider: () => maliciousProvider },
    store,
    providerId: 'mpesa',
    rawNotification: {},
  }),
  error => error.code === 'PAYMENT_NOTIFICATION_AUTHORITY_FIELD_FORBIDDEN'
);
assert.equal(writes, 1);

console.log('GAP-1 provider notification ingestion boundary regression: PASS');
