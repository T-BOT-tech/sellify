import assert from 'node:assert/strict';
import mpesaProvider from '../backend/lib/payments/providers/mpesa.js';

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
