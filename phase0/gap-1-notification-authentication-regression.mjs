import assert from 'node:assert/strict';
import { listPaymentProviders, getPaymentProvider } from '../backend/lib/payments/provider-registry.js';

const providers = listPaymentProviders();
const mpesa = providers.find(p => p.id === 'mpesa');
assert.ok(mpesa);
assert.equal(mpesa.capabilities.authenticateNotification, true);

const adapter = getPaymentProvider('mpesa');
assert.equal(typeof adapter.authenticateNotification, 'function');

const token = 'test-mpesa-notification-secret';
const previous = process.env.MPESA_NOTIFICATION_TOKEN;
process.env.MPESA_NOTIFICATION_TOKEN = token;

try {
  const result = await adapter.authenticateNotification({
    headers: { 'x-mpesa-notification-token': token }
  });
  assert.equal(result.authenticated, true);
  assert.equal(result.providerId, 'mpesa');

  await assert.rejects(
    () => adapter.authenticateNotification({ headers: { 'x-mpesa-notification-token': 'wrong-secret' } }),
    error => error.code === 'PAYMENT_NOTIFICATION_UNAUTHORIZED' && error.statusCode === 401
  );

  await assert.rejects(
    () => adapter.authenticateNotification({ headers: {} }),
    error => error.code === 'PAYMENT_NOTIFICATION_UNAUTHORIZED' && error.statusCode === 401
  );
} finally {
  if (previous === undefined) delete process.env.MPESA_NOTIFICATION_TOKEN;
  else process.env.MPESA_NOTIFICATION_TOKEN = previous;
}

console.log('GAP-1 notification authentication regression: PASS');
