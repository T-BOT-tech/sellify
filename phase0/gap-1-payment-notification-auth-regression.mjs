import assert from 'node:assert/strict';
import {
  getPaymentProvider,
  listPaymentProviders,
  registerPaymentProvider,
  createUnconfiguredPaymentProvider,
} from '../backend/lib/payments/provider-registry.js';

const providers = listPaymentProviders();

for (const provider of providers) {
  const adapter = getPaymentProvider(provider.id);
  assert.equal(typeof adapter.authenticateNotification, 'function',
    `provider ${provider.id} must expose authenticateNotification()`);
  assert.equal(typeof adapter.parseEvidence, 'function',
    `provider ${provider.id} must expose parseEvidence()`);
}

assert.equal(getPaymentProvider('mpesa').capabilities.authenticateNotification, true);
assert.equal(getPaymentProvider('mpesa').capabilities.parseEvidence, true);

const configured = registerPaymentProvider({
  id: 'gap1-auth-contract',
  name: 'GAP-1 Auth Contract Test',
  capabilities: { authenticateNotification: true, parseEvidence: true },
  authenticateNotification: async ({ rawRequest }) => ({
    authenticated: true,
    providerId: 'gap1-auth-contract',
    accountIdentifier: 'acct-test',
    notificationId: rawRequest.notificationId,
    signatureVersion: 'test-v1',
    receivedAt: '2026-09-30T00:00:00.000Z',
  }),
  parseEvidence: async ({ rawRequest }) => ({
    providerTransactionId: rawRequest.transactionId,
    amountMinor: rawRequest.amountMinor,
    currency: 'ETB',
  }),
});

const authResult = await configured.authenticateNotification({
  rawRequest: { notificationId: 'notif-1', transactionId: 'tx-1' },
});
assert.deepEqual(authResult, {
  authenticated: true,
  providerId: 'gap1-auth-contract',
  accountIdentifier: 'acct-test',
  notificationId: 'notif-1',
  signatureVersion: 'test-v1',
  receivedAt: '2026-09-30T00:00:00.000Z',
});

const evidence = await configured.parseEvidence({
  rawRequest: { transactionId: 'tx-1', amountMinor: 1000 },
});
assert.deepEqual(evidence, {
  providerTransactionId: 'tx-1',
  amountMinor: 1000,
  currency: 'ETB',
});

assert.notStrictEqual(configured.authenticateNotification, configured.parseEvidence);

const unsupported = registerPaymentProvider({
  id: 'gap1-auth-unsupported',
  name: 'GAP-1 Unsupported Auth Test',
  capabilities: { parseEvidence: true },
  parseEvidence: async () => ({ providerTransactionId: 'tx-unsupported' }),
});

assert.equal(unsupported.capabilities.authenticateNotification, false);
await assert.rejects(
  () => unsupported.authenticateNotification({ rawRequest: {} }),
  error => error?.code === 'PAYMENT_PROVIDER_OPERATION_UNSUPPORTED' &&
    error?.statusCode === 501 &&
    error?.operation === 'authenticateNotification'
);

const unconfigured = createUnconfiguredPaymentProvider({
  id: 'gap1-auth-unconfigured',
  name: 'GAP-1 Unconfigured Auth Test',
  capabilities: { authenticateNotification: false },
});

await assert.rejects(
  () => unconfigured.authenticateNotification({ rawRequest: {} }),
  error => error?.code === 'PAYMENT_NOTIFICATION_NOT_CONFIGURED' &&
    error?.statusCode === 503 &&
    error?.providerId === 'gap1-auth-unconfigured'
);

console.log('GAP-1 Payment Notification Auth Contract Regression: PASS');

const mpesa = getPaymentProvider('mpesa');
const mpesaBody = { BusinessShortCode: '600001', TransID: 'RCP-001', TransAmount: '125.50', BillRefNumber: 'ORDER-1', TransTime: '20260930120000' };
const rawBody = JSON.stringify(mpesaBody);
const secret = 'gap1-mpesa-secret';
const { createHmac } = await import('node:crypto');
const signature = createHmac('sha256', secret).update(rawBody).digest('hex');
const authenticatedMpesa = await mpesa.authenticateNotification({
  rawRequest: { body: mpesaBody, rawBody, headers: { 'x-sellify-notification-signature': signature } },
  config: { accountIdentifier: '600001', currency: 'KES', notificationAuthentication: { mode: 'shared-secret', secret } },
});
assert.equal(authenticatedMpesa.authenticated, true);
assert.equal(authenticatedMpesa.providerId, 'mpesa');
assert.equal(authenticatedMpesa.accountIdentifier, '600001');
assert.equal(authenticatedMpesa.notificationId, 'RCP-001');

await assert.rejects(
  () => mpesa.authenticateNotification({
    rawRequest: { body: mpesaBody, rawBody, headers: { 'x-sellify-notification-signature': 'bad' } },
    config: { accountIdentifier: '600001', currency: 'KES', notificationAuthentication: { mode: 'shared-secret', secret } },
  }),
  error => error?.code === 'PAYMENT_NOTIFICATION_AUTH_FAILED' && error?.statusCode === 401
);
await assert.rejects(
  () => mpesa.authenticateNotification({
    rawRequest: { body: { ...mpesaBody, BusinessShortCode: '600002' }, rawBody, headers: { 'x-sellify-notification-signature': signature } },
    config: { accountIdentifier: '600001', currency: 'KES', notificationAuthentication: { mode: 'shared-secret', secret } },
  }),
  error => error?.code === 'PAYMENT_NOTIFICATION_AUTH_FAILED'
);
await assert.rejects(
  () => mpesa.authenticateNotification({ rawRequest: { body: mpesaBody, rawBody, headers: {} }, config: { accountIdentifier: '600001', currency: 'KES' } }),
  error => error?.code === 'PAYMENT_NOTIFICATION_NOT_CONFIGURED' && error?.statusCode === 503
);
const mpesaEvidence = await mpesa.parseEvidence({ rawRequest: { body: mpesaBody }, config: { currency: 'KES' } });
assert.deepEqual(mpesaEvidence, {
  providerId: 'mpesa', providerTransactionId: 'RCP-001', amountMinor: 12550,
  currency: 'KES', receiver: '600001', merchantReference: 'ORDER-1',
  providerTimestamp: '20260930120000', rawProviderReference: 'RCP-001'
});
assert.equal(mpesaEvidence.verified, undefined);

console.log('GAP-1 M-Pesa Notification Authentication Regression: PASS');
