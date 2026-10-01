import assert from 'node:assert/strict';
import mpesaProvider from '../backend/lib/payments/providers/mpesa.js';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

const rawRequest = {
  headers: {
    'x-sellify-notification-signature': 'unused-in-trusted-transport',
  },
  body: {
    BusinessShortCode: '600001',
    TransID: 'TX-MPESA-001',
    TransAmount: '125.50',
  },
};

const authenticated = await mpesaProvider.authenticateNotification({
  rawRequest,
  requestContext: { providerAuthenticated: true },
  config: {
    accountIdentifier: '600001',
    currency: 'KES',
    notificationAuthentication: { mode: 'trusted-transport' },
  },
});

assert.equal(authenticated.authenticated, true);
assert.equal(authenticated.providerId, 'mpesa');
assert.equal(authenticated.providerAccountReference, '600001');
assert.equal(authenticated.accountIdentifier, '600001');
assert.equal(authenticated.notificationId, 'TX-MPESA-001');
assert.equal(
  authenticated.authenticationReference,
  'mpesa:notification-auth:TX-MPESA-001:trusted-transport'
);


const captured = [];
const core = new PaymentCore({
  store: {
    getPaymentAccountForProviderNotification: async () => ({
      id: 'account-mpesa',
      organizationId: 'org-mpesa',
      chatId: 'chat-mpesa',
      providerId: 'mpesa',
      accountIdentifier: '600001',
    }),
    resolvePaymentIntentForProviderEvidence: async () => ({
      locationId: 'location-mpesa',
      paymentIntent: { id: 'intent-mpesa' },
    }),
    insertPaymentEvidence: async (chatId, input) => {
      captured.push({ chatId, input });
      return { evidence: { id: 'evidence-mpesa' }, duplicate: false };
    },
  },
  providerRegistry: {
    requirePaymentProvider: id => {
      assert.equal(id, 'mpesa');
      return mpesaProvider;
    },
  },
});

await core.ingestProviderNotification({
  providerId: 'mpesa',
  rawRequest,
  requestContext: { providerAuthenticated: true },
  config: {
    accountIdentifier: '600001',
    currency: 'KES',
    notificationAuthentication: { mode: 'trusted-transport' },
  },
});

assert.equal(captured.length, 1);
assert.equal(captured[0].chatId, 'chat-mpesa');
assert.equal(captured[0].input.paymentAccountId, 'account-mpesa');
assert.equal(captured[0].input.paymentIntentId, 'intent-mpesa');
assert.equal(captured[0].input.providerNotificationId, 'TX-MPESA-001');
assert.equal(
  captured[0].input.authenticationReference,
  'mpesa:notification-auth:TX-MPESA-001:trusted-transport'
);

const forgedProvider = Object.freeze({
  ...mpesaProvider,
  parseEvidence: async args => ({
    ...(await mpesaProvider.parseEvidence(args)),
    organizationId: 'forged-org',
    paymentIntentId: 'forged-intent',
  }),
});

await assert.rejects(
  new PaymentCore({
    store: {},
    providerRegistry: { requirePaymentProvider: () => forgedProvider },
  }).ingestProviderNotification({
    providerId: 'mpesa',
    rawRequest,
    requestContext: { providerAuthenticated: true },
    config: {
      accountIdentifier: '600001',
      currency: 'KES',
      notificationAuthentication: { mode: 'trusted-transport' },
    },
  }),
  error => error?.code === 'INVALID_PROVIDER_NOTIFICATION_IDENTITY' &&
    error?.statusCode === 400
);

await assert.rejects(
  mpesaProvider.authenticateNotification({
    rawRequest,
    requestContext: { providerAuthenticated: false },
    config: {
      accountIdentifier: '600001',
      notificationAuthentication: { mode: 'trusted-transport' },
    },
  }),
  error => error?.code === 'PAYMENT_NOTIFICATION_AUTH_FAILED' && error?.statusCode === 401,
);

console.log('GAP-1 M-Pesa authenticated notification contract regression: PASS');
