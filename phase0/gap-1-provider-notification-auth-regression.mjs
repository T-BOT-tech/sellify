import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const core = new PaymentCore({
  store: {},
  providerRegistry: {
    getPaymentProvider(id) {
      if (id !== 'test-provider') return null;
      return {
        capabilities: { authenticateNotification: true, parseEvidence: true },
        authenticateNotification: async () => false,
        parseEvidence: async () => ({ reference: 'x', providerTransactionId: 'tx-1' }),
      };
    },
  },
});

await assert.rejects(
  () => core.ingestProviderNotification({
    chatId: 'tenant-1',
    organizationId: 'org-1',
    providerId: 'test-provider',
    source: 'provider_webhook',
    actorType: 'system',
    rawPayload: { transaction: 'x' },
  }),
  error => error?.code === 'PROVIDER_NOTIFICATION_AUTH_FAILED' && error?.statusCode === 401,
);

const unconfigured = new PaymentCore({
  store: {},
  providerRegistry: {
    getPaymentProvider() {
      return { capabilities: { authenticateNotification: false } };
    },
  },
});

await assert.rejects(
  () => unconfigured.ingestProviderNotification({
    chatId: 'tenant-1',
    organizationId: 'org-1',
    providerId: 'test-provider',
    source: 'provider_callback',
    actorType: 'system',
    rawPayload: {},
  }),
  error => error?.code === 'PAYMENT_PROVIDER_NOTIFICATION_AUTH_NOT_CONFIGURED' && error?.statusCode === 503,
);

console.log('GAP-1 provider notification authentication regression: PASS');
