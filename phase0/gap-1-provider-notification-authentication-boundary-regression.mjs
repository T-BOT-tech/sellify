import assert from 'node:assert/strict';
import {
  PAYMENT_PROVIDER_IDS,
  getPaymentProvider,
  certifyPaymentProviderCapabilities,
} from '../backend/lib/payments/provider-registry.js';

for (const providerId of PAYMENT_PROVIDER_IDS) {
  const provider = getPaymentProvider(providerId);
  assert.ok(provider, 'provider ' + providerId + ' must be registered');
  assert.equal(typeof provider.authenticateNotification, 'function');
  assert.equal(provider.capabilities.authenticateNotification, false);
}

const mpesa = getPaymentProvider('mpesa');
assert.ok(mpesa);
await assert.rejects(
  () => mpesa.authenticateNotification({ rawBody: '{}', headers: {} }),
  error => error?.code === 'PAYMENT_NOTIFICATION_AUTH_NOT_CONFIGURED'
    && error?.providerId === 'mpesa'
    && error?.statusCode === 501
);

const certification = certifyPaymentProviderCapabilities('mpesa');
assert.equal(certification.capabilities.authenticateNotification, false);
assert.equal(certification.implementedMethods.authenticateNotification, true);

console.log('GAP-1 provider notification authentication boundary regression passed');