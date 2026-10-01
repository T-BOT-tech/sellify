import assert from 'node:assert/strict';
import { PaymentCore } from '../backend/lib/payments/payment-core.js';

function buildCore({ authentication, parsed = { providerTransactionId: 'tx-1' }, config = { accountIdentifier: 'acct-1' } } = {}) {
  let parseCalls = 0;
  const provider = {
    id: 'gap1-auth-validation',
    authenticateNotification: async () => authentication,
    parseEvidence: async () => {
      parseCalls += 1;
      return parsed;
    },
  };

  const inserted = [];
  const core = new PaymentCore({
    providerRegistry: {
      requirePaymentProvider(id) {
        assert.equal(id, 'gap1-auth-validation');
        return provider;
      },
    },
    store: {
      async getPaymentAccountForProviderNotification(providerId, accountIdentifier) {
        assert.equal(providerId, 'gap1-auth-validation');
        assert.equal(accountIdentifier, 'acct-1');
        return {
          id: 'pa-1',
          organizationId: 'org-1',
          chatId: 'chat-1',
          providerId,
          accountIdentifier,
          metadata: {},
        };
      },
      async resolvePaymentIntentForProviderEvidence() {
        return { paymentIntent: null, locationId: null };
      },
      async insertPaymentEvidence(chatId, command) {
        inserted.push({ chatId, command });
        return { id: 'evidence-1', ...command };
      },
    },
  });

  return { core, config, get parseCalls() { return parseCalls; }, inserted };
}

await assert.rejects(
  () => buildCore({
    authentication: {
      authenticated: true,
      providerId: 'wrong-provider',
      providerAccountReference: 'acct-1',
      authenticationReference: 'auth-1',
    },
  }).core.ingestProviderNotification({
    providerId: 'gap1-auth-validation',
    rawRequest: {},
    config: { accountIdentifier: 'acct-1' },
  }),
  error => error?.code === 'PROVIDER_NOTIFICATION_AUTHENTICATION_INVALID' && error?.statusCode === 401
);

await assert.rejects(
  () => buildCore({
    authentication: {
      authenticated: true,
      providerId: 'gap1-auth-validation',
      providerAccountReference: 'acct-1',
    },
  }).core.ingestProviderNotification({
    providerId: 'gap1-auth-validation',
    rawRequest: {},
    config: { accountIdentifier: 'acct-1' },
  }),
  error => error?.code === 'PROVIDER_NOTIFICATION_AUTHENTICATION_INVALID' && error?.statusCode === 401
);

await assert.rejects(
  () => buildCore({
    authentication: {
      authenticated: true,
      providerId: 'gap1-auth-validation',
      providerAccountReference: 'acct-2',
      authenticationReference: 'auth-1',
    },
  }).core.ingestProviderNotification({
    providerId: 'gap1-auth-validation',
    rawRequest: {},
    config: { accountIdentifier: 'acct-1' },
  }),
  error => error?.code === 'PROVIDER_NOTIFICATION_AUTHENTICATION_INVALID' && error?.statusCode === 401
);

const mismatch = buildCore({
  authentication: {
    authenticated: true,
    providerId: 'gap1-auth-validation',
    providerAccountReference: 'acct-1',
    authenticationReference: 'auth-1',
    notificationId: 'notif-auth',
  },
  parsed: {
    providerTransactionId: 'tx-1',
    providerNotificationId: 'notif-parsed',
  },
});

await assert.rejects(
  () => mismatch.core.ingestProviderNotification({
    providerId: 'gap1-auth-validation',
    rawRequest: {},
    config: { accountIdentifier: 'acct-1' },
  }),
  error => error?.code === 'PROVIDER_NOTIFICATION_AUTHENTICATION_MISMATCH' && error?.statusCode === 401
);
assert.equal(mismatch.parseCalls, 1);

const valid = buildCore({
  authentication: {
    authenticated: true,
    providerId: 'gap1-auth-validation',
    providerAccountReference: 'acct-1',
    authenticationReference: 'auth-1',
    notificationId: 'notif-1',
  },
  parsed: {
    providerTransactionId: 'tx-1',
    providerNotificationId: 'notif-1',
  },
});

const result = await valid.core.ingestProviderNotification({
  providerId: 'gap1-auth-validation',
  rawRequest: {},
  config: { accountIdentifier: 'acct-1' },
});

assert.equal(valid.parseCalls, 1);
assert.equal(valid.inserted.length, 1);
assert.equal(valid.inserted[0].chatId, 'chat-1');
assert.equal(valid.inserted[0].command.providerAccountReference, 'acct-1');
assert.equal(valid.inserted[0].command.notificationAuthentication.authenticationReference, 'auth-1');
assert.equal(valid.inserted[0].command.providerNotificationId, 'notif-1');
assert.equal(result.id, 'evidence-1');

console.log('GAP-1 Provider Notification Authentication Validation Regression: PASS');
