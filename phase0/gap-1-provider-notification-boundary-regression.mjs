import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

let inserted = null;
const core = new PaymentCore({
  store: {
    async getPaymentIntent() {
      return { id: 'intent-1', providerId: 'mpesa' };
    },
    async insertPaymentEvidence(_chatId, input) {
      inserted = input;
      return { evidence: { id: 'ev-1', status: 'RECEIVED' }, duplicate: false };
    },
  },
  providerRegistry: {
    getPaymentProvider() {
      return {
        capabilities: { parseEvidence: true },
        async parseEvidence() {
          return {
            reference: 'REF-1',
            providerTransactionId: 'TX-1',
            amountMinor: 10000,
            currency: 'ETB',
          };
        },
      };
    },
  },
});

const result = await core.ingestProviderNotification({
  chatId: 'tenant-1',
  paymentIntentId: 'intent-1',
  providerId: 'mpesa',
  source: 'provider_webhook',
  actorType: 'system',
  rawPayload: { TransID: 'TX-1' },
});

assert.equal(result.duplicate, false);
assert.equal(inserted.source, 'provider_webhook');
assert.equal(inserted.channel, 'webhook');
assert.equal(inserted.evidenceType, 'PROVIDER_NOTIFICATION');
assert.equal(inserted.providerTransactionId, 'TX-1');

await assert.rejects(
  core.ingestProviderNotification({
    chatId: 'tenant-1',
    paymentIntentId: 'intent-1',
    providerId: 'mpesa',
    source: 'provider_webhook',
    actorType: 'user',
    rawPayload: {},
  }),
  error => error.code === 'PROVIDER_NOTIFICATION_ACTOR_REQUIRED'
);

console.log('GAP-1 provider notification boundary regression: PASS');
