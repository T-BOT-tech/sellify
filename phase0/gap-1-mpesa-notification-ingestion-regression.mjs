import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';
import { mpesaProvider } from '../backend/lib/payments/providers/mpesa.js';

process.env.MPESA_NOTIFICATION_TOKEN = 'test-mpesa-secret';

const inserted = [];
const resolved = {
  id: 'intent-server-resolved',
  paymentId: 'payment-server-resolved',
  chatId: 'tenant-42',
  organizationId: 'org-42',
  providerId: 'mpesa',
  amountMinor: 12500,
  currency: 'ETB',
  paymentAccountId: 'acct-42',
};

const store = {
  async findPaymentIntentForProviderEvidence(input) {
    assert.equal(input.providerId, 'mpesa');
    assert.equal(input.providerTransactionId, 'MPESA-TX-42');
    assert.equal(input.amountMinor, 12500);
    assert.equal(input.currency, 'ETB');
    return resolved;
  },
  async getPaymentIntent(chatId, id) {
    assert.equal(chatId, 'tenant-42');
    assert.equal(id, resolved.id);
    return resolved;
  },
  async insertPaymentEvidence(chatId, input) {
    inserted.push({ chatId, input });
    return { evidence: { id: 'evidence-42', ...input }, duplicate: false };
  },
};

const registry = {
  getPaymentProvider(id) {
    assert.equal(id, 'mpesa');
    return mpesaProvider;
  },
};

const core = new PaymentCore({
  store,
  providerRegistry: registry,
  verificationTimeoutMs: 1000,
  evidenceLeaseSeconds: 30,
});

const payload = {
  TransID: 'MPESA-TX-42',
  TransAmount: '125.00',
  BusinessShortCode: '123456',
  BillRefNumber: 'ORDER-42',
  Currency: 'ETB',
  TransTime: '20260930015500',
};

const result = await core.ingestProviderNotification({
  providerId: 'mpesa',
  rawPayload: payload,
  headers: { 'x-mpesa-notification-token': 'test-mpesa-secret' },
  source: 'provider_callback',
  paymentId: 'attacker-supplied-payment',
  paymentIntentId: 'attacker-supplied-intent',
});

assert.equal(result.paymentId, 'payment-server-resolved');
assert.equal(result.paymentIntentId, 'intent-server-resolved');
assert.equal(result.chatId, 'tenant-42');
assert.equal(inserted.length, 1);
assert.equal(inserted[0].input.paymentId, 'payment-server-resolved');
assert.equal(inserted[0].input.paymentIntentId, 'intent-server-resolved');
assert.equal(inserted[0].input.actor.type, 'system');

await assert.rejects(
  () => mpesaProvider.authenticateNotification({
    headers: { 'x-mpesa-notification-token': 'wrong-secret' },
  }),
  error => error?.code === 'PAYMENT_NOTIFICATION_UNAUTHORIZED' && error?.statusCode === 401,
);

console.log('GAP-1 M-Pesa notification ingestion regression: PASS');
